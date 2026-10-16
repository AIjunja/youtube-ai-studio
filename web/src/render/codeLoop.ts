import {
  API_ENDPOINTS,
  type FixCodeRequest,
  type FixCodeResponse,
  type ModelCallLogEntry,
  type PlannedScene,
  type SceneCode,
  type SceneCodeRequest,
  type SceneCodeResponse,
  type ScenePlan,
} from "../../../shared/contract";
import {
  validateAndRenderInSandbox,
  type SandboxRunResult,
} from "./sandboxRunner";
import { createFallbackSceneCode } from "./templates";

export interface EnsureSceneCodeOptions {
  initialCode?: string;
  maxFixRetries?: number;
  width?: number;
  height?: number;
  onLog?: (entry: ModelCallLogEntry) => void;
  fetchImpl?: typeof fetch;
}

export interface EnsureSceneCodeResult {
  sceneCode: SceneCode;
  keyframeBase64?: string;
  keyframeBitmap?: ImageBitmap;
  logs: ModelCallLogEntry[];
}

function nowTimeStr(): string {
  const d = new Date();
  return d.toTimeString().slice(0, 8);
}

function makeLogEntry(
  partial: Omit<ModelCallLogEntry, "id" | "timestamp">
): ModelCallLogEntry {
  return {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: nowTimeStr(),
    ...partial,
  };
}

/**
 * Ensures a single `motion` or `ending` scene has verified, non-blank Canvas 2D code.
 * Flow:
 * 1. Generate initial code via `POST /api/scene-code` (or use `options.initialCode`).
 * 2. Run static + Worker OffscreenCanvas + blank-frame checks.
 * 3. On failure, call `POST /api/fix-code` with `errorLog` up to `maxFixRetries` (default 2) times.
 * 4. If still failing after 2 fix attempts, return deterministic template fallback (`source: "template-fallback"`).
 */
export async function ensureValidSceneCode(
  scene: PlannedScene,
  plan: ScenePlan,
  options: EnsureSceneCodeOptions = {}
): Promise<EnsureSceneCodeResult> {
  const maxFixRetries = options.maxFixRetries ?? 2;
  const width = options.width ?? 960;
  const height = options.height ?? 540;
  const fetchFn = options.fetchImpl ?? fetch;
  const logs: ModelCallLogEntry[] = [];

  const pushLog = (entry: ModelCallLogEntry) => {
    logs.push(entry);
    options.onLog?.(entry);
  };

  let candidateCode = options.initialCode ?? "";
  let attempts = 0;
  let lastError: string | undefined;

  // Step 1: Fetch initial scene code if not provided
  if (!candidateCode.trim()) {
    attempts = 1;
    const reqStart = performance.now();
    try {
      const reqBody: SceneCodeRequest = {
        scene,
        plan,
        width,
        height,
      };
      const res = await fetchFn(API_ENDPOINTS.SCENE_CODE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqBody),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} from ${API_ENDPOINTS.SCENE_CODE}`);
      }

      const data = (await res.json()) as SceneCodeResponse;
      candidateCode = data.code || "";
      if (data.modelLog) {
        pushLog(data.modelLog);
      } else {
        pushLog(
          makeLogEntry({
            endpoint: "/api/scene-code",
            model: "gemini-4-argon",
            sceneId: scene.id,
            attempt: 1,
            durationMs: Math.round(performance.now() - reqStart),
            status: "ok",
            detail: `초기 모션 코드 수신 (${scene.id})`,
          })
        );
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      pushLog(
        makeLogEntry({
          endpoint: "/api/scene-code",
          model: "gemini-4-argon",
          sceneId: scene.id,
          attempt: 1,
          durationMs: Math.round(performance.now() - reqStart),
          status: "error",
          detail: `/api/scene-code 호출 실패: ${lastError}`,
        })
      );
    }
  } else {
    attempts = 1;
  }

  // Step 2 & 3: Validate in Worker sandbox; on failure, retry up to `maxFixRetries` (2) times via /api/fix-code
  for (let fixIndex = 0; fixIndex <= maxFixRetries; fixIndex++) {
    if (candidateCode.trim()) {
      const sandboxRes: SandboxRunResult = await validateAndRenderInSandbox({
        code: candidateCode,
        scene,
        width,
        height,
      });

      if (sandboxRes.ok) {
        const verifiedSceneCode: SceneCode = {
          sceneId: scene.id,
          code: sandboxRes.normalizedCode,
          attempts,
          source: "argon-code",
        };
        return {
          sceneCode: verifiedSceneCode,
          keyframeBase64: sandboxRes.imageBase64,
          keyframeBitmap: sandboxRes.bitmap,
          logs,
        };
      }

      lastError = sandboxRes.error || "Sandbox validation failed";
    } else if (!lastError) {
      lastError = "Empty scene code returned from model";
    }

    // Check if we have remaining fix retries
    if (fixIndex >= maxFixRetries) {
      break;
    }

    const nextAttempt = attempts + 1;
    attempts = nextAttempt;
    const fixStart = performance.now();

    pushLog(
      makeLogEntry({
        endpoint: "/api/fix-code",
        model: "gemini-4-argon",
        sceneId: scene.id,
        attempt: nextAttempt,
        durationMs: 0,
        status: "retry",
        detail: `샌드박스 오류 감지 (${lastError}) → /api/fix-code 자동 수정 요청 (${fixIndex + 1}/${maxFixRetries})`,
      })
    );

    try {
      const fixBody: FixCodeRequest = {
        scene,
        plan,
        code: candidateCode,
        errorLog: lastError,
        attempt: nextAttempt,
        width,
        height,
      };
      const res = await fetchFn(API_ENDPOINTS.FIX_CODE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fixBody),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} from ${API_ENDPOINTS.FIX_CODE}`);
      }

      const data = (await res.json()) as FixCodeResponse;
      candidateCode = data.code || "";

      if (data.modelLog) {
        pushLog(data.modelLog);
      } else {
        pushLog(
          makeLogEntry({
            endpoint: "/api/fix-code",
            model: "gemini-4-argon",
            sceneId: scene.id,
            attempt: nextAttempt,
            durationMs: Math.round(performance.now() - fixStart),
            status: data.source === "template-fallback" ? "fallback" : "ok",
            detail: `${fixIndex + 1}차 수정 코드 수신 (${scene.id})`,
          })
        );
      }

      if (data.source === "template-fallback" && candidateCode.trim()) {
        // Server already fell back to a template; verify it in sandbox and return
        const fbCheck = await validateAndRenderInSandbox({
          code: candidateCode,
          scene,
          width,
          height,
        });
        if (fbCheck.ok) {
          return {
            sceneCode: {
              sceneId: scene.id,
              code: fbCheck.normalizedCode,
              attempts,
              source: "template-fallback",
              lastError,
            },
            keyframeBase64: fbCheck.imageBase64,
            keyframeBitmap: fbCheck.bitmap,
            logs,
          };
        }
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      pushLog(
        makeLogEntry({
          endpoint: "/api/fix-code",
          model: "gemini-4-argon",
          sceneId: scene.id,
          attempt: nextAttempt,
          durationMs: Math.round(performance.now() - fixStart),
          status: "error",
          detail: `/api/fix-code 호출 실패: ${lastError}`,
        })
      );
    }
  }

  // Step 4: Deterministic Canvas 2D Template Fallback (Guaranteed non-breaking)
  const fallbackSceneCode = createFallbackSceneCode(scene, attempts, lastError);
  const fallbackRender = await validateAndRenderInSandbox({
    code: fallbackSceneCode.code,
    scene,
    width,
    height,
  });

  pushLog(
    makeLogEntry({
      endpoint: "/api/fix-code",
      model: "gemini-4-argon",
      sceneId: scene.id,
      attempt: attempts,
      durationMs: fallbackRender.renderDurationMs,
      status: "fallback",
      detail: `최대 수정 횟수(${maxFixRetries}회) 초과 → 결정적 Canvas 2D 템플릿 폴백 적용 (${scene.id})`,
    })
  );

  return {
    sceneCode: fallbackSceneCode,
    keyframeBase64: fallbackRender.imageBase64,
    keyframeBitmap: fallbackRender.bitmap,
    logs,
  };
}

/**
 * Generates and validates scene code for all `"motion"` and `"ending"` scenes in a `ScenePlan`.
 */
export async function ensureAllSceneCodes(
  plan: ScenePlan,
  options: Omit<EnsureSceneCodeOptions, "initialCode"> & {
    initialCodes?: Record<string, SceneCode | string>;
  } = {}
): Promise<{
  sceneCodes: Record<string, SceneCode>;
  keyframes: Record<string, string>;
  logs: ModelCallLogEntry[];
}> {
  const sceneCodes: Record<string, SceneCode> = {};
  const keyframes: Record<string, string> = {};
  const allLogs: ModelCallLogEntry[] = [];

  const targetScenes = plan.scenes.filter(
    (s) => s.kind === "motion" || s.kind === "ending"
  );

  for (const scene of targetScenes) {
    const existing = options.initialCodes?.[scene.id];
    const initialCode =
      typeof existing === "string" ? existing : existing?.code;

    const result = await ensureValidSceneCode(scene, plan, {
      ...options,
      initialCode,
    });

    sceneCodes[scene.id] = result.sceneCode;
    if (result.keyframeBase64) {
      keyframes[scene.id] = result.keyframeBase64;
    }
    allLogs.push(...result.logs);
  }

  return {
    sceneCodes,
    keyframes,
    logs: allLogs,
  };
}
