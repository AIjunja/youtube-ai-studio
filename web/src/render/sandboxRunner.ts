import type { PlannedScene } from "../../../shared/contract";
import type {
  BlankFrameCheckResult,
  WorkerRenderRequest,
  WorkerRenderResponse,
} from "./sandboxWorker";

export const SANDBOX_FRAME_TIMEOUT_MS = 2000;

export const FORBIDDEN_IDENTIFIERS = [
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "importScripts",
  "eval",
  "Function",
  "document",
  "window",
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "navigator",
  "Worker",
  "SharedWorker",
  "ServiceWorker",
  "postMessage",
  "globalThis",
  "self",
  "top",
  "parent",
  "frames",
  "location",
  "history",
  "cookie",
] as const;

export interface StaticValidationResult {
  valid: boolean;
  reason?: string;
  forbiddenIdentifier?: string;
  normalizedCode: string;
}

export interface SandboxRunOptions {
  code: string;
  scene: PlannedScene;
  width?: number;
  height?: number;
  testTimes?: number[];
  captureTime?: number;
  timeoutMs?: number;
}

export interface SandboxRunResult {
  ok: boolean;
  normalizedCode: string;
  error?: string;
  timedOut?: boolean;
  imageBase64?: string;
  bitmap?: ImageBitmap;
  frameChecks?: BlankFrameCheckResult[];
  renderDurationMs: number;
}

/**
 * Strips Markdown code fences and outer `function draw(...) { ... }` wrapper if present,
 * returning the pure function body expected by `draw(ctx, t, w, h, scene)`.
 */
export function normalizeSceneCodeBody(rawCode: string): string {
  let code = (rawCode ?? "").trim();

  // Strip markdown code block fences if present
  const fenceMatch = code.match(/^```(?:javascript|typescript|js|ts)?\s*\n([\s\S]*?)\n```$/i);
  if (fenceMatch) {
    code = fenceMatch[1].trim();
  }

  // Strip outer `function draw(ctx, t, w, h, scene) { ... }` if Argon included the signature
  const fnMatch = code.match(
    /^(?:export\s+)?function\s+draw\s*\([^)]*\)\s*\{([\s\S]*)\}\s*;?$/
  );
  if (fnMatch) {
    code = fnMatch[1].trim();
  }

  return code;
}

/**
 * Strips comments and string literals so identifier scanning does not false-positive
 * on text inside `ctx.fillText("window...")`, while still catching all actual code identifiers.
 */
function stripCommentsAndStrings(code: string): string {
  return code
    // Remove multi-line comments
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    // Remove single-line comments
    .replace(/\/\/[^\n]*/g, " ")
    // Remove double-quoted strings
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    // Remove single-quoted strings
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    // Remove simple template literal static segments (preserve ${...} expressions)
    .replace(/`(?:\\.|[^`$\\])*`/g, "``");
}

/**
 * Static security check before code is sent to the Web Worker.
 * Rejects forbidden network, DOM, storage, and dynamic code evaluation identifiers.
 */
export function validateSceneCodeStatic(rawCode: string): StaticValidationResult {
  const normalizedCode = normalizeSceneCodeBody(rawCode);

  if (!normalizedCode || normalizedCode.length < 10) {
    return {
      valid: false,
      reason: "Scene code is empty or too short to render a valid frame",
      normalizedCode,
    };
  }

  const stripped = stripCommentsAndStrings(normalizedCode);

  for (const ident of FORBIDDEN_IDENTIFIERS) {
    const regex = new RegExp(`\\b${ident}\\b`);
    if (regex.test(stripped)) {
      return {
        valid: false,
        reason: `Forbidden identifier "${ident}" is not allowed in sandboxed Canvas 2D scene code`,
        forbiddenIdentifier: ident,
        normalizedCode,
      };
    }
  }

  // Check for dynamic import()
  if (/\bimport\s*\(/.test(stripped)) {
    return {
      valid: false,
      reason: 'Dynamic "import()" is not allowed in sandboxed Canvas 2D scene code',
      forbiddenIdentifier: "import",
      normalizedCode,
    };
  }

  // Verify basic JS syntax without executing it
  try {
    new Function("ctx", "t", "w", "h", "scene", `"use strict";\n${normalizedCode}`);
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return {
      valid: false,
      reason: `SyntaxError in scene code: ${msg}`,
      normalizedCode,
    };
  }

  return {
    valid: true,
    normalizedCode,
  };
}

/**
 * Executes and validates `draw(ctx, t, w, h, scene)` inside an isolated Web Worker + OffscreenCanvas.
 * Enforces a strict 2000ms timeout (`worker.terminate()` on overrun) and performs blank-frame pixel analysis
 * at `t = 0.5` and `t = Math.max(1.0, scene.durationSec * 0.5)`.
 */
export async function validateAndRenderInSandbox(
  options: SandboxRunOptions
): Promise<SandboxRunResult> {
  const startMs = performance.now();
  const staticResult = validateSceneCodeStatic(options.code);

  if (!staticResult.valid) {
    return {
      ok: false,
      normalizedCode: staticResult.normalizedCode,
      error: staticResult.reason || "Static validation failed",
      renderDurationMs: Math.round(performance.now() - startMs),
    };
  }

  const width = options.width ?? 960;
  const height = options.height ?? 540;
  const durationSec = Math.max(1.0, options.scene.durationSec || 4.0);
  const captureTime = options.captureTime ?? durationSec * 0.5;
  const testTimes = options.testTimes ?? [
    0.5,
    Math.max(1.0, durationSec * 0.5),
  ];
  const timeoutMs = options.timeoutMs ?? SANDBOX_FRAME_TIMEOUT_MS;

  return new Promise<SandboxRunResult>((resolve) => {
    let settled = false;
    let worker: Worker | null = null;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      if (worker) {
        worker.terminate();
        worker = null;
      }
      resolve({
        ok: false,
        normalizedCode: staticResult.normalizedCode,
        error: "Frame render timed out (>2000ms)",
        timedOut: true,
        renderDurationMs: timeoutMs,
      });
    }, timeoutMs);

    try {
      worker = new Worker(new URL("./sandboxWorker.ts", import.meta.url), {
        type: "module",
      });
    } catch (err) {
      clearTimeout(timer);
      settled = true;
      const msg = err instanceof Error ? err.message : String(err);
      resolve({
        ok: false,
        normalizedCode: staticResult.normalizedCode,
        error: `Failed to initialize sandbox Worker: ${msg}`,
        renderDurationMs: Math.round(performance.now() - startMs),
      });
      return;
    }

    const reqId = `sandbox-${options.scene.id}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;

    worker.onmessage = (event: MessageEvent<WorkerRenderResponse>) => {
      if (settled) return;
      const data = event.data;
      if (!data || data.id !== reqId) return;

      settled = true;
      clearTimeout(timer);
      worker?.terminate();
      worker = null;

      if (!data.ok) {
        resolve({
          ok: false,
          normalizedCode: staticResult.normalizedCode,
          error: data.error || "Unknown sandbox worker error",
          frameChecks: data.frameChecks,
          renderDurationMs: data.renderDurationMs,
        });
        return;
      }

      resolve({
        ok: true,
        normalizedCode: staticResult.normalizedCode,
        imageBase64: data.imageBase64,
        bitmap: data.bitmap,
        frameChecks: data.frameChecks,
        renderDurationMs: data.renderDurationMs,
      });
    };

    worker.onerror = (event: ErrorEvent) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker?.terminate();
      worker = null;

      resolve({
        ok: false,
        normalizedCode: staticResult.normalizedCode,
        error: event.message || "Unhandled Worker runtime error",
        renderDurationMs: Math.round(performance.now() - startMs),
      });
    };

    const payload: WorkerRenderRequest = {
      id: reqId,
      type: "validate-and-render",
      code: staticResult.normalizedCode,
      scene: options.scene,
      width,
      height,
      testTimes,
      captureTime,
    };

    worker.postMessage(payload);
  });
}

/**
 * Renders a single frame at `timeSec` inside the isolated Web Worker + OffscreenCanvas
 * with a strict 2000ms timeout.
 */
export async function renderFrameInWorker(
  code: string,
  scene: PlannedScene,
  timeSec: number,
  width = 960,
  height = 540,
  timeoutMs = SANDBOX_FRAME_TIMEOUT_MS
): Promise<SandboxRunResult> {
  return validateAndRenderInSandbox({
    code,
    scene,
    width,
    height,
    testTimes: [timeSec],
    captureTime: timeSec,
    timeoutMs,
  });
}
