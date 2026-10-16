import type {
  PlannedScene,
  SceneCode,
  ScenePlan,
  TimeRange,
} from "../../../shared/contract";
import {
  createMotionKit,
  drawWrappedText,
  ensureMotionFontsLoaded,
  MOTION_DESIGN,
  type MotionKit,
} from "./motionKit";
import { validateSceneCodeStatic } from "./sandboxRunner";
import { drawTemplateFallback } from "./templates";

export interface TimelineSceneEntry {
  index: number;
  scene: PlannedScene;
  globalStart: number;
  globalEnd: number;
  durationSec: number;
  sourceRange?: TimeRange;
}

export interface CompositeTimeline {
  totalDurationSec: number;
  entries: TimelineSceneEntry[];
}

export interface ActiveTimelineLookup {
  entry: TimelineSceneEntry;
  localTimeSec: number;
  sceneProgress: number;
  sourceVideoTimeSec?: number;
}

export interface RenderCompositeFrameParams {
  ctx: CanvasRenderingContext2D;
  globalTimeSec: number;
  width: number;
  height: number;
  plan: ScenePlan;
  sceneCodes: Record<string, SceneCode>;
  videoElement?: HTMLVideoElement | null;
  subtitlesEnabled?: boolean;
  showVerificationBadge?: boolean;
}

export interface ExportVideoOptions {
  plan: ScenePlan;
  sceneCodes: Record<string, SceneCode>;
  videoElement?: HTMLVideoElement | null;
  width?: number;
  height?: number;
  fps?: number;
  subtitlesEnabled?: boolean;
  onProgress?: (percent: number, currentSceneId: string) => void;
  signal?: AbortSignal;
}

export interface ExportVideoResult {
  blob: Blob;
  url: string;
  mimeType: string;
  filename: string;
  durationSec: number;
}

export interface SampleVideoResult {
  file: File;
  blob: Blob;
  url: string;
  mimeType: string;
  durationSec: number;
}

type CompiledDrawFn = (
  ctx: CanvasRenderingContext2D,
  t: number,
  w: number,
  h: number,
  scene: PlannedScene,
  kit: MotionKit
) => void;

const compiledCodeCache = new Map<string, CompiledDrawFn | null>();

function getCompiledDrawFn(code: string): CompiledDrawFn | null {
  if (compiledCodeCache.has(code)) {
    return compiledCodeCache.get(code) ?? null;
  }
  const check = validateSceneCodeStatic(code);
  if (!check.valid) {
    compiledCodeCache.set(code, null);
    return null;
  }
  try {
    const fn = new Function(
      "ctx",
      "t",
      "w",
      "h",
      "scene",
      "kit",
      `"use strict";\n${check.normalizedCode}`
    ) as CompiledDrawFn;
    compiledCodeCache.set(code, fn);
    return fn;
  } catch {
    compiledCodeCache.set(code, null);
    return null;
  }
}

/**
 * Computes the sequential composite timeline across all scenes (`original`, `motion`, `ending`).
 */
export function buildTimeline(plan: ScenePlan): CompositeTimeline {
  let cursor = 0;
  const entries: TimelineSceneEntry[] = (plan.scenes || []).map(
    (scene, index) => {
      const dur = Math.max(
        0.5,
        Number.isFinite(scene.durationSec) && scene.durationSec > 0
          ? scene.durationSec
          : scene.sourceRange
            ? Math.max(0.5, scene.sourceRange.end - scene.sourceRange.start)
            : 3.5
      );
      const globalStart = cursor;
      const globalEnd = Number((cursor + dur).toFixed(3));
      cursor = globalEnd;

      return {
        index,
        scene,
        globalStart,
        globalEnd,
        durationSec: dur,
        sourceRange: scene.sourceRange,
      };
    }
  );

  return {
    totalDurationSec: Math.max(0.5, cursor),
    entries,
  };
}

/**
 * Finds the active scene entry at `globalTimeSec` and maps to local scene time & source video time.
 */
export function findTimelineEntryAt(
  timeline: CompositeTimeline,
  globalTimeSec: number
): ActiveTimelineLookup | null {
  if (timeline.entries.length === 0) return null;

  const clamped = Math.max(
    0,
    Math.min(timeline.totalDurationSec - 0.001, globalTimeSec)
  );

  const entry =
    timeline.entries.find(
      (e) => clamped >= e.globalStart && clamped < e.globalEnd
    ) ?? timeline.entries[timeline.entries.length - 1];

  const localTimeSec = Math.max(
    0,
    Math.min(entry.durationSec, clamped - entry.globalStart)
  );
  const sceneProgress =
    entry.durationSec > 0 ? Math.min(1, localTimeSec / entry.durationSec) : 0;

  let sourceVideoTimeSec: number | undefined;
  if (entry.scene.kind === "original") {
    if (entry.sourceRange) {
      sourceVideoTimeSec = Math.min(
        entry.sourceRange.end,
        entry.sourceRange.start + localTimeSec
      );
    } else {
      sourceVideoTimeSec = localTimeSec;
    }
  }

  return {
    entry,
    localTimeSec,
    sceneProgress,
    sourceVideoTimeSec,
  };
}

function drawVideoCover(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  w: number,
  h: number
): void {
  const vw = video.videoWidth || w;
  const vh = video.videoHeight || h;
  const scale = Math.max(w / vw, h / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  const dx = (w - dw) * 0.5;
  const dy = (h - dh) * 0.5;
  ctx.drawImage(video, dx, dy, dw, dh);
}

/**
 * Renders a clean studio presenter silhouette frame when an external `<video>` element is not yet loaded.
 * Contains zero internal debug strings or timestamps.
 */
function drawSimulatedCreatorCamera(
  ctx: CanvasRenderingContext2D,
  localTimeSec: number,
  w: number,
  h: number
): void {
  const s = w / 1920;

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, "#14171F");
  grad.addColorStop(1, "#232936");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const radial = ctx.createRadialGradient(
    w * 0.5,
    h * 0.42,
    40 * s,
    w * 0.5,
    h * 0.42,
    560 * s
  );
  radial.addColorStop(0, "rgba(215, 255, 58, 0.14)");
  radial.addColorStop(1, "rgba(215, 255, 58, 0)");
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, w, h);

  // Subtle camera frame corners
  ctx.strokeStyle = "rgba(250, 250, 248, 0.25)";
  ctx.lineWidth = Math.max(2, 4 * s);
  const padX = 120 * s;
  const padY = 96 * s;
  const corner = 40 * s;

  ctx.beginPath();
  ctx.moveTo(padX, padY + corner);
  ctx.lineTo(padX, padY);
  ctx.lineTo(padX + corner, padY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(w - padX - corner, padY);
  ctx.lineTo(w - padX, padY);
  ctx.lineTo(w - padX, padY + corner);
  ctx.stroke();

  // Center presenter silhouette + animated voice ring
  const cx = w * 0.5;
  const cy = h * 0.42;
  const pulse = 1 + Math.sin(localTimeSec * 8) * 0.04;

  ctx.save();
  ctx.strokeStyle = MOTION_DESIGN.colors.lime;
  ctx.lineWidth = Math.max(2, 5 * s);
  ctx.beginPath();
  ctx.arc(cx, cy - 30 * s, 118 * s * pulse, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#344054";
  ctx.beginPath();
  ctx.arc(cx, cy - 38 * s, 72 * s, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy + 165 * s, 155 * s, Math.PI * 1.15, Math.PI * 1.85);
  ctx.fill();
  ctx.restore();

  // Voice waveform bars
  const barCount = 15;
  const barW = 12 * s;
  const barGap = 8 * s;
  const totalBarW = barCount * barW + (barCount - 1) * barGap;
  const startBarX = cx - totalBarW * 0.5;
  const baseBarY = h * 0.65;

  for (let i = 0; i < barCount; i++) {
    const wave =
      0.25 +
      0.75 *
        Math.abs(
          Math.sin(localTimeSec * 10 + i * 0.65) *
            Math.cos(localTimeSec * 4 - i * 0.3)
        );
    const bh = (18 + wave * 48) * s;
    ctx.fillStyle =
      i % 3 === 0 ? MOTION_DESIGN.colors.lime : "rgba(250, 250, 248, 0.75)";
    ctx.fillRect(
      startBarX + i * (barW + barGap),
      baseBarY - bh * 0.5,
      barW,
      bh
    );
  }
}

/**
 * Renders the broadcast Ink (#0E0E10) + Lime (#D7FF3A) subtitle bar at the bottom of the frame.
 * Auto-wraps Korean text cleanly and never renders internal debug badges.
 */
export function drawSubtitleOverlay(
  ctx: CanvasRenderingContext2D,
  text: string,
  w: number,
  h: number,
  _badgeLabel?: string
): void {
  const clean = (text || "").trim();
  if (!clean) return;

  const s = w / 1920;
  ctx.save();

  const barW = Math.min(w - 240 * s, 1520 * s);
  const barH = 118 * s;
  const bx = (w - barW) * 0.5;
  const by = h - 96 * s - barH;

  ctx.fillStyle = "rgba(14, 14, 16, 0.94)";
  ctx.fillRect(bx, by, barW, barH);

  ctx.fillStyle = MOTION_DESIGN.colors.lime;
  ctx.fillRect(bx, by, 14 * s, barH);

  drawWrappedText(ctx, clean, bx + 44 * s, by + 26 * s, {
    maxWidth: barW - 80 * s,
    fontSize: Math.round(44 * s),
    minFontSize: Math.round(34 * s),
    fontFamily: MOTION_DESIGN.fonts.bold,
    fontWeight: 700,
    color: MOTION_DESIGN.colors.bgLight,
    maxLines: 2,
  });

  ctx.restore();
}

/**
 * Resolves the active transcript line or scene caption for a given source video timestamp.
 */
function resolveSubtitleText(
  plan: ScenePlan,
  scene: PlannedScene,
  sourceVideoTimeSec?: number
): string {
  if (
    scene.kind === "original" &&
    typeof sourceVideoTimeSec === "number" &&
    Array.isArray(plan.transcript)
  ) {
    const seg = plan.transcript.find(
      (t) =>
        sourceVideoTimeSec >= t.start - 0.15 &&
        sourceVideoTimeSec <= t.end + 0.15
    );
    if (seg && seg.text) {
      return seg.text;
    }
  }
  return scene.script || scene.caption || "";
}

/**
 * Renders a single composite frame at `globalTimeSec` onto `ctx`.
 * Handles `original` video keep segments, `motion` scenes, `ending` cards, and subtitles.
 */
export function renderCompositeFrame(
  params: RenderCompositeFrameParams
): ActiveTimelineLookup | null {
  const {
    ctx,
    globalTimeSec,
    width,
    height,
    plan,
    sceneCodes,
    videoElement,
    subtitlesEnabled = true,
  } = params;

  const timeline = buildTimeline(plan);
  const lookup = findTimelineEntryAt(timeline, globalTimeSec);
  if (!lookup) {
    ctx.fillStyle = MOTION_DESIGN.colors.ink;
    ctx.fillRect(0, 0, width, height);
    return null;
  }

  const { entry, localTimeSec, sourceVideoTimeSec } = lookup;
  const scene = entry.scene;

  ctx.save();
  ctx.clearRect(0, 0, width, height);

  if (scene.kind === "original") {
    const canDrawVideo =
      videoElement &&
      videoElement.readyState >= 2 &&
      videoElement.videoWidth > 0 &&
      videoElement.videoHeight > 0;

    if (canDrawVideo) {
      drawVideoCover(ctx, videoElement, width, height);
    } else {
      drawSimulatedCreatorCamera(ctx, localTimeSec, width, height);
    }

    if (subtitlesEnabled) {
      const subText = resolveSubtitleText(plan, scene, sourceVideoTimeSec);
      drawSubtitleOverlay(ctx, subText, width, height);
    }
  } else {
    const codeObj = sceneCodes[scene.id];
    const compiledFn = codeObj?.code ? getCompiledDrawFn(codeObj.code) : null;
    const kit = createMotionKit(ctx, localTimeSec, width, height, scene);

    if (compiledFn) {
      try {
        ctx.save();
        compiledFn(ctx, localTimeSec, width, height, scene, kit);
        ctx.restore();
      } catch {
        ctx.restore();
        drawTemplateFallback(ctx, localTimeSec, width, height, scene);
      }
    } else {
      drawTemplateFallback(ctx, localTimeSec, width, height, scene);
    }

    if (subtitlesEnabled && scene.kind === "motion" && scene.script) {
      drawSubtitleOverlay(ctx, scene.script, width, height);
    }
  }

  ctx.restore();
  return lookup;
}

/**
 * Selects the best supported MediaRecorder video MIME type (`video/mp4` preferred, `video/webm` fallback).
 */
export function selectSupportedVideoMimeType(): {
  mimeType: string;
  extension: "mp4" | "webm";
} {
  const candidates: Array<{ mimeType: string; extension: "mp4" | "webm" }> = [
    { mimeType: "video/mp4;codecs=avc1.42E01E,mp4a.40.2", extension: "mp4" },
    { mimeType: "video/mp4;codecs=avc1", extension: "mp4" },
    { mimeType: "video/mp4", extension: "mp4" },
    { mimeType: "video/webm;codecs=vp9,opus", extension: "webm" },
    { mimeType: "video/webm;codecs=vp9", extension: "webm" },
    { mimeType: "video/webm;codecs=vp8,opus", extension: "webm" },
    { mimeType: "video/webm;codecs=vp8", extension: "webm" },
    { mimeType: "video/webm", extension: "webm" },
  ];

  if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported) {
    for (const item of candidates) {
      try {
        if (MediaRecorder.isTypeSupported(item.mimeType)) {
          return item;
        }
      } catch {
        // Ignore unsupported query
      }
    }
  }

  return { mimeType: "video/webm", extension: "webm" };
}

function decodeBase64ToArrayBuffer(base64OrDataUrl: string): ArrayBuffer {
  const commaIdx = base64OrDataUrl.indexOf(",");
  const cleanBase64 =
    commaIdx >= 0 ? base64OrDataUrl.slice(commaIdx + 1) : base64OrDataUrl;
  const binary = atob(cleanBase64.trim());
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function decodeSceneAudioBuffers(
  audioCtx: AudioContext,
  scenes: PlannedScene[]
): Promise<Map<string, AudioBuffer>> {
  const map = new Map<string, AudioBuffer>();

  for (const scene of scenes) {
    if (!scene.audioBase64 && !scene.audioUrl) continue;
    try {
      let arrayBuf: ArrayBuffer | null = null;
      if (scene.audioBase64) {
        arrayBuf = decodeBase64ToArrayBuffer(scene.audioBase64);
      } else if (scene.audioUrl) {
        const res = await fetch(scene.audioUrl);
        if (res.ok) {
          arrayBuf = await res.arrayBuffer();
        }
      }
      if (arrayBuf && arrayBuf.byteLength > 0) {
        const decoded = await audioCtx.decodeAudioData(arrayBuf.slice(0));
        map.set(scene.id, decoded);
      }
    } catch {
      // Ignore undecodable scene TTS buffer and continue
    }
  }

  return map;
}

/**
 * Clones a dedicated hidden `<video>` element for export when a source `<video>` is provided,
 * preventing `createMediaElementSource` conflicts with the live preview DOM element.
 */
async function createExportVideoElement(
  sourceVideo?: HTMLVideoElement | null
): Promise<HTMLVideoElement | null> {
  const src = sourceVideo?.currentSrc || sourceVideo?.src;
  if (!src) return null;

  return new Promise<HTMLVideoElement | null>((resolve) => {
    const vid = document.createElement("video");
    vid.src = src;
    vid.crossOrigin = "anonymous";
    vid.playsInline = true;
    vid.muted = false;
    vid.volume = 1;
    vid.preload = "auto";

    const cleanup = () => {
      vid.onloadeddata = null;
      vid.onerror = null;
    };

    const timer = setTimeout(() => {
      cleanup();
      resolve(vid.readyState >= 1 ? vid : sourceVideo ?? null);
    }, 2500);

    vid.onloadeddata = () => {
      clearTimeout(timer);
      cleanup();
      resolve(vid);
    };

    vid.onerror = () => {
      clearTimeout(timer);
      cleanup();
      resolve(sourceVideo ?? null);
    };

    vid.load();
  });
}

/**
 * Exports the full composite sequence (`plan` + `sceneCodes`) at 1920x1080 (30fps)
 * into a downloadable video `Blob` and URL with real audio synthesis:
 * - Original `<video>` audio during `original` scenes
 * - Decoded TTS `AudioBuffer` (`scene.audioBase64` / `scene.audioUrl`) during `motion`/`ending` scenes
 * - Broadcast `DynamicsCompressorNode` (-14dB threshold, knee 6, ratio 12, attack 0.003, release 0.15)
 * - Soft -28dB ambient studio bed ducked under voice
 * - Real-time frame cadence matching `timeline.totalDurationSec` (±0.3s)
 */
export async function exportCompositeVideo(
  options: ExportVideoOptions
): Promise<ExportVideoResult> {
  await ensureMotionFontsLoaded();

  const width = options.width ?? 1920;
  const height = options.height ?? 1080;
  const fps = options.fps ?? 30;
  const subtitlesEnabled = options.subtitlesEnabled ?? true;

  const timeline = buildTimeline(options.plan);
  const totalDurationSec = timeline.totalDurationSec;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not create 2D context for video export");
  }

  const { mimeType, extension } = selectSupportedVideoMimeType();
  const stream = canvas.captureStream(fps);

  // Set up WebAudio mixing & broadcast compressor pipeline
  let audioCtx: AudioContext | null = null;
  let compressor: DynamicsCompressorNode | null = null;
  let videoGain: GainNode | null = null;
  let padOscA: OscillatorNode | null = null;
  let padOscB: OscillatorNode | null = null;
  let sceneAudioBuffers = new Map<string, AudioBuffer>();
  const activeBufferNodes: AudioBufferSourceNode[] = [];

  const exportVideoEl = await createExportVideoElement(options.videoElement);

  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (AudioCtx) {
      audioCtx = new AudioCtx();
      if (audioCtx.state === "suspended") {
        await audioCtx.resume().catch(() => {});
      }

      const dest = audioCtx.createMediaStreamDestination();
      compressor = audioCtx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-14, audioCtx.currentTime);
      compressor.knee.setValueAtTime(6, audioCtx.currentTime);
      compressor.ratio.setValueAtTime(12, audioCtx.currentTime);
      compressor.attack.setValueAtTime(0.003, audioCtx.currentTime);
      compressor.release.setValueAtTime(0.15, audioCtx.currentTime);
      compressor.connect(dest);

      // Connect export video element audio if cloned element is distinct from live preview element
      if (exportVideoEl && exportVideoEl !== options.videoElement) {
        try {
          const mediaSource = audioCtx.createMediaElementSource(exportVideoEl);
          videoGain = audioCtx.createGain();
          videoGain.gain.setValueAtTime(1.0, audioCtx.currentTime);
          mediaSource.connect(videoGain);
          videoGain.connect(compressor);
        } catch {
          // Ignore if browser blocks MediaElementSource on this stream
        }
      }

      // Soft -28dB (gain ~0.039) warm ambient bed so stream always has continuous broadcast audio
      const padFilter = audioCtx.createBiquadFilter();
      padFilter.type = "lowpass";
      padFilter.frequency.setValueAtTime(320, audioCtx.currentTime);

      const padGain = audioCtx.createGain();
      padGain.gain.setValueAtTime(0.038, audioCtx.currentTime); // ~ -28dB

      padOscA = audioCtx.createOscillator();
      padOscB = audioCtx.createOscillator();
      padOscA.type = "triangle";
      padOscB.type = "sine";
      padOscA.frequency.setValueAtTime(130.81, audioCtx.currentTime); // C3
      padOscB.frequency.setValueAtTime(196.0, audioCtx.currentTime); // G3

      padOscA.connect(padFilter);
      padOscB.connect(padFilter);
      padFilter.connect(padGain);
      padGain.connect(compressor);
      padOscA.start();
      padOscB.start();

      // Decode any motion/ending TTS audio buffers
      sceneAudioBuffers = await decodeSceneAudioBuffers(
        audioCtx,
        options.plan.scenes || []
      );

      const audioTrack = dest.stream.getAudioTracks()[0];
      if (audioTrack) {
        stream.addTrack(audioTrack);
      }
    }
  } catch {
    // Proceed with video stream if AudioContext initialization fails
  }

  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 6_000_000,
  });

  recorder.ondataavailable = (e: BlobEvent) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  const stoppedPromise = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      const finalBlob = new Blob(chunks, { type: mimeType });
      resolve(finalBlob);
    };
    recorder.onerror = (ev) => {
      reject(new Error(`MediaRecorder error: ${String(ev)}`));
    };
  });

  recorder.start(100);

  const frameIntervalMs = Math.round(1000 / fps);
  const startWallMs = performance.now();
  let lastSceneId = "";
  const triggeredSceneTts = new Set<string>();

  try {
    while (true) {
      if (options.signal?.aborted) {
        throw new Error("Video export aborted");
      }

      const elapsedSec = (performance.now() - startWallMs) / 1000;
      const globalTimeSec = Math.min(totalDurationSec, elapsedSec);
      const lookup = findTimelineEntryAt(timeline, globalTimeSec);
      const currentScene = lookup?.entry.scene;
      const currentSceneId = currentScene?.id ?? "";

      // Handle scene transitions for audio & video playback
      if (currentScene && currentSceneId !== lastSceneId) {
        lastSceneId = currentSceneId;

        if (currentScene.kind === "original") {
          if (exportVideoEl) {
            const targetStart =
              lookup?.sourceVideoTimeSec ??
              currentScene.sourceRange?.start ??
              0;
            try {
              if (Math.abs(exportVideoEl.currentTime - targetStart) > 0.08) {
                exportVideoEl.currentTime = targetStart;
              }
              if (videoGain && audioCtx) {
                videoGain.gain.setTargetAtTime(1.0, audioCtx.currentTime, 0.02);
              }
              exportVideoEl.muted = false;
              await exportVideoEl.play().catch(() => {});
            } catch {
              // Ignore seek/play errors on unbuffered streams
            }
          }
        } else {
          // Motion or Ending scene: pause original video audio and play decoded TTS buffer if present
          if (exportVideoEl) {
            try {
              if (videoGain && audioCtx) {
                videoGain.gain.setTargetAtTime(0.0, audioCtx.currentTime, 0.02);
              }
              exportVideoEl.pause();
            } catch {
              // Ignore pause errors
            }
          }

          if (
            audioCtx &&
            compressor &&
            !triggeredSceneTts.has(currentSceneId)
          ) {
            triggeredSceneTts.add(currentSceneId);
            const ttsBuffer = sceneAudioBuffers.get(currentSceneId);
            if (ttsBuffer) {
              try {
                const sourceNode = audioCtx.createBufferSource();
                sourceNode.buffer = ttsBuffer;
                const ttsGain = audioCtx.createGain();
                ttsGain.gain.setValueAtTime(1.0, audioCtx.currentTime);
                sourceNode.connect(ttsGain);
                ttsGain.connect(compressor);
                sourceNode.start(audioCtx.currentTime);
                activeBufferNodes.push(sourceNode);
              } catch {
                // Ignore TTS playback error
              }
            }
          }
        }
      }

      // Keep original video synced if drift exceeds 0.18s
      if (
        exportVideoEl &&
        currentScene?.kind === "original" &&
        typeof lookup?.sourceVideoTimeSec === "number"
      ) {
        const targetVidTime = lookup.sourceVideoTimeSec;
        if (Math.abs(exportVideoEl.currentTime - targetVidTime) > 0.18) {
          try {
            exportVideoEl.currentTime = targetVidTime;
          } catch {
            // Ignore seek errors
          }
        }
      }

      renderCompositeFrame({
        ctx,
        globalTimeSec,
        width,
        height,
        plan: options.plan,
        sceneCodes: options.sceneCodes,
        videoElement: exportVideoEl ?? options.videoElement,
        subtitlesEnabled,
        showVerificationBadge: false,
      });

      const percent = Math.min(
        100,
        Math.round((globalTimeSec / totalDurationSec) * 100)
      );
      options.onProgress?.(percent, currentSceneId);

      if (elapsedSec >= totalDurationSec) {
        break;
      }

      await new Promise((r) => setTimeout(r, frameIntervalMs));
    }
  } finally {
    if (exportVideoEl && exportVideoEl !== options.videoElement) {
      try {
        exportVideoEl.pause();
        exportVideoEl.src = "";
      } catch {
        // Ignore cleanup errors
      }
    }
    for (const node of activeBufferNodes) {
      try {
        node.stop();
      } catch {
        // Ignore stop errors
      }
    }
    try {
      padOscA?.stop();
      padOscB?.stop();
    } catch {
      // Ignore oscillator stop errors
    }
  }

  if (recorder.state !== "inactive") {
    recorder.stop();
  }
  stream.getTracks().forEach((t) => t.stop());

  const blob = await stoppedPromise;
  if (audioCtx) {
    try {
      await audioCtx.close();
    } catch {
      // Ignore close error
    }
  }

  const url = URL.createObjectURL(blob);
  const filename = `youtube-ai-studio-export-${Date.now()}.${extension}`;

  return {
    blob,
    url,
    mimeType,
    filename,
    durationSec: totalDurationSec,
  };
}

/**
 * Generates an on-the-fly real recorded sample creator video (`File` & `Blob`)
 * containing an initial NG clap take (0–2s), core speaking segment 1 (2–6.4s),
 * silence pause (6.4–8.2s), and core speaking segment 2 (8.2–10s+).
 */
export async function createSampleInputVideoBlob(options?: {
  durationSec?: number;
  width?: number;
  height?: number;
  fps?: number;
  onProgress?: (percent: number) => void;
}): Promise<SampleVideoResult> {
  await ensureMotionFontsLoaded();

  const durationSec = options?.durationSec ?? 6.0;
  const width = options?.width ?? 1920;
  const height = options?.height ?? 1080;
  const fps = options?.fps ?? 24;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to create 2D context for sample input video");
  }

  const { mimeType, extension } = selectSupportedVideoMimeType();
  const stream = canvas.captureStream(fps);

  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 4_000_000,
  });

  recorder.ondataavailable = (e: BlobEvent) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  const stopped = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    recorder.onerror = (err) => reject(err);
  });

  recorder.start(100);

  const totalFrames = Math.max(1, Math.ceil(durationSec * fps));
  const s = width / 1920;

  for (let i = 0; i <= totalFrames; i++) {
    const t = (i / totalFrames) * 16.0;
    const isNg = t < 2.0;
    const isSilence = t >= 6.4 && t < 8.2;

    ctx.fillStyle = isNg ? "#2C1818" : isSilence ? "#1C2026" : "#141A24";
    ctx.fillRect(0, 0, width, height);

    const cx = width * 0.5;
    const cy = height * 0.45;
    ctx.fillStyle = "#344054";
    ctx.beginPath();
    ctx.arc(cx, cy - 30 * s, 70 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy + 160 * s, 150 * s, Math.PI * 1.15, Math.PI * 1.85);
    ctx.fill();

    const cue = isNg
      ? "(박수) 아 잠깐만요, 다시 갈게요."
      : t < 6.4
        ? "많은 분들이 AI 자동화를 시도하다가 첫 단계에서 바로 막힙니다."
        : isSilence
          ? "..."
          : t < 13.0
            ? "그냥 프롬프트 한 줄 넣는다고 끝나는 게 아니라 검증 루프가 핵심이거든요."
            : "어떻게 세팅하는지 지금 바로 보여드릴게요.";

    drawSubtitleOverlay(ctx, cue, width, height);

    options?.onProgress?.(Math.min(100, Math.round((i / totalFrames) * 100)));
    await new Promise((r) => setTimeout(r, 15));
  }

  recorder.stop();
  stream.getTracks().forEach((tr) => tr.stop());

  const blob = await stopped;
  const filename = `creator-raw-take.${extension}`;
  const file = new File([blob], filename, { type: mimeType });
  const url = URL.createObjectURL(blob);

  return {
    file,
    blob,
    url,
    mimeType,
    durationSec,
  };
}
