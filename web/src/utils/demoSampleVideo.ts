import type { SceneCode, ScenePlan } from "../../../shared/contract";
import { exportCompositeVideo } from "../render/compositor";

/**
 * Exports a real playable 1920x1080 WebM/MP4 video Blob from the composite ScenePlan & SceneCodes.
 * Delegates to the real-time audio/video synthesizer (`exportCompositeVideo` in `render/compositor`)
 * so that original `<video>` audio, motion TTS buffers, broadcast compressor (-14dB),
 * and Korean subtitles are rendered accurately over the full `timeline.totalDurationSec`.
 */
export async function exportCompositeVideoBlob(
  plan: ScenePlan,
  sceneCodes: Record<string, SceneCode>,
  onProgress?: (ratio: number) => void,
  videoElement?: HTMLVideoElement | null
): Promise<{ blob: Blob; ext: "mp4" | "webm" }> {
  const res = await exportCompositeVideo({
    plan,
    sceneCodes,
    videoElement,
    width: 1920,
    height: 1080,
    fps: 30,
    subtitlesEnabled: true,
    onProgress: (percent) => {
      onProgress?.(Math.min(1, Math.max(0, percent / 100)));
    },
  });

  const ext: "mp4" | "webm" = res.mimeType.includes("mp4") ? "mp4" : "webm";
  onProgress?.(1);
  return {
    blob: res.blob,
    ext,
  };
}
