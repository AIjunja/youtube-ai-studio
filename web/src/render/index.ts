export {
  inferSceneTemplate,
  getTemplateCode,
  drawTemplateFallback,
  createFallbackSceneCode,
  FALLBACK_TEMPLATES,
} from "./templates";

export type {
  WorkerRenderRequest,
  BlankFrameCheckResult,
  WorkerRenderResponse,
} from "./sandboxWorker";

export {
  SANDBOX_FRAME_TIMEOUT_MS,
  FORBIDDEN_IDENTIFIERS,
  normalizeSceneCodeBody,
  validateSceneCodeStatic,
  validateAndRenderInSandbox,
  renderFrameInWorker,
  type StaticValidationResult,
  type SandboxRunOptions,
  type SandboxRunResult,
} from "./sandboxRunner";

export {
  ensureValidSceneCode,
  ensureAllSceneCodes,
  type EnsureSceneCodeOptions,
  type EnsureSceneCodeResult,
} from "./codeLoop";

export {
  extractSingleSceneKeyframe,
  extractSceneKeyframes,
  runVisualVerification,
  type KeyframeExtractionOptions,
  type VisualVerificationOptions,
  type VisualVerificationResult,
} from "./keyframeExtractor";

export {
  buildTimeline,
  findTimelineEntryAt,
  drawSubtitleOverlay,
  renderCompositeFrame,
  selectSupportedVideoMimeType,
  exportCompositeVideo,
  createSampleInputVideoBlob,
  type TimelineSceneEntry,
  type CompositeTimeline,
  type ActiveTimelineLookup,
  type RenderCompositeFrameParams,
  type ExportVideoOptions,
  type ExportVideoResult,
  type SampleVideoResult,
} from "./compositor";

import type {
  ModelCallLogEntry,
  SceneCode,
  ScenePlan,
  VerifyFrameInput,
  VerifyReport,
} from "../../../shared/contract";
import { ensureAllSceneCodes } from "./codeLoop";
import {
  extractSceneKeyframes,
  runVisualVerification,
} from "./keyframeExtractor";

export interface FullRenderPipelineOptions {
  initialCodes?: Record<string, SceneCode | string>;
  skipVisualVerify?: boolean;
  width?: number;
  height?: number;
  onLog?: (entry: ModelCallLogEntry) => void;
}

export interface FullRenderPipelineResult {
  sceneCodes: Record<string, SceneCode>;
  keyframes: Record<string, VerifyFrameInput>;
  verifyReport: VerifyReport;
  logs: ModelCallLogEntry[];
}

/**
 * Convenience orchestrator for UI integration:
 * 1. Generates & validates all motion/ending scene codes in the isolated Worker sandbox (max 2 fix retries + template fallback).
 * 2. Extracts representative PNG keyframes at `t = durationSec * 0.5`.
 * 3. Runs multimodal visual verification (`/api/verify`) with 1x regeneration/fallback on any flagged scene.
 */
export async function runFullRenderPipeline(
  plan: ScenePlan,
  options: FullRenderPipelineOptions = {}
): Promise<FullRenderPipelineResult> {
  const codeStep = await ensureAllSceneCodes(plan, {
    initialCodes: options.initialCodes,
    width: options.width,
    height: options.height,
    onLog: options.onLog,
  });

  const frames = await extractSceneKeyframes(plan, codeStep.sceneCodes, {
    width: options.width,
    height: options.height,
    cachedKeyframes: codeStep.keyframes,
  });

  if (options.skipVisualVerify) {
    const keyframeMap: Record<string, VerifyFrameInput> = {};
    for (const f of frames) {
      keyframeMap[f.sceneId] = f;
    }
    return {
      sceneCodes: codeStep.sceneCodes,
      keyframes: keyframeMap,
      verifyReport: {
        passed: true,
        retried: false,
        checks: frames.map((f) => ({
          sceneId: f.sceneId,
          ok: true,
          source: f.source,
          attempts: f.attempts,
        })),
      },
      logs: codeStep.logs,
    };
  }

  const verifyStep = await runVisualVerification(
    plan,
    codeStep.sceneCodes,
    frames,
    {
      width: options.width,
      height: options.height,
      onLog: options.onLog,
    }
  );

  return {
    sceneCodes: verifyStep.sceneCodes,
    keyframes: verifyStep.keyframes,
    verifyReport: verifyStep.report,
    logs: [...codeStep.logs, ...verifyStep.logs],
  };
}
