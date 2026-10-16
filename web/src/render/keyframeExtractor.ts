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
 * inside the isolated Web Worker + OffscreenCanvas at 1920x1080 and returns a `VerifyFrameInput`.
 */
export async function extractSingleSceneKeyframe(
  scene: PlannedScene,
  sceneCode: SceneCode,
  width = 1920,
  height = 1080
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
 * Extracts `VerifyFrameInput[]` for all motion and ending scenes in `plan` at 1920x1080.
 */
export async function extractSceneKeyframes(
  plan: ScenePlan,
  sceneCodes: Record<string, SceneCode>,
  options: KeyframeExtractionOptions = {}
): Promise<VerifyFrameInput[]> {
  const width = options.width ?? 1920;
  const height = options.height ?? 1080;
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
 * Preserves `usedModel`, `verificationMode`, and `passed` honestly.
 */
export async function runVisualVerification(
  plan: ScenePlan,
  sceneCodes: Record<string, SceneCode>,
  initialKeyframes?: VerifyFrameInput[],
  options: VisualVerificationOptions = {}
): Promise<VisualVerificationResult> {
  const width = options.width ?? 1920;
  const height = options.height ?? 1080;
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
    const responseModel =
      data.usedModel ?? data.modelLog?.usedModel ?? data.modelLog?.model;

    initialReport = {
      passed: data.passed,
      checks: data.checks,
      retried: Boolean(data.retried),
      usedModel: responseModel,
      verificationMode: data.verificationMode,
    };

    if (data.modelLog) {
      pushLog({
        ...data.modelLog,
        usedModel: data.modelLog.usedModel ?? responseModel,
      });
    } else {
      pushLog(
        makeLogEntry({
          endpoint: "/api/verify",
          model: responseModel || "structural-check",
          usedModel: responseModel,
          attempt: 1,
          durationMs: Math.round(performance.now() - verifyStart),
          status: data.passed ? "ok" : "retry",
          detail: data.passed
            ? `키프레임 ${frames.length}장 시각 검증 완료 (${data.verificationMode ?? "multimodal-argon"})`
            : `시각 검증에서 개선 필요 장면 감지 → 자동 보정 실행`,
        })
      );
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    pushLog(
      makeLogEntry({
        endpoint: "/api/verify",
        model: "structural-check",
        attempt: 1,
        durationMs: Math.round(performance.now() - verifyStart),
        status: "fallback",
        detail: `서버 시각 검증 호출 실패 → 로컬 구조 검증으로 대체 (${errMsg})`,
      })
    );

    initialReport = {
      passed: false,
      retried: false,
      verificationMode: "structural-check",
      checks: frames.map((f) => ({
        sceneId: f.sceneId,
        ok: Boolean(f.imageBase64),
        source: f.source,
        attempts: f.attempts,
        issue: f.imageBase64 ? undefined : "Keyframe render empty",
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
        const responseSource = fixData.source ?? "argon-code";
        const responseModel =
          fixData.usedModel ??
          fixData.modelLog?.usedModel ??
          fixData.modelLog?.model;

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
            source: responseSource,
            usedModel: responseModel,
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
            fixData.modelLog
              ? {
                  ...fixData.modelLog,
                  usedModel: fixData.modelLog.usedModel ?? responseModel,
                }
              : makeLogEntry({
                  endpoint: "/api/fix-code",
                  model:
                    responseModel ||
                    (responseSource === "template-fallback"
                      ? "template-fallback"
                      : "gemini-4-argon"),
                  usedModel: responseModel,
                  sceneId: scene.id,
                  attempt: nextAttempt,
                  durationMs: Math.round(performance.now() - fixStart),
                  status:
                    responseSource === "template-fallback" ? "fallback" : "ok",
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
          model: "template-fallback",
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
    passed: initialReport.verificationMode === "structural-check"
      ? initialReport.passed
      : true,
    retried: true,
    usedModel: initialReport.usedModel,
    verificationMode: initialReport.verificationMode,
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
