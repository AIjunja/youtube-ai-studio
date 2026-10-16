import { GoogleGenAI, ThinkingLevel, type Part } from "@google/genai";
import type { ModelCallLogEntry } from "../shared/contract.js";

export type ModelCallStatus = ModelCallLogEntry["status"];

const DEFAULT_PRIMARY_MODEL = "gemini-4-argon";
const DEFAULT_FALLBACK_MODEL = "gemini-2.5-flash";
const DEFAULT_TTS_MODEL = "gemini-3.8-flash-tts";
const MODEL_CALL_TIMEOUT_MS = Number(process.env.ARGON_TIMEOUT_MS || 45000);

let cachedClient: GoogleGenAI | null = null;
let cachedApiKey: string | null = null;

/**
 * Returns the configured primary Argon model ID.
 * Always managed via process.env.ARGON_MODEL with fallback to "gemini-4-argon".
 */
export function getArgonModel(): string {
  return (process.env.ARGON_MODEL || DEFAULT_PRIMARY_MODEL).trim();
}

/**
 * Returns the configured TTS model ID.
 * Managed via process.env.TTS_MODEL with fallback to "gemini-3.8-flash-tts".
 */
export function getTtsModel(): string {
  return (process.env.TTS_MODEL || DEFAULT_TTS_MODEL).trim();
}

/**
 * Checks whether GEMINI_API_KEY (or GOOGLE_API_KEY) is present and non-empty.
 */
export function hasApiKey(): boolean {
  const key = (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ""
  ).trim();
  return key.length > 0;
}

/**
 * Returns a cached GoogleGenAI SDK client instance if an API key is configured.
 */
export function getGenAIClient(): GoogleGenAI | null {
  const key = (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ""
  ).trim();
  if (!key) {
    return null;
  }
  if (!cachedClient || cachedApiKey !== key) {
    cachedClient = new GoogleGenAI({ apiKey: key });
    cachedApiKey = key;
  }
  return cachedClient;
}

/**
 * Strips any potential API key patterns from error messages before logging or returning.
 */
export function sanitizeErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw.replace(/AIza[0-9A-Za-z\-_]{20,}/g, "[REDACTED_KEY]").slice(0, 400);
}

/**
 * Helper to create a standardized ModelCallLogEntry for the right-side Argon log panel.
 */
export function createModelLog(params: {
  endpoint: ModelCallLogEntry["endpoint"];
  model?: string;
  usedModel?: string;
  sceneId?: string;
  attempt: number;
  durationMs: number;
  status: ModelCallStatus;
  detail?: string;
}): ModelCallLogEntry {
  const actualModel = params.usedModel || params.model || getArgonModel();
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    endpoint: params.endpoint,
    model: actualModel,
    usedModel: actualModel,
    ...(params.sceneId ? { sceneId: params.sceneId } : {}),
    attempt: params.attempt,
    durationMs: Math.max(1, Math.round(params.durationMs)),
    status: params.status,
    ...(params.detail ? { detail: params.detail } : {}),
  };
}

export interface ArgonCallOptions {
  endpoint: ModelCallLogEntry["endpoint"];
  sceneId?: string;
  attempt?: number;
  systemInstruction?: string;
  contents: Array<Part | string>;
  responseMimeType?: string;
  responseSchema?: Record<string, unknown>;
  temperature?: number;
  timeoutMs?: number;
}

export interface ArgonCallResult {
  ok: boolean;
  text: string;
  usedModel: string;
  fellBackModel: boolean;
  modelLog: ModelCallLogEntry;
  error?: string;
}

/**
 * Calls the configured Argon model via @google/genai.
 * If the primary model ("gemini-4-argon") is unavailable in the environment,
 * automatically retries once with "gemini-2.5-flash" so the pipeline stays live,
 * while logging the exact usedModel truthfully.
 */
export async function callArgonModel(
  options: ArgonCallOptions
): Promise<ArgonCallResult> {
  const startMs = Date.now();
  const primaryModel = getArgonModel();
  const attempt = options.attempt ?? 1;
  const effectiveTimeoutMs = options.timeoutMs ?? MODEL_CALL_TIMEOUT_MS;
  const client = getGenAIClient();

  if (!client) {
    const durationMs = Date.now() - startMs;
    const msg = "GEMINI_API_KEY is not configured; using deterministic fallback.";
    return {
      ok: false,
      text: "",
      usedModel: "template-fallback",
      fellBackModel: false,
      error: msg,
      modelLog: createModelLog({
        endpoint: options.endpoint,
        model: "template-fallback",
        usedModel: "template-fallback",
        sceneId: options.sceneId,
        attempt,
        durationMs,
        status: "fallback",
        detail: msg,
      }),
    };
  }

  const candidateModels =
    primaryModel === DEFAULT_FALLBACK_MODEL
      ? [primaryModel]
      : [primaryModel, DEFAULT_FALLBACK_MODEL];

  let lastError = "";

  for (let i = 0; i < candidateModels.length; i++) {
    const candidateModel = candidateModels[i];
    const isFallbackModel = i > 0;

    try {
      const normalizedParts: Part[] = options.contents.map((item) =>
        typeof item === "string" ? { text: item } : item
      );

      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(
          () =>
            reject(
              new Error(`Model call timed out after ${effectiveTimeoutMs}ms`)
            ),
          effectiveTimeoutMs
        );
      });

      const response = await Promise.race([
        client.models.generateContent({
          model: candidateModel,
          contents: [{ role: "user", parts: normalizedParts }],
          config: {
            ...(options.systemInstruction
              ? { systemInstruction: options.systemInstruction }
              : {}),
            ...(options.responseMimeType
              ? { responseMimeType: options.responseMimeType }
              : {}),
            ...(options.responseSchema
              ? { responseSchema: options.responseSchema }
              : {}),
            temperature: options.temperature ?? 0.2,
            ...(candidateModel === DEFAULT_PRIMARY_MODEL
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
          },
        }),
        timeoutPromise,
      ]).finally(() => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
      });

      const text = (response.text ?? "").trim();
      const durationMs = Date.now() - startMs;

      if (!text) {
        throw new Error(`Empty response text from model ${candidateModel}`);
      }

      const status: ModelCallStatus =
        attempt > 1 ? "retry" : isFallbackModel ? "retry" : "ok";
      const detail = isFallbackModel
        ? `Primary model (${primaryModel}) unavailable (${lastError.slice(0, 80)}); completed with ${candidateModel}`
        : `Completed with ${candidateModel}`;

      console.log(
        `[Argon] ${options.endpoint}${options.sceneId ? ` (${options.sceneId})` : ""} attempt=${attempt} model=${candidateModel} status=${status} duration=${durationMs}ms`
      );

      return {
        ok: true,
        text,
        usedModel: candidateModel,
        fellBackModel: isFallbackModel,
        modelLog: createModelLog({
          endpoint: options.endpoint,
          model: candidateModel,
          usedModel: candidateModel,
          sceneId: options.sceneId,
          attempt,
          durationMs,
          status,
          detail,
        }),
      };
    } catch (err) {
      lastError = sanitizeErrorMessage(err);
      console.warn(
        `[Argon] ${options.endpoint} model=${candidateModel} attempt=${attempt} error: ${lastError}`
      );
    }
  }

  const durationMs = Date.now() - startMs;
  return {
    ok: false,
    text: "",
    usedModel: "template-fallback",
    fellBackModel: false,
    error: lastError,
    modelLog: createModelLog({
      endpoint: options.endpoint,
      model: primaryModel,
      usedModel: "template-fallback",
      sceneId: options.sceneId,
      attempt,
      durationMs,
      status: "error",
      detail: `Model call failed (${lastError.slice(0, 120)})`,
    }),
  };
}
