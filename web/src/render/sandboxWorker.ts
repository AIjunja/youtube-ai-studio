import type { PlannedScene } from "../../../shared/contract";

export interface WorkerRenderRequest {
  id: string;
  type: "validate-and-render" | "render-single-frame";
  code: string;
  scene: PlannedScene;
  width: number;
  height: number;
  testTimes?: number[];
  captureTime?: number;
}

export interface BlankFrameCheckResult {
  timeSec: number;
  passed: boolean;
  distinctColors: number;
  nonBgRatio: number;
  nonZeroAlphaRatio: number;
  reason?: string;
}

export interface WorkerRenderResponse {
  id: string;
  ok: boolean;
  error?: string;
  imageBase64?: string;
  bitmap?: ImageBitmap;
  frameChecks?: BlankFrameCheckResult[];
  renderDurationMs: number;
}

// Capture Function constructor before locking down Worker globals
const SafeFunction = Function;

// Harden Web Worker global environment against network/external access
const BLOCKED_GLOBALS = [
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "importScripts",
  "indexedDB",
  "caches",
  "BroadcastChannel",
  "Worker",
  "SharedWorker",
] as const;

for (const key of BLOCKED_GLOBALS) {
  try {
    Object.defineProperty(self, key, {
      value: undefined,
      writable: false,
      configurable: false,
    });
  } catch {
    try {
      (self as unknown as Record<string, unknown>)[key] = undefined;
    } catch {
      // Ignore if read-only in environment
    }
  }
}

function analyzeImageData(
  imageData: ImageData,
  timeSec: number
): BlankFrameCheckResult {
  const data = imageData.data;
  const totalPixels = imageData.width * imageData.height;
  // Sample every 4th pixel for fast, deterministic inspection
  const step = 4 * 4;
  let sampledCount = 0;
  let nonZeroAlpha = 0;
  const colorCounts = new Map<number, number>();
  let maxBucketCount = 0;

  for (let i = 0; i < data.length; i += step) {
    sampledCount++;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a > 16) {
      nonZeroAlpha++;
    }

    // Quantize into 16-level per channel bucket
    const bucket =
      ((r >> 4) << 12) | ((g >> 4) << 8) | ((b >> 4) << 4) | (a >> 4);
    const nextCount = (colorCounts.get(bucket) ?? 0) + 1;
    colorCounts.set(bucket, nextCount);
    if (nextCount > maxBucketCount) {
      maxBucketCount = nextCount;
    }
  }

  if (sampledCount === 0 || totalPixels === 0) {
    return {
      timeSec,
      passed: false,
      distinctColors: 0,
      nonBgRatio: 0,
      nonZeroAlphaRatio: 0,
      reason: "Canvas has zero sampled pixels",
    };
  }

  const distinctColors = colorCounts.size;
  const nonZeroAlphaRatio = nonZeroAlpha / sampledCount;
  const nonBgRatio = (sampledCount - maxBucketCount) / sampledCount;

  if (nonZeroAlphaRatio < 0.05) {
    return {
      timeSec,
      passed: false,
      distinctColors,
      nonBgRatio,
      nonZeroAlphaRatio,
      reason: `Blank transparent frame at t=${timeSec.toFixed(2)}s (alpha coverage ${(nonZeroAlphaRatio * 100).toFixed(1)}%)`,
    };
  }

  if (distinctColors < 2 || nonBgRatio < 0.004) {
    return {
      timeSec,
      passed: false,
      distinctColors,
      nonBgRatio,
      nonZeroAlphaRatio,
      reason: `Blank/uniform frame at t=${timeSec.toFixed(2)}s (distinctColors=${distinctColors}, foreground=${(nonBgRatio * 100).toFixed(2)}%)`,
    };
  }

  return {
    timeSec,
    passed: true,
    distinctColors,
    nonBgRatio,
    nonZeroAlphaRatio,
  };
}

async function arrayBufferToBase64Png(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...sub);
  }
  return `data:image/png;base64,${btoa(binary)}`;
}

self.onmessage = async (event: MessageEvent<WorkerRenderRequest>) => {
  const startMs = performance.now();
  const req = event.data;
  if (!req || !req.id) return;

  try {
    const width = Math.max(64, req.width || 960);
    const height = Math.max(64, req.height || 540);

    if (typeof OffscreenCanvas === "undefined") {
      throw new Error("OffscreenCanvas is not supported in this Worker context");
    }

    const drawFn = new SafeFunction(
      "ctx",
      "t",
      "w",
      "h",
      "scene",
      `"use strict";\n${req.code}`
    ) as (
      ctx: OffscreenCanvasRenderingContext2D,
      t: number,
      w: number,
      h: number,
      scene: PlannedScene
    ) => void;

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      throw new Error("Failed to acquire OffscreenCanvas 2D context");
    }

    const durationSec = Math.max(1.0, req.scene?.durationSec || 4.0);
    const captureTime =
      typeof req.captureTime === "number" ? req.captureTime : durationSec * 0.5;

    const testTimes =
      req.type === "render-single-frame"
        ? [captureTime]
        : req.testTimes && req.testTimes.length > 0
          ? req.testTimes
          : [0.5, Math.max(1.0, durationSec * 0.5)];

    const frameChecks: BlankFrameCheckResult[] = [];

    for (const t of testTimes) {
      ctx.save();
      ctx.clearRect(0, 0, width, height);
      try {
        drawFn(ctx, t, width, height, req.scene);
      } finally {
        ctx.restore();
      }

      const imageData = ctx.getImageData(0, 0, width, height);
      const check = analyzeImageData(imageData, t);
      frameChecks.push(check);

      if (!check.passed) {
        const resp: WorkerRenderResponse = {
          id: req.id,
          ok: false,
          error: check.reason || `Blank frame detected at t=${t.toFixed(2)}s`,
          frameChecks,
          renderDurationMs: Math.round(performance.now() - startMs),
        };
        self.postMessage(resp);
        return;
      }
    }

    // Render final representative keyframe at captureTime
    ctx.save();
    ctx.clearRect(0, 0, width, height);
    try {
      drawFn(ctx, captureTime, width, height, req.scene);
    } finally {
      ctx.restore();
    }

    const blob = await canvas.convertToBlob({ type: "image/png" });
    const arrayBuffer = await blob.arrayBuffer();
    const imageBase64 = await arrayBufferToBase64Png(arrayBuffer);
    let bitmap: ImageBitmap | undefined;
    try {
      bitmap = canvas.transferToImageBitmap();
    } catch {
      bitmap = undefined;
    }

    const resp: WorkerRenderResponse = {
      id: req.id,
      ok: true,
      imageBase64,
      ...(bitmap ? { bitmap } : {}),
      frameChecks,
      renderDurationMs: Math.round(performance.now() - startMs),
    };
    if (bitmap) {
      (self as unknown as DedicatedWorkerGlobalScope).postMessage(resp, [bitmap]);
    } else {
      self.postMessage(resp);
    }
  } catch (err) {
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    const resp: WorkerRenderResponse = {
      id: req.id,
      ok: false,
      error: message,
      renderDurationMs: Math.round(performance.now() - startMs),
    };
    self.postMessage(resp);
  }
};
