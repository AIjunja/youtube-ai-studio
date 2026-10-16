/**
 * Shared API Contract & Types for YouTube AI Studio
 * Defined in docs/agy-context.md Section 4.
 * DO NOT MODIFY in feature branches — only main lead may update this file.
 */

export type CutReason = "ng" | "silence" | "repeat" | "offtopic";

export type SceneKind = "original" | "motion" | "ending";

export type SceneTemplate =
  | "title"
  | "bullets"
  | "diagram"
  | "compare"
  | "kinetic"
  | "ending";

export type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
};

export type TimeRange = {
  start: number;
  end: number;
};

export type CutSuggestion = {
  start: number;
  end: number;
  reason: CutReason;
  confidence: number;
  note?: string;
};

export type ExplanationGap = {
  atSec: number;
  missing: string;
};

export type PlannedScene = {
  id: string;
  kind: SceneKind;
  durationSec: number;
  script: string;
  caption: string;
  visualIdea: string;
  sourceRange?: TimeRange;
  template?: SceneTemplate;
  visuals?: string[];
};

export type ScenePlan = {
  summary: string;
  language: "ko" | "en" | string;
  transcript: TranscriptSegment[];
  keep: TimeRange[];
  cuts: CutSuggestion[];
  gaps: ExplanationGap[];
  scenes: PlannedScene[];
  uncertainFacts: string[];
};

export type SceneCodeSource = "argon-code" | "template-fallback";

export type SceneCode = {
  sceneId: string;
  /**
   * Function body of `function draw(ctx, t, w, h, scene)`
   * Deterministic Canvas 2D + Math only.
   */
  code: string;
  attempts: number;
  source: SceneCodeSource;
  lastError?: string;
};

export type SceneVerifyCheck = {
  sceneId: string;
  ok: boolean;
  source: SceneCodeSource;
  attempts: number;
  issue?: string;
};

export type VerifyReport = {
  passed: boolean;
  checks: SceneVerifyCheck[];
  retried: boolean;
};

export type ModelCallLogEntry = {
  id: string;
  timestamp: string;
  endpoint:
    | "/api/plan"
    | "/api/scene-code"
    | "/api/fix-code"
    | "/api/verify"
    | "/api/revise";
  model: string;
  sceneId?: string;
  attempt: number;
  durationMs: number;
  status: "ok" | "retry" | "fallback" | "error";
  detail?: string;
};

// ==========================================
// API Endpoint Request & Response Contracts
// ==========================================

export type ApiErrorResponse = {
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
};

/** GET /api/health */
export type HealthResponse = {
  ok: boolean;
  model: string;
  renderer: string;
  hasApiKey?: boolean;
  timestamp?: string;
};

/** POST /api/plan (multipart/form-data with `video` file or JSON `{ videoBase64, mimeType, prompt? }`) */
export type PlanRequestJson = {
  videoBase64?: string;
  mimeType?: string;
  durationSec?: number;
  userHint?: string;
};
export type PlanResponse = ScenePlan & {
  modelLog?: ModelCallLogEntry;
};

/** POST /api/scene-code */
export type SceneCodeRequest = {
  scene: PlannedScene;
  plan: ScenePlan;
  width?: number;
  height?: number;
};
export type SceneCodeResponse = SceneCode & {
  modelLog?: ModelCallLogEntry;
};

/** POST /api/fix-code */
export type FixCodeRequest = {
  scene: PlannedScene;
  plan?: ScenePlan;
  code: string;
  errorLog: string;
  attempt?: number;
  width?: number;
  height?: number;
};
export type FixCodeResponse = SceneCode & {
  modelLog?: ModelCallLogEntry;
};

/** POST /api/verify */
export type VerifyFrameInput = {
  sceneId: string;
  /** data:image/png;base64,... or raw base64 PNG/JPEG */
  imageBase64: string;
  mimeType?: string;
  source: SceneCodeSource;
  attempts: number;
};
export type VerifyRequest = {
  plan: ScenePlan;
  frames: VerifyFrameInput[];
  retried?: boolean;
};
export type VerifyResponse = VerifyReport & {
  modelLog?: ModelCallLogEntry;
};

/** POST /api/revise */
export type ReviseRequest = {
  plan: ScenePlan;
  sceneId: string;
  instruction: string;
  currentCode?: string;
};
export type ReviseResponse = {
  plan: ScenePlan;
  updatedSceneCode?: SceneCode;
  modelLog?: ModelCallLogEntry;
};

export const API_ENDPOINTS = {
  HEALTH: "/api/health",
  PLAN: "/api/plan",
  SCENE_CODE: "/api/scene-code",
  FIX_CODE: "/api/fix-code",
  VERIFY: "/api/verify",
  REVISE: "/api/revise",
} as const;
