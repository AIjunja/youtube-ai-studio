import { GoogleGenAI, type Part, type Schema } from "@google/genai";
import crypto from "node:crypto";
import type { ModelCallLogEntry } from "../shared/contract.js";

export function getArgonModel(): string {
  return process.env.ARGON_MODEL || "gemini-4-argon";
}

// Compatible fallback models if the primary ARGON_MODEL returns 404/400/429 in the runtime environment
const FALLBACK_MODELS = [
  "gemini-3-flash-preview",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-flash-latest",
];

const MODEL_CALL_TIMEOUT_MS = Number(process.env.ARGON_TIMEOUT_MS || 12000);

let cachedClient: GoogleGenAI | null = null;
let cachedKey: string | undefined;

export function getGenAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  if (!cachedClient || cachedKey !== apiKey) {
    cachedClient = new GoogleGenAI({ apiKey });
    cachedKey = apiKey;
  }
  return cachedClient;
}

/**
 * Redact any accidental API key appearance in error messages before logging or returning.
 */
export function sanitizeErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const key = process.env.GEMINI_API_KEY?.trim();
  if (key && key.length > 4) {
    return raw.split(key).join("[REDACTED_KEY]");
  }
  return raw.slice(0, 300);
}

export function createModelLog(params: {
  endpoint: ModelCallLogEntry["endpoint"];
  model: string;
  sceneId?: string;
  attempt: number;
  durationMs: number;
  status: ModelCallLogEntry["status"];
  detail?: string;
}): ModelCallLogEntry {
  return {
    id: `log-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
    timestamp: new Date().toISOString(),
    endpoint: params.endpoint,
    model: params.model,
    ...(params.sceneId ? { sceneId: params.sceneId } : {}),
    attempt: params.attempt,
    durationMs: Math.max(1, Math.round(params.durationMs)),
    status: params.status,
    ...(params.detail ? { detail: params.detail } : {}),
  };
}

export type ArgonCallOptions = {
  endpoint: ModelCallLogEntry["endpoint"];
  sceneId?: string;
  attempt?: number;
  systemInstruction?: string;
  contents: Array<string | Part>;
  responseMimeType?: string;
  responseSchema?: Schema;
  temperature?: number;
};

export type ArgonCallResult = {
  ok: boolean;
  text: string;
  usedModel: string;
  fellBackModel: boolean;
  error?: string;
  modelLog: ModelCallLogEntry;
};

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout after ${ms}ms (${label})`));
    }, ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * Calls `ARGON_MODEL` first via `@google/genai`.
 * If `ARGON_MODEL` fails with 404/400/429/not-found/permission error, logs immediately
 * and retries automatically with compatible Gemini models so the live demo never crashes.
 */
export async function callArgonModel(
  opts: ArgonCallOptions
): Promise<ArgonCallResult> {
  const primaryModel = getArgonModel();
  const attemptNum = opts.attempt ?? 1;
  const startTime = Date.now();
  const client = getGenAIClient();

  if (!client) {
    const durationMs = Date.now() - startTime;
    const msg = "GEMINI_API_KEY is not set; using structured demo fallback.";
    console.warn(`[ArgonClient] ${opts.endpoint}: ${msg}`);
    return {
      ok: false,
      text: "",
      usedModel: primaryModel,
      fellBackModel: false,
      error: msg,
      modelLog: createModelLog({
        endpoint: opts.endpoint,
        model: primaryModel,
        sceneId: opts.sceneId,
        attempt: attemptNum,
        durationMs,
        status: "fallback",
        detail: msg,
      }),
    };
  }

  const modelsToTry = [
    primaryModel,
    ...FALLBACK_MODELS.filter((m) => m !== primaryModel),
  ];

  let lastErrorMsg = "";

  for (let i = 0; i < modelsToTry.length; i++) {
    const candidateModel = modelsToTry[i];
    const isFallbackAttempt = i > 0;

    try {
      const response = await withTimeout(
        client.models.generateContent({
          model: candidateModel,
          contents: opts.contents,
          config: {
            ...(opts.systemInstruction
              ? { systemInstruction: opts.systemInstruction }
              : {}),
            ...(opts.responseMimeType
              ? { responseMimeType: opts.responseMimeType }
              : {}),
            ...(opts.responseSchema
              ? { responseSchema: opts.responseSchema }
              : {}),
            temperature: opts.temperature ?? 0.2,
          },
        }),
        MODEL_CALL_TIMEOUT_MS,
        `${opts.endpoint}:${candidateModel}`
      );

      const text = response.text ?? "";
      const durationMs = Date.now() - startTime;

      if (!text.trim()) {
        throw new Error(`Empty text response from model ${candidateModel}`);
      }

      const detail = isFallbackAttempt
        ? `Primary model (${primaryModel}) unavailable (${lastErrorMsg.slice(0, 80)}); succeeded via compatible model (${candidateModel}).`
        : `Argon (${primaryModel}) call succeeded.`;

      return {
        ok: true,
        text,
        usedModel: candidateModel,
        fellBackModel: isFallbackAttempt,
        modelLog: createModelLog({
          endpoint: opts.endpoint,
          model: primaryModel,
          sceneId: opts.sceneId,
          attempt: attemptNum,
          durationMs,
          status: isFallbackAttempt ? "retry" : "ok",
          detail,
        }),
      };
    } catch (err) {
      lastErrorMsg = sanitizeErrorMessage(err);
      console.warn(
        `[ArgonClient] ${opts.endpoint} model=${candidateModel} failed: ${lastErrorMsg}`
      );
    }
  }

  const durationMs = Date.now() - startTime;
  return {
    ok: false,
    text: "",
    usedModel: primaryModel,
    fellBackModel: true,
    error: lastErrorMsg,
    modelLog: createModelLog({
      endpoint: opts.endpoint,
      model: primaryModel,
      sceneId: opts.sceneId,
      attempt: attemptNum,
      durationMs,
      status: "fallback",
      detail: `Model call failed (${lastErrorMsg.slice(0, 120)}); using structured fallback.`,
    }),
  };
}
