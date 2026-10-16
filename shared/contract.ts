/**
 * Shared API Contract & Types for YouTube AI Studio
 * Defined in docs/agy-context.md & FINAL Sprint Prompt.
 * DO NOT MODIFY in feature branches — only main lead may update this file.
 */

export type ProjectMode = "edit-only" | "edit-plus-script" | "script-only";

export type VoiceProfile = {
  voiceId: string;
  label: string;
  createdAt: string;
  isDefault?: boolean;
};

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
  /** Optional base64 WAV or object URL for synthesized TTS audio */
  audioUrl?: string;
  audioBase64?: string;
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
  mode?: ProjectMode;
};

export type SceneCodeSource = "argon-code" | "template-fallback";

export type SceneCode = {
  sceneId: string;
  /**
   * Function body of `function draw(ctx, t, w, h, scene)`
   * Deterministic Canvas 2D + Math + kit.* helpers.
   */
  code: string;
  attempts: number;
  source: SceneCodeSource;
  usedModel?: string;
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
  usedModel?: string;
  verificationMode?: "multimodal-argon" | "structural-check";
};

export type ApiEndpointPath =
  | "/api/voice/clone"
  | "/api/plan"
  | "/api/script"
  | "/api/tts"
  | "/api/scene-code"
  | "/api/fix-code"
  | "/api/verify"
  | "/api/revise";

export type ModelCallLogEntry = {
  id: string;
  timestamp: string;
  endpoint: ApiEndpointPath;
  model: string;
  usedModel?: string;
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
    usedModel?: string;
  };
};

/** GET /api/health */
export type HealthResponse = {
  ok: boolean;
  model: string;
  ttsModel?: string;
  renderer: string;
  hasApiKey?: boolean;
  timestamp?: string;
};

/** POST /api/voice/clone */
export type VoiceCloneRequest = {
  /** Base64 encoded audio (10~30s wav/mp3/webm) */
  audioBase64?: string;
  mimeType?: string;
  /** Optional separate consent audio; defaults to audioBase64 if same clip includes consent */
  consentAudioBase64?: string;
  consentMimeType?: string;
  consent: boolean;
  label?: string;
};
export type VoiceCloneResponse = {
  voiceId: string;
  label: string;
  usedModel: string;
  modelLog?: ModelCallLogEntry;
};

/** POST /api/plan (multipart/form-data with `video` file or JSON `{ videoBase64, mimeType, prompt? }`) */
export type PlanRequestJson = {
  videoBase64?: string;
  mimeType?: string;
  durationSec?: number;
  userHint?: string;
  mode?: ProjectMode;
};
export type PlanResponse = ScenePlan & {
  usedModel: string;
  modelLog?: ModelCallLogEntry;
};

export type ScriptMode = "append" | "from-scratch";

/** POST /api/script */
export type ScriptSceneDraft = {
  id: string;
  kind?: SceneKind;
  script: string;
  narration?: string;
  caption: string;
  visualIdea: string;
  durationSec: number;
  template?: SceneTemplate;
  visuals?: string[];
  insertAfterSceneId?: string;
};
export type ScriptRequest = {
  mode: ScriptMode;
  plan?: ScenePlan;
  topic?: string;
  notes?: string;
  targetSceneCount?: number;
};
export type ScriptResponse = {
  mode: ScriptMode;
  scenes: ScriptSceneDraft[];
  plan?: ScenePlan;
  usedModel: string;
  modelLog?: ModelCallLogEntry;
};

/** POST /api/tts */
export type TtsRequest = {
  text: string;
  voiceId?: string;
  style?: string;
  sceneId?: string;
};
/** Note: POST /api/tts returns binary `audio/wav` with header `X-Used-Model` (or JSON if `format: "json"` is passed) */
export type TtsJsonResponse = {
  audioBase64: string;
  mimeType: "audio/wav";
  usedModel: string;
  voiceId?: string;
  durationSec?: number;
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
  usedModel: string;
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
  usedModel: string;
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
  usedModel: string;
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
  usedModel: string;
  modelLog?: ModelCallLogEntry;
};

export const API_ENDPOINTS = {
  HEALTH: "/api/health",
  VOICE_CLONE: "/api/voice/clone",
  PLAN: "/api/plan",
  SCRIPT: "/api/script",
  TTS: "/api/tts",
  SCENE_CODE: "/api/scene-code",
  FIX_CODE: "/api/fix-code",
  VERIFY: "/api/verify",
  REVISE: "/api/revise",
} as const;
