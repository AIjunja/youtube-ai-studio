import type {
  PlannedScene,
  SceneCode,
  ScenePlan,
  TimeRange,
} from "../../../shared/contract";
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
  scene: PlannedScene
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
 * Renders a studio camera simulation frame when an actual `<video>` element is not loaded
 * or during instant mock previews.
 */
function drawSimulatedCreatorCamera(
  ctx: CanvasRenderingContext2D,
  localTimeSec: number,
  sourceTimeSec: number,
  w: number,
  h: number,
  scene: PlannedScene
): void {
  const s = w / 1920;

  // Studio dark slate gradient background
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, "#14171F");
  grad.addColorStop(1, "#232936");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle studio background lighting glow
  const radial = ctx.createRadialGradient(
    w * 0.5,
    h * 0.42,
    40 * s,
    w * 0.5,
    h * 0.42,
    560 * s
  );
  radial.addColorStop(0, "rgba(198, 255, 0, 0.14)");
  radial.addColorStop(1, "rgba(198, 255, 0, 0)");
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, w, h);

  // Camera viewfinder corners
  ctx.strokeStyle = "rgba(248, 249, 250, 0.35)";
  ctx.lineWidth = Math.max(2, 4 * s);
  const padX = w * 0.05;
  const padY = h * 0.06;
  const corner = 42 * s;

  // Top-left corner
  ctx.beginPath();
  ctx.moveTo(padX, padY + corner);
  ctx.lineTo(padX, padY);
  ctx.lineTo(padX + corner, padY);
  ctx.stroke();

  // Top-right corner
  ctx.beginPath();
  ctx.moveTo(w - padX - corner, padY);
  ctx.lineTo(w - padX, padY);
  ctx.lineTo(w - padX, padY + corner);
  ctx.stroke();

  // Top-left REC + Original Keep Range indicator
  ctx.fillStyle = "rgba(17, 17, 17, 0.82)";
  ctx.fillRect(padX + 20 * s, padY + 20 * s, 440 * s, 56 * s);
  ctx.fillStyle = "#FF3B30";
  ctx.beginPath();
  ctx.arc(padX + 52 * s, padY + 48 * s, 10 * s, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#F8F9FA";
  ctx.font = `800 ${Math.round(26 * s)}px 'Pretendard', 'Noto Sans KR', sans-serif`;
  ctx.textBaseline = "middle";
  const rangeLabel = scene.sourceRange
    ? `KEEP ${scene.sourceRange.start.toFixed(1)}s–${scene.sourceRange.end.toFixed(1)}s`
    : "ORIGINAL CAMERA";
  ctx.fillText(
    `CAM A · ${rangeLabel} · ${sourceTimeSec.toFixed(1)}s`,
    padX + 76 * s,
    padY + 48 * s
  );

  // Center creator presenter silhouette (head + shoulders + animated voice ring)
  const cx = w * 0.5;
  const cy = h * 0.43;
  const pulse = 1 + Math.sin(localTimeSec * 8) * 0.04;

  ctx.save();
  ctx.strokeStyle = "#C6FF00";
  ctx.lineWidth = Math.max(2, 5 * s);
  ctx.beginPath();
  ctx.arc(cx, cy - 30 * s, 118 * s * pulse, 0, Math.PI * 2);
  ctx.stroke();

  // Head
  ctx.fillStyle = "#344054";
  ctx.beginPath();
  ctx.arc(cx, cy - 38 * s, 72 * s, 0, Math.PI * 2);
  ctx.fill();

  // Shoulders
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
  const baseBarY = h * 0.66;

  for (let i = 0; i < barCount; i++) {
    const wave =
      0.25 +
      0.75 *
        Math.abs(
          Math.sin(localTimeSec * 10 + i * 0.65) *
            Math.cos(localTimeSec * 4 - i * 0.3)
        );
    const bh = (18 + wave * 48) * s;
    ctx.fillStyle = i % 3 === 0 ? "#C6FF00" : "rgba(248, 249, 250, 0.75)";
    ctx.fillRect(
      startBarX + i * (barW + barGap),
      baseBarY - bh * 0.5,
      barW,
      bh
    );
  }
}

/**
 * Renders the signature high-contrast Ink (#111111) + Lime (#C6FF00) subtitle bar
 * at the bottom of the frame.
 */
export function drawSubtitleOverlay(
  ctx: CanvasRenderingContext2D,
  text: string,
  w: number,
  h: number,
  badgeLabel = "AI CAPTION"
): void {
  const clean = (text || "").trim();
  if (!clean) return;

  const s = w / 1920;
  ctx.save();

  const barW = w * 0.84;
  const barH = 112 * s;
  const bx = (w - barW) * 0.5;
  const by = h - barH - 48 * s;

  // Shadow + Ink box
  ctx.fillStyle = "rgba(17, 17, 17, 0.94)";
  ctx.fillRect(bx, by, barW, barH);

  // Left lime accent bar
  ctx.fillStyle = "#C6FF00";
  ctx.fillRect(bx, by, 14 * s, barH);

  // Small top-left tag pill
  ctx.fillStyle = "#C6FF00";
  ctx.fillRect(bx + 32 * s, by - 22 * s, 168 * s, 34 * s);
  ctx.fillStyle = "#111111";
  ctx.font = `900 ${Math.round(20 * s)}px 'Pretendard', 'Noto Sans KR', sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillText(badgeLabel, bx + 46 * s, by - 5 * s);

  // Subtitle text (>= 48px on 1080p)
  ctx.fillStyle = "#F8F9FA";
  ctx.font = `800 ${Math.round(48 * s)}px 'Pretendard', 'Noto Sans KR', sans-serif`;
  ctx.textBaseline = "middle";
  const display = clean.length > 44 ? `${clean.slice(0, 43)}…` : clean;
  ctx.fillText(display, bx + 42 * s, by + barH * 0.54);

  ctx.restore();
}

/**
 * Renders a subtle top-right scene status badge (`argon-code` vs `template-fallback`).
 */
function drawSceneBadgeOverlay(
  ctx: CanvasRenderingContext2D,
  scene: PlannedScene,
  sceneCode: SceneCode | undefined,
  w: number,
  h: number
): void {
  const s = w / 1920;
  ctx.save();

  const isMotion = scene.kind === "motion" || scene.kind === "ending";
  const label = isMotion
    ? sceneCode?.source === "template-fallback"
      ? "TEMPLATE FALLBACK · VERIFIED"
      : `ARGON CODE · ATTEMPT ${sceneCode?.attempts ?? 1}`
    : "ORIGINAL KEEP CUT";

  ctx.font = `800 ${Math.round(22 * s)}px 'Pretendard', 'Noto Sans KR', sans-serif`;
  const textW = ctx.measureText(label).width;
  const pw = textW + 40 * s;
  const ph = 44 * s;
  const px = w - pw - 48 * s;
  const py = 36 * s;

  ctx.fillStyle = "#111111";
  ctx.fillRect(px, py, pw, ph);
  ctx.fillStyle = isMotion ? "#C6FF00" : "#F8F9FA";
  ctx.fillRect(px, py, 8 * s, ph);

  ctx.fillStyle = isMotion ? "#C6FF00" : "#F8F9FA";
  ctx.textBaseline = "middle";
  ctx.fillText(label, px + 22 * s, py + ph * 0.5);

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
    showVerificationBadge = true,
  } = params;

  const timeline = buildTimeline(plan);
  const lookup = findTimelineEntryAt(timeline, globalTimeSec);
  if (!lookup) {
    ctx.fillStyle = "#111111";
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
      drawSimulatedCreatorCamera(
        ctx,
        localTimeSec,
        sourceVideoTimeSec ?? localTimeSec,
        width,
        height,
        scene
      );
    }

    if (subtitlesEnabled) {
      const subText = resolveSubtitleText(plan, scene, sourceVideoTimeSec);
      drawSubtitleOverlay(ctx, subText, width, height, scene.caption || "KEEP CUT");
    }
  } else {
    // "motion" or "ending" scene
    const codeObj = sceneCodes[scene.id];
    const compiledFn = codeObj?.code ? getCompiledDrawFn(codeObj.code) : null;

    if (compiledFn) {
      try {
        ctx.save();
        compiledFn(ctx, localTimeSec, width, height, scene);
        ctx.restore();
      } catch {
        ctx.restore();
        drawTemplateFallback(ctx, localTimeSec, width, height, scene);
      }
    } else {
      drawTemplateFallback(ctx, localTimeSec, width, height, scene);
    }

    if (subtitlesEnabled && scene.kind === "motion" && scene.script) {
      drawSubtitleOverlay(ctx, scene.script, width, height, "AI MOTION EXPLAINER");
    }
  }

  if (showVerificationBadge) {
    drawSceneBadgeOverlay(ctx, scene, sceneCodes[scene.id], width, height);
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

/**
 * Exports the full composite sequence (`plan` + `sceneCodes`) into a downloadable video `Blob` and URL
 * using `HTMLCanvasElement.captureStream` + `MediaRecorder`.
 */
export async function exportCompositeVideo(
  options: ExportVideoOptions
): Promise<ExportVideoResult> {
  const width = options.width ?? 1280;
  const height = options.height ?? 720;
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

  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 4_500_000,
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

  // Render frames deterministically at accelerated real-time cadence so MediaRecorder encodes valid timestamps
  const totalFrames = Math.max(1, Math.ceil(totalDurationSec * fps));
  // Use 16ms tick interval (~2x speed at 30fps) so a 20s video exports in ~10s while preserving smooth MediaRecorder frames
  const frameIntervalMs = Math.max(12, Math.round(1000 / (fps * 1.8)));

  for (let frameIdx = 0; frameIdx <= totalFrames; frameIdx++) {
    if (options.signal?.aborted) {
      recorder.stop();
      throw new Error("Video export aborted");
    }

    const globalTimeSec = Math.min(totalDurationSec, frameIdx / fps);
    const lookup = findTimelineEntryAt(timeline, globalTimeSec);

    if (
      options.videoElement &&
      lookup &&
      lookup.entry.scene.kind === "original" &&
      typeof lookup.sourceVideoTimeSec === "number"
    ) {
      const targetVidTime = lookup.sourceVideoTimeSec;
      if (Math.abs(options.videoElement.currentTime - targetVidTime) > 0.12) {
        try {
          options.videoElement.currentTime = targetVidTime;
        } catch {
          // Ignore seek errors on unbuffered demo streams
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
      videoElement: options.videoElement,
      subtitlesEnabled,
      showVerificationBadge: true,
    });

    const percent = Math.min(100, Math.round((frameIdx / totalFrames) * 100));
    const currentSceneId = lookup?.entry.scene.id ?? "";
    options.onProgress?.(percent, currentSceneId);

    await new Promise((r) => setTimeout(r, frameIntervalMs));
  }

  recorder.stop();
  stream.getTracks().forEach((t) => t.stop());

  const blob = await stoppedPromise;
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
 * awkward silence pause (6.4–8.2s), and core speaking segment 2 (8.2–10s+).
 * Enables instant E2E live demo testing even without an external webcam recording.
 */
export async function createSampleInputVideoBlob(options?: {
  durationSec?: number;
  width?: number;
  height?: number;
  fps?: number;
  onProgress?: (percent: number) => void;
}): Promise<SampleVideoResult> {
  const durationSec = options?.durationSec ?? 6.0;
  const width = options?.width ?? 960;
  const height = options?.height ?? 540;
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
    videoBitsPerSecond: 2_500_000,
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
    const t = (i / totalFrames) * 16.0; // Maps into the 16s creator take timeline
    const isNg = t < 2.0;
    const isSilence = t >= 6.4 && t < 8.2;

    // Background
    ctx.fillStyle = isNg ? "#2C1818" : isSilence ? "#1C2026" : "#141A24";
    ctx.fillRect(0, 0, width, height);

    // Top studio bar
    ctx.fillStyle = "#111111";
    ctx.fillRect(60 * s, 48 * s, 680 * s, 64 * s);
    ctx.fillStyle = isNg ? "#F04438" : isSilence ? "#F79009" : "#C6FF00";
    ctx.fillRect(60 * s, 48 * s, 16 * s, 64 * s);

    ctx.fillStyle = "#F8F9FA";
    ctx.font = `800 ${Math.round(28 * s)}px 'Pretendard', 'Noto Sans KR', sans-serif`;
    ctx.textBaseline = "middle";
    const statusTag = isNg
      ? "NG TAKE · (박수) 아 잠깐만요, 다시 갈게요"
      : isSilence
        ? "SILENCE 1.8s · (무음 호흡 대기...)"
        : "KEEP TAKE · AI 자동화 검증 루프 핵심 발화";
    ctx.fillText(statusTag, 96 * s, 80 * s);

    // Presenter silhouette
    const cx = width * 0.5;
    const cy = height * 0.45;
    ctx.fillStyle = "#344054";
    ctx.beginPath();
    ctx.arc(cx, cy - 30 * s, 70 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy + 160 * s, 150 * s, Math.PI * 1.15, Math.PI * 1.85);
    ctx.fill();

    // Subtitle cue burned into sample raw take for multimodal recognition
    const cue = isNg
      ? "(박수) 아 잠깐만요, 다시 갈게요."
      : t < 6.4
        ? "많은 분들이 AI 자동화를 시도하다가 첫 단계에서 바로 막힙니다."
        : isSilence
          ? "(... 1.8초 침묵 ...)"
          : t < 13.0
            ? "그냥 프롬프트 한 줄 넣는다고 끝나는 게 아니라 검증 루프가 핵심이거든요."
            : "어떻게 세팅하는지 지금 바로 보여드릴게요.";

    drawSubtitleOverlay(
      ctx,
      cue,
      width,
      height,
      `RAW TAKE · ${t.toFixed(1)}s`
    );

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
