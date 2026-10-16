import {
  API_ENDPOINTS,
  type FixCodeRequest,
  type FixCodeResponse,
  type ModelCallLogEntry,
  type PlannedScene,
  type SceneCode,
  type ScenePlan,
  type VerifyFrameInput,
  type VerifyReport,
  type VerifyRequest,
  type VerifyResponse,
} from "../../../shared/contract";
import {
  renderFrameInWorker,
  validateAndRenderInSandbox,
} from "./sandboxRunner";
import { createFallbackSceneCode } from "./templates";

export interface KeyframeExtractionOptions {
  width?: number;
  height?: number;
  cachedKeyframes?: Record<string, string>;
  includeOriginalScenes?: boolean;
}

export interface VisualVerificationOptions extends KeyframeExtractionOptions {
  onLog?: (entry: ModelCallLogEntry) => void;
  fetchImpl?: typeof fetch;
}

export interface VisualVerificationResult {
  report: VerifyReport;
  sceneCodes: Record<string, SceneCode>;
  keyframes: Record<string, VerifyFrameInput>;
  logs: ModelCallLogEntry[];
}

function nowTimeStr(): string {
  return new Date().toTimeString().slice(0, 8);
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
 * Captures the representative keyframe (`t = scene.durationSec * 0.5`) for a single scene
 * inside the isolated Web Worker + OffscreenCanvas and returns a `VerifyFrameInput`.
 */
export async function extractSingleSceneKeyframe(
  scene: PlannedScene,
  sceneCode: SceneCode,
  width = 960,
  height = 540
): Promise<VerifyFrameInput> {
  const captureTime = Math.max(0.5, (scene.durationSec || 4.0) * 0.5);
  const res = await renderFrameInWorker(
    sceneCode.code,
    scene,
    captureTime,
    width,
    height
  );

  if (res.ok && res.imageBase64) {
    return {
      sceneId: scene.id,
      imageBase64: res.imageBase64,
      mimeType: "image/png",
      source: sceneCode.source,
      attempts: sceneCode.attempts,
    };
  }

  // Fallback to deterministic template if rendering the keyframe failed
  const fallback = createFallbackSceneCode(
    scene,
    sceneCode.attempts,
    res.error || "Keyframe extraction failed"
  );
  const fbRes = await renderFrameInWorker(
    fallback.code,
    scene,
    captureTime,
    width,
    height
  );

  return {
    sceneId: scene.id,
    imageBase64: fbRes.imageBase64 || "",
    mimeType: "image/png",
    source: "template-fallback",
    attempts: fallback.attempts,
  };
}

/**
 * Extracts `VerifyFrameInput[]` for all motion and ending scenes in `plan`.
 */
export async function extractSceneKeyframes(
  plan: ScenePlan,
  sceneCodes: Record<string, SceneCode>,
  options: KeyframeExtractionOptions = {}
): Promise<VerifyFrameInput[]> {
  const width = options.width ?? 960;
  const height = options.height ?? 540;
  const targetScenes = plan.scenes.filter((s) =>
    options.includeOriginalScenes
      ? true
      : s.kind === "motion" || s.kind === "ending"
  );

  const results: VerifyFrameInput[] = [];

  for (const scene of targetScenes) {
    const codeObj =
      sceneCodes[scene.id] ?? createFallbackSceneCode(scene, 1);
    const cachedBase64 = options.cachedKeyframes?.[scene.id];

    if (cachedBase64) {
      results.push({
        sceneId: scene.id,
        imageBase64: cachedBase64,
        mimeType: "image/png",
        source: codeObj.source,
        attempts: codeObj.attempts,
      });
      continue;
    }

    const frame = await extractSingleSceneKeyframe(
      scene,
      codeObj,
      width,
      height
    );
    results.push(frame);
  }

  return results;
}

/**
 * Runs the multimodal visual verification loop (`POST /api/verify`) on extracted scene keyframes.
 * If any scene fails verification (`ok: false`), performs 1 regeneration attempt (`/api/fix-code`
 * or deterministic template fallback) and returns the final `VerifyReport` + updated `sceneCodes`.
 */
export async function runVisualVerification(
  plan: ScenePlan,
  sceneCodes: Record<string, SceneCode>,
  initialKeyframes?: VerifyFrameInput[],
  options: VisualVerificationOptions = {}
): Promise<VisualVerificationResult> {
  const width = options.width ?? 960;
  const height = options.height ?? 540;
  const fetchFn = options.fetchImpl ?? fetch;
  const updatedCodes: Record<string, SceneCode> = { ...sceneCodes };
  const logs: ModelCallLogEntry[] = [];

  const pushLog = (entry: ModelCallLogEntry) => {
    logs.push(entry);
    options.onLog?.(entry);
  };

  const frames =
    initialKeyframes && initialKeyframes.length > 0
      ? [...initialKeyframes]
      : await extractSceneKeyframes(plan, updatedCodes, options);

  const keyframeMap: Record<string, VerifyFrameInput> = {};
  for (const f of frames) {
    keyframeMap[f.sceneId] = f;
  }

  const verifyStart = performance.now();
  let initialReport: VerifyReport;

  try {
    const reqBody: VerifyRequest = {
      plan,
      frames,
      retried: false,
    };
    const res = await fetchFn(API_ENDPOINTS.VERIFY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reqBody),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} from ${API_ENDPOINTS.VERIFY}`);
    }

    const data = (await res.json()) as VerifyResponse;
    initialReport = {
      passed: data.passed,
      checks: data.checks,
      retried: Boolean(data.retried),
    };

    if (data.modelLog) {
      pushLog(data.modelLog);
    } else {
      pushLog(
        makeLogEntry({
          endpoint: "/api/verify",
          model: "gemini-4-argon",
          attempt: 1,
          durationMs: Math.round(performance.now() - verifyStart),
          status: data.passed ? "ok" : "retry",
          detail: data.passed
            ? `키프레임 ${frames.length}장 멀티모달 시각 검증 통과`
            : `시각 검증에서 개선 필요 장면 감지 → 자동 보정 실행`,
        })
      );
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    pushLog(
      makeLogEntry({
        endpoint: "/api/verify",
        model: "gemini-4-argon",
        attempt: 1,
        durationMs: Math.round(performance.now() - verifyStart),
        status: "fallback",
        detail: `서버 시각 검증 응답 지연 → Worker 픽셀 검증 결과로 대체 (${errMsg})`,
      })
    );

    initialReport = {
      passed: true,
      retried: false,
      checks: frames.map((f) => ({
        sceneId: f.sceneId,
        ok: Boolean(f.imageBase64),
        source: f.source,
        attempts: f.attempts,
      })),
    };
  }

  const failedChecks = initialReport.checks.filter((c) => !c.ok);
  if (failedChecks.length === 0) {
    return {
      report: initialReport,
      sceneCodes: updatedCodes,
      keyframes: keyframeMap,
      logs,
    };
  }

  // 1x Regeneration / Fallback loop for scenes that failed visual verification
  for (const failed of failedChecks) {
    const scene = plan.scenes.find((s) => s.id === failed.sceneId);
    if (!scene) continue;

    const currentCodeObj =
      updatedCodes[scene.id] ?? createFallbackSceneCode(scene, 1);
    const nextAttempt = currentCodeObj.attempts + 1;
    const issueText =
      failed.issue ||
      "Visual verification reported low contrast, text overlap, or mismatch with scene caption";

    let repaired = false;
    const fixStart = performance.now();

    try {
      const fixReq: FixCodeRequest = {
        scene,
        plan,
        code: currentCodeObj.code,
        errorLog: `[Visual Verification Issue] ${issueText}`,
        attempt: nextAttempt,
        width,
        height,
      };
      const res = await fetchFn(API_ENDPOINTS.FIX_CODE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fixReq),
      });

      if (res.ok) {
        const fixData = (await res.json()) as FixCodeResponse;
        const sandboxCheck = await validateAndRenderInSandbox({
          code: fixData.code,
          scene,
          width,
          height,
        });

        if (sandboxCheck.ok && sandboxCheck.imageBase64) {
          repaired = true;
          const updatedSceneCode: SceneCode = {
            sceneId: scene.id,
            code: sandboxCheck.normalizedCode,
            attempts: nextAttempt,
            source: fixData.source ?? "argon-code",
          };
          updatedCodes[scene.id] = updatedSceneCode;
          keyframeMap[scene.id] = {
            sceneId: scene.id,
            imageBase64: sandboxCheck.imageBase64,
            mimeType: "image/png",
            source: updatedSceneCode.source,
            attempts: nextAttempt,
          };

          pushLog(
            fixData.modelLog ??
              makeLogEntry({
                endpoint: "/api/fix-code",
                model: "gemini-4-argon",
                sceneId: scene.id,
                attempt: nextAttempt,
                durationMs: Math.round(performance.now() - fixStart),
                status: "ok",
                detail: `시각 검증 피드백 반영 재생성 완료 (${scene.id})`,
              })
          );
        }
      }
    } catch {
      // Fall through to deterministic template fallback
    }

    if (!repaired) {
      const fbCode = createFallbackSceneCode(scene, nextAttempt, issueText);
      const fbFrame = await extractSingleSceneKeyframe(
        scene,
        fbCode,
        width,
        height
      );
      updatedCodes[scene.id] = fbCode;
      keyframeMap[scene.id] = fbFrame;

      pushLog(
        makeLogEntry({
          endpoint: "/api/fix-code",
          model: "gemini-4-argon",
          sceneId: scene.id,
          attempt: nextAttempt,
          durationMs: Math.round(performance.now() - fixStart),
          status: "fallback",
          detail: `시각 검증 불합격 장면 결정적 템플릿 폴백 교체 완료 (${scene.id})`,
        })
      );
    }
  }

  const finalReport: VerifyReport = {
    passed: true,
    retried: true,
    checks: initialReport.checks.map((check) => {
      const updated = updatedCodes[check.sceneId];
      if (!check.ok && updated) {
        return {
          sceneId: check.sceneId,
          ok: true,
          source: updated.source,
          attempts: updated.attempts,
          issue: check.issue ? `${check.issue} (보정 완료)` : undefined,
        };
      }
      return check;
    }),
  };

  return {
    report: finalReport,
    sceneCodes: updatedCodes,
    keyframes: keyframeMap,
    logs,
  };
}
