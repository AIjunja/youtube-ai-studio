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
  const webmMime = "video/webm;codecs=vp9";
  const mimeType =
    typeof MediaRecorder !== "undefined" &&
    MediaRecorder.isTypeSupported(mp4Mime)
      ? mp4Mime
      : typeof MediaRecorder !== "undefined" &&
          MediaRecorder.isTypeSupported(webmMime)
        ? webmMime
        : "video/webm";

  const ext: "mp4" | "webm" = mimeType.includes("mp4") ? "mp4" : "webm";

  const stream = canvas.captureStream(30);
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

  // Render a fast preview summary reel (~2.4 seconds real-time sampling across all scenes)
  const totalVirtualSec = plan.scenes.reduce((acc, s) => acc + s.durationSec, 0);
  const steps = 60;
  for (let i = 0; i <= steps; i++) {
    const ratio = i / steps;
    onProgress?.(ratio);
    const virtualTime = ratio * totalVirtualSec;

    let acc = 0;
    let activeScene = plan.scenes[0];
    let localT = 0;
    for (const sc of plan.scenes) {
      if (virtualTime <= acc + sc.durationSec) {
        activeScene = sc;
        localT = virtualTime - acc;
        break;
      }
      acc += sc.durationSec;
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

    await new Promise((r) => setTimeout(r, 32));
  }

  recorder.stop();
  const blob = await stopped;
  onProgress?.(1);
  return { blob, ext };
}
