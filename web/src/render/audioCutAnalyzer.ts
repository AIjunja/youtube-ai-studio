import type {
  CutSuggestion,
  PlannedScene,
  ScenePlan,
  TimeRange,
} from "../../../shared/contract";

const WINDOW_SEC = 0.02; // 20ms RMS window
const SEARCH_RADIUS_SEC = 0.3; // ±0.3s around boundary
const PRE_SPEECH_MARGIN_SEC = 0.08; // 0.08s padding before speech
const POST_SPEECH_MARGIN_SEC = 0.12; // 0.12s padding after speech

/**
 * Computes 20ms RMS energy windows across all channels of an AudioBuffer.
 */
function computeRmsEnvelope(audioBuffer: AudioBuffer): {
  rms: Float32Array;
  windowSec: number;
  durationSec: number;
} {
  const sampleRate = audioBuffer.sampleRate;
  const totalSamples = audioBuffer.length;
  const channelCount = Math.max(1, audioBuffer.numberOfChannels);
  const samplesPerWindow = Math.max(1, Math.round(sampleRate * WINDOW_SEC));
  const numWindows = Math.max(1, Math.ceil(totalSamples / samplesPerWindow));

  const channels: Float32Array[] = [];
  for (let ch = 0; ch < channelCount; ch++) {
    channels.push(audioBuffer.getChannelData(ch));
  }

  const rms = new Float32Array(numWindows);
  for (let w = 0; w < numWindows; w++) {
    const startSample = w * samplesPerWindow;
    const endSample = Math.min(totalSamples, startSample + samplesPerWindow);
    const count = Math.max(1, endSample - startSample);
    let sumSq = 0;

    for (let i = startSample; i < endSample; i++) {
      let sample = 0;
      for (let ch = 0; ch < channelCount; ch++) {
        sample += channels[ch][i];
      }
      sample /= channelCount;
      sumSq += sample * sample;
    }

    rms[w] = Math.sqrt(sumSq / count);
  }

  return {
    rms,
    windowSec: WINDOW_SEC,
    durationSec: audioBuffer.duration,
  };
}

/**
 * Finds the timestamp with the lowest RMS energy within `[targetSec - radiusSec, targetSec + radiusSec]`.
 */
function findQuietestPointNear(
  envelope: { rms: Float32Array; windowSec: number; durationSec: number },
  targetSec: number,
  radiusSec = SEARCH_RADIUS_SEC
): number {
  const clampedTarget = Math.max(0, Math.min(envelope.durationSec, targetSec));
  const minTime = Math.max(0, clampedTarget - radiusSec);
  const maxTime = Math.min(envelope.durationSec, clampedTarget + radiusSec);

  const startIdx = Math.max(
    0,
    Math.floor(minTime / envelope.windowSec)
  );
  const endIdx = Math.min(
    envelope.rms.length - 1,
    Math.ceil(maxTime / envelope.windowSec)
  );

  if (endIdx <= startIdx) {
    return Number(clampedTarget.toFixed(3));
  }

  let bestIdx = startIdx;
  let bestVal = envelope.rms[startIdx];

  for (let idx = startIdx; idx <= endIdx; idx++) {
    const prev = envelope.rms[Math.max(0, idx - 1)];
    const curr = envelope.rms[idx];
    const next = envelope.rms[Math.min(envelope.rms.length - 1, idx + 1)];
    const localAvg = (prev + curr * 2 + next) / 4;

    if (localAvg < bestVal) {
      bestVal = localAvg;
      bestIdx = idx;
    }
  }

  const bestTime = Math.max(
    0,
    Math.min(envelope.durationSec, (bestIdx + 0.5) * envelope.windowSec)
  );
  return Number(bestTime.toFixed(3));
}

/**
 * Snaps a keep `TimeRange` so its start/end boundaries align with the quietest point
 * within ±0.3s and preserve 0.08s pre-speech and 0.12s post-speech breathing room
 * so spoken syllables are never clipped mid-word.
 */
function refineKeepRange(
  range: TimeRange,
  envelope: { rms: Float32Array; windowSec: number; durationSec: number }
): TimeRange {
  const quietStart = findQuietestPointNear(envelope, range.start, SEARCH_RADIUS_SEC);
  const quietEnd = findQuietestPointNear(envelope, range.end, SEARCH_RADIUS_SEC);

  const paddedStart = Math.max(0, quietStart - PRE_SPEECH_MARGIN_SEC);
  const paddedEnd = Math.min(
    envelope.durationSec,
    Math.max(paddedStart + 0.4, quietEnd + POST_SPEECH_MARGIN_SEC)
  );

  return {
    start: Number(paddedStart.toFixed(3)),
    end: Number(paddedEnd.toFixed(3)),
  };
}

/**
 * Decodes the audio track from `videoFileOrBlob` in the browser using `AudioContext.decodeAudioData`,
 * computes 20ms RMS windows, and refines `plan.keep`, `plan.cuts`, and `plan.scenes` (`sourceRange`)
 * so cut boundaries snap to the quietest point within ±0.3s with 0.08s pre-speech / 0.12s post-speech margin.
 */
export async function refinePlanCutsWithAudio(
  videoFileOrBlob: Blob,
  plan: ScenePlan
): Promise<ScenePlan> {
  if (typeof window === "undefined") {
    return plan;
  }

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioCtx) {
    return plan;
  }

  let audioCtx: AudioContext | null = null;
  try {
    const arrayBuffer = await videoFileOrBlob.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      return plan;
    }

    audioCtx = new AudioCtx();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    const envelope = computeRmsEnvelope(audioBuffer);

    const refinedKeep: TimeRange[] = (plan.keep || []).map((k) =>
      refineKeepRange(k, envelope)
    );

    const refinedCuts: CutSuggestion[] = (plan.cuts || []).map((cut) => {
      const qStart = findQuietestPointNear(envelope, cut.start, SEARCH_RADIUS_SEC);
      const qEnd = Math.max(
        qStart + 0.1,
        findQuietestPointNear(envelope, cut.end, SEARCH_RADIUS_SEC)
      );
      return {
        ...cut,
        start: qStart,
        end: qEnd,
      };
    });

    const refinedScenes: PlannedScene[] = (plan.scenes || []).map((scene) => {
      if (scene.kind === "original" && scene.sourceRange) {
        const refinedRange = refineKeepRange(scene.sourceRange, envelope);
        const newDuration = Number(
          Math.max(0.5, refinedRange.end - refinedRange.start).toFixed(3)
        );
        return {
          ...scene,
          sourceRange: refinedRange,
          durationSec: newDuration,
        };
      }
      return scene;
    });

    return {
      ...plan,
      keep: refinedKeep,
      cuts: refinedCuts,
      scenes: refinedScenes,
    };
  } catch {
    return plan;
  } finally {
    if (audioCtx) {
      try {
        await audioCtx.close();
      } catch {
        // Ignore close errors
      }
    }
  }
}
