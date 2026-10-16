import type { ScenePlan, SceneCode } from "../../../shared/contract";
import {
  renderMotionSceneToCanvas,
  renderOriginalSceneToCanvas,
} from "./canvasPreview";

/**
 * Generates a real playable WebM/MP4 video Blob from the composite ScenePlan & SceneCodes.
 * Fast-renders frames onto an offscreen 1280x720 canvas with MediaRecorder.
 */
export async function exportCompositeVideoBlob(
  plan: ScenePlan,
  sceneCodes: Record<string, SceneCode>,
  onProgress?: (ratio: number) => void
): Promise<{ blob: Blob; ext: "mp4" | "webm" }> {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext("2d")!;

  const mp4Mime = "video/mp4;codecs=avc1";
  const webmMime = "video/webm;codecs=vp9,opus";
  const webmFallback = "video/webm";
  const mimeType =
    typeof MediaRecorder !== "undefined" &&
    MediaRecorder.isTypeSupported(mp4Mime)
      ? mp4Mime
      : typeof MediaRecorder !== "undefined" &&
          MediaRecorder.isTypeSupported(webmMime)
        ? webmMime
        : webmFallback;

  const ext: "mp4" | "webm" = mimeType.includes("mp4") ? "mp4" : "webm";

  const stream = canvas.captureStream(30);

  // Add synthesized studio audio track via WebAudio so exported video always contains an audio stream
  let audioCtx: AudioContext | null = null;
  let osc: OscillatorNode | null = null;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (AudioCtx) {
      audioCtx = new AudioCtx();
      const dest = audioCtx.createMediaStreamDestination();
      osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(220, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(dest);
      osc.start();
      const audioTrack = dest.stream.getAudioTracks()[0];
      if (audioTrack) {
        stream.addTrack(audioTrack);
      }
    }
  } catch {
    // Proceed with video-only stream if AudioContext is blocked
  }

  const recorder = new MediaRecorder(stream, {
    mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : undefined,
    videoBitsPerSecond: 4_000_000,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const stopped = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: mimeType }));
    };
  });

  recorder.start(100);

  // Render a ~4.0 second composite reel across all scenes
  const totalVirtualSec = plan.scenes.reduce((acc, s) => acc + s.durationSec, 0);
  const steps = 120;
  for (let i = 0; i <= steps; i++) {
    const ratio = i / steps;
    onProgress?.(ratio);
    const virtualTime = ratio * totalVirtualSec;

    let acc = 0;
    let activeScene = plan.scenes[0];
    let localT = 0;
    let sceneIdx = 0;
    for (let idx = 0; idx < plan.scenes.length; idx++) {
      const sc = plan.scenes[idx];
      if (virtualTime <= acc + sc.durationSec) {
        activeScene = sc;
        localT = virtualTime - acc;
        sceneIdx = idx;
        break;
      }
      acc += sc.durationSec;
    }

    if (osc && audioCtx) {
      const freqs = [220, 330, 261.63, 392, 440];
      osc.frequency.setValueAtTime(
        freqs[sceneIdx % freqs.length],
        audioCtx.currentTime
      );
    }

    ctx.save();
    ctx.scale(1280 / 1920, 720 / 1080);
    if (activeScene.kind === "original") {
      renderOriginalSceneToCanvas(ctx, localT, 1920, 1080, activeScene, null, null);
    } else {
      renderMotionSceneToCanvas(
        ctx,
        localT,
        1920,
        1080,
        activeScene,
        sceneCodes[activeScene.id]
      );
    }
    ctx.restore();

    await new Promise((r) => setTimeout(r, 33));
  }

  recorder.stop();
  const blob = await stopped;
  try {
    osc?.stop();
    await audioCtx?.close();
  } catch {
    // ignore cleanup errors
  }
  onProgress?.(1);
  return { blob, ext };
}
