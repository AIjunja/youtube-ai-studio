import React, { useEffect, useRef, useState } from "react";
import type {
  PlannedScene,
  SceneCode,
  ScenePlan,
  VerifyReport,
} from "../../../shared/contract";
import {
  renderMotionSceneToCanvas,
  renderOriginalSceneToCanvas,
  renderSceneThumbnailDataUrl,
} from "../utils/canvasPreview";

export type PlayerTabMode = "composite" | "original";

export interface PlayerSeekRequest {
  time: number;
  tab: PlayerTabMode;
  nonce: number;
}

interface CanvasPreviewPlayerProps {
  plan: ScenePlan;
  sceneCodes: Record<string, SceneCode>;
  verifyReport: VerifyReport;
  selectedSceneId: string;
  onSelectScene: (sceneId: string) => void;
  uploadedVideoUrl: string | null;
  uploadedFileName: string | null;
  rawDurationSec?: number;
  seekRequest?: PlayerSeekRequest | null;
  activeCutMap?: Record<number, boolean>;
}

function formatTimeMMSS(sec: number): string {
  const safe = Math.max(0, sec);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${s.toFixed(1).padStart(4, "0")}`;
}

export const CanvasPreviewPlayer: React.FC<CanvasPreviewPlayerProps> = ({
  plan,
  sceneCodes,
  selectedSceneId,
  onSelectScene,
  uploadedVideoUrl,
  uploadedFileName,
  rawDurationSec = 16.0,
  seekRequest,
  activeCutMap = {},
}) => {
  const isScriptOnly = plan.mode === "script-only" || (!uploadedVideoUrl && plan.keep.length === 0);
  const [playerTab, setPlayerTab] = useState<PlayerTabMode>("composite");
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [rawTime, setRawTime] = useState<number>(0);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastAudioSrcRef = useRef<string>("");
  const profileImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (isScriptOnly && playerTab === "original") {
      setPlayerTab("composite");
    }
  }, [isScriptOnly, playerTab]);

  useEffect(() => {
    const img = new Image();
    img.src = "/studio/channels4_profile.jpg";
    profileImgRef.current = img;
  }, []);

  // Handle external seek requests (e.g., from [해당 부분 들어보기])
  useEffect(() => {
    if (!seekRequest) return;
    setPlayerTab(seekRequest.tab);
    if (seekRequest.tab === "original") {
      setRawTime(seekRequest.time);
      if (hiddenVideoRef.current) {
        try {
          hiddenVideoRef.current.currentTime = seekRequest.time;
        } catch {
          // ignore
        }
      }
    } else {
      setCurrentTime(seekRequest.time);
    }
    setIsPlaying(true);
  }, [seekRequest]);

  // Compute cumulative scene timing table
  const sceneTimings = React.useMemo(() => {
    let acc = 0;
    return plan.scenes.map((scene) => {
      const start = acc;
      const end = acc + scene.durationSec;
      acc = end;
      return { scene, start, end };
    });
  }, [plan.scenes]);

  const totalCompositeDuration = React.useMemo(
    () =>
      sceneTimings.length > 0
        ? sceneTimings[sceneTimings.length - 1].end
        : 20,
    [sceneTimings]
  );

  const rawTotalDuration = Math.max(
    rawDurationSec,
    plan.keep.reduce((m, r) => Math.max(m, r.end), 0),
    plan.cuts.reduce((m, c) => Math.max(m, c.end), 0),
    10
  );

  // Generate offscreen keyframe thumbnails whenever scenes or sceneCodes update
  useEffect(() => {
    const nextThumbs: Record<string, string> = {};
    for (const sc of plan.scenes) {
      nextThumbs[sc.id] = renderSceneThumbnailDataUrl(sc, sceneCodes[sc.id]);
    }
    setThumbnails(nextThumbs);
  }, [plan.scenes, sceneCodes]);

  const handleSelectSceneAndSeek = (sceneId: string) => {
    onSelectScene(sceneId);
    const found = sceneTimings.find((st) => st.scene.id === sceneId);
    if (found) {
      setCurrentTime(found.start + 0.02);
    }
  };

  // Determine active scene from currentTime
  const activeTiming = React.useMemo(() => {
    return (
      sceneTimings.find(
        (st) => currentTime >= st.start && currentTime <= st.end
      ) ||
      sceneTimings[sceneTimings.length - 1] ||
      sceneTimings[0]
    );
  }, [currentTime, sceneTimings]);

  useEffect(() => {
    if (activeTiming && isPlaying && playerTab === "composite") {
      if (activeTiming.scene.id !== selectedSceneId) {
        onSelectScene(activeTiming.scene.id);
      }
    }
  }, [activeTiming, isPlaying, onSelectScene, playerTab, selectedSceneId]);

  // Sync audio playback (<video> for original scenes, <audio> for TTS scenes)
  useEffect(() => {
    const vid = hiddenVideoRef.current;
    const aud = ttsAudioRef.current;

    if (!isPlaying) {
      if (vid && !vid.paused) vid.pause();
      if (aud && !aud.paused) aud.pause();
      return;
    }

    if (playerTab === "original") {
      if (aud && !aud.paused) aud.pause();
      if (vid && uploadedVideoUrl) {
        vid.muted = false;
        if (Math.abs(vid.currentTime - rawTime) > 0.35) {
          try {
            vid.currentTime = rawTime;
          } catch {
            // ignore
          }
        }
        vid.play().catch(() => {});
      }
      return;
    }

    // playerTab === "composite"
    const scene = activeTiming?.scene;
    if (!scene || !activeTiming) return;
    const localT = Math.max(0, currentTime - activeTiming.start);

    if (scene.kind === "original") {
      if (aud && !aud.paused) aud.pause();
      if (vid && uploadedVideoUrl) {
        vid.muted = false;
        const targetVidTime = (scene.sourceRange?.start ?? 0) + localT;
        if (Math.abs(vid.currentTime - targetVidTime) > 0.35) {
          try {
            vid.currentTime = targetVidTime;
          } catch {
            // ignore
          }
        }
        vid.play().catch(() => {});
      }
    } else {
      if (vid && !vid.paused) vid.pause();
      const ttsSrc =
        scene.audioUrl ||
        (scene.audioBase64
          ? scene.audioBase64.startsWith("data:")
            ? scene.audioBase64
            : `data:audio/wav;base64,${scene.audioBase64}`
          : "");

      if (aud && ttsSrc) {
        if (lastAudioSrcRef.current !== ttsSrc) {
          lastAudioSrcRef.current = ttsSrc;
          aud.src = ttsSrc;
        }
        if (Math.abs(aud.currentTime - localT) > 0.4) {
          try {
            aud.currentTime = localT;
          } catch {
            // ignore
          }
        }
        aud.play().catch(() => {});
      } else if (aud && !aud.paused) {
        aud.pause();
      }
    }
  }, [activeTiming, currentTime, isPlaying, playerTab, rawTime, uploadedVideoUrl]);

  // Animation loop for Composite Canvas and Raw Original Canvas
  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - lastTs) / 1000);
      lastTs = now;

      if (isPlaying) {
        if (playerTab === "composite") {
          setCurrentTime((prev) => {
            const next = prev + dt;
            if (next >= totalCompositeDuration) {
              setIsPlaying(false);
              return 0;
            }
            return next;
          });
        } else {
          setRawTime((prev) => {
            const next = prev + dt;
            if (next >= rawTotalDuration) {
              setIsPlaying(false);
              return 0;
            }
            return next;
          });
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, playerTab, rawTotalDuration, totalCompositeDuration]);

  // Draw current frame onto Composite 1920x1080 Canvas
  useEffect(() => {
    if (playerTab !== "composite") return;
    const canvas = canvasRef.current;
    if (!canvas || !activeTiming) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const scene = activeTiming.scene;
    const localT = Math.max(0, currentTime - activeTiming.start);

    const vid = hiddenVideoRef.current;
    if (vid && uploadedVideoUrl && scene.kind === "original" && !isPlaying) {
      const targetVidTime = (scene.sourceRange?.start ?? 0) + localT;
      if (Math.abs(vid.currentTime - targetVidTime) > 0.2) {
        try {
          vid.currentTime = targetVidTime;
        } catch {
          // ignore
        }
      }
    }

    ctx.clearRect(0, 0, 1920, 1080);

    if (scene.kind === "original") {
      // Find matching transcript line if available so subtitle edits in [자막] tab reflect immediately
      const rawEquivalentTime = (scene.sourceRange?.start ?? 0) + localT;
      const matchingTr = plan.transcript.find(
        (tr) => rawEquivalentTime >= tr.start && rawEquivalentTime <= tr.end
      );
      const effectiveScene: PlannedScene = matchingTr
        ? { ...scene, script: matchingTr.text }
        : scene;

      renderOriginalSceneToCanvas(
        ctx,
        localT,
        1920,
        1080,
        effectiveScene,
        uploadedVideoUrl ? vid : null,
        profileImgRef.current
      );
    } else {
      renderMotionSceneToCanvas(
        ctx,
        localT,
        1920,
        1080,
        scene,
        sceneCodes[scene.id]
      );

      if (scene.script) {
        ctx.save();
        ctx.fillStyle = "rgba(17, 17, 17, 0.88)";
        ctx.fillRect(1920 * 0.08, 1080 - 118, 1920 * 0.84, 78);
        ctx.fillStyle = "#C6FF00";
        ctx.fillRect(1920 * 0.08, 1080 - 118, 12, 78);
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "700 32px 'GmarketSansBold', 'Noto Sans KR', sans-serif";
        ctx.textBaseline = "middle";
        ctx.fillText(scene.script, 1920 * 0.08 + 32, 1080 - 79);
        ctx.restore();
      }
    }
  }, [
    activeTiming,
    currentTime,
    isPlaying,
    plan.transcript,
    playerTab,
    sceneCodes,
    uploadedVideoUrl,
  ]);

  // Draw Raw Original Video tab
  useEffect(() => {
    if (playerTab !== "original") return;
    const canvas = rawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cutIndex = plan.cuts.findIndex(
      (c) => rawTime >= c.start && rawTime <= c.end
    );
    const activeCut = cutIndex >= 0 ? plan.cuts[cutIndex] : undefined;
    const isCutActive =
      cutIndex >= 0
        ? activeCutMap[cutIndex] !== undefined
          ? activeCutMap[cutIndex]
          : (activeCut?.confidence ?? 0) >= 0.7
        : false;

    const activeTranscript = plan.transcript.find(
      (tr) => rawTime >= tr.start && rawTime <= tr.end
    );

    const fakeScene: PlannedScene = {
      id: "raw-preview",
      kind: "original",
      durationSec: rawTotalDuration,
      caption: activeCut
        ? isCutActive
          ? "잘린 부분 (완성본에서 제외됨)"
          : "되살린 부분 (완성본에 포함됨)"
        : "원본 구간",
      script:
        activeTranscript?.text ||
        (activeCut?.note ?? "원본 영상을 재생하고 있습니다."),
      visualIdea: "원본 영상",
      sourceRange: { start: 0, end: rawTotalDuration },
    };

    ctx.clearRect(0, 0, 1920, 1080);
    renderOriginalSceneToCanvas(
      ctx,
      rawTime,
      1920,
      1080,
      fakeScene,
      uploadedVideoUrl ? hiddenVideoRef.current : null,
      profileImgRef.current
    );

    if (activeCut && isCutActive) {
      ctx.save();
      ctx.fillStyle = "rgba(255, 78, 69, 0.22)";
      ctx.fillRect(0, 0, 1920, 1080);

      ctx.fillStyle = "#ff4e45";
      ctx.fillRect(1920 - 520, 72, 440, 60);
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "700 26px 'Noto Sans KR', sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText("완성본에서 잘린 구간입니다", 1920 - 490, 102);
      ctx.restore();
    }
  }, [
    activeCutMap,
    plan.cuts,
    plan.transcript,
    playerTab,
    rawTime,
    rawTotalDuration,
    uploadedVideoUrl,
  ]);

  const currentScene = activeTiming?.scene;

  return (
    <div className="bg-[#282828] border border-[#3e3e3e] rounded-[8px] overflow-hidden">
      {/* Hidden video element for uploaded footage */}
      {uploadedVideoUrl && (
        <video
          ref={hiddenVideoRef}
          src={uploadedVideoUrl}
          playsInline
          className="hidden"
        />
      )}
      {/* Hidden audio element for TTS voice playback */}
      <audio ref={ttsAudioRef} className="hidden" />

      {/* Top Player Bar: [원본] ⇄ [완성본] Toggle */}
      <div className="px-4 py-2.5 border-b border-[#3e3e3e] flex flex-wrap items-center justify-between gap-3 bg-[#282828]">
        <div className="flex items-center gap-1 bg-[#181818] p-1 rounded-[4px] border border-[#3e3e3e]">
          {!isScriptOnly && (
            <button
              type="button"
              onClick={() => setPlayerTab("original")}
              className={`px-3 py-1 rounded-[4px] text-[13px] font-medium transition-colors cursor-pointer ${
                playerTab === "original"
                  ? "bg-[#323232] text-[#f1f1f1]"
                  : "text-[#aaaaaa] hover:text-[#f1f1f1]"
              }`}
            >
              원본{uploadedFileName ? ` (${uploadedFileName})` : ""}
            </button>
          )}
          <button
            type="button"
            onClick={() => setPlayerTab("composite")}
            className={`px-3 py-1 rounded-[4px] text-[13px] font-medium transition-colors cursor-pointer ${
              playerTab === "composite"
                ? "bg-[#3ea6ff] text-[#0f0f0f]"
                : "text-[#aaaaaa] hover:text-[#f1f1f1]"
            }`}
          >
            완성본
          </button>
        </div>

        {playerTab === "composite" && currentScene && (
          <div className="flex items-center gap-2 text-[12px] text-[#aaaaaa]">
            <span className="px-2 py-0.5 rounded-[4px] bg-[#181818] border border-[#3e3e3e] text-[#f1f1f1]">
              {currentScene.kind === "motion"
                ? "AI 설명 장면"
                : currentScene.kind === "ending"
                  ? "마무리 장면"
                  : "원본 구간"}
            </span>
            <span className="truncate max-w-[220px]">{currentScene.caption}</span>
          </div>
        )}
      </div>

      {/* 16:9 Canvas Viewport */}
      <div className="relative bg-[#0f0f0f] aspect-video w-full overflow-hidden">
        {playerTab === "composite" ? (
          <canvas
            ref={canvasRef}
            width={1920}
            height={1080}
            onClick={() => setIsPlaying((p) => !p)}
            className="w-full h-full object-contain cursor-pointer"
          />
        ) : (
          <canvas
            ref={rawCanvasRef}
            width={1920}
            height={1080}
            onClick={() => setIsPlaying((p) => !p)}
            className="w-full h-full object-contain cursor-pointer"
          />
        )}
      </div>

      {/* Transport Controls & Scrubber Bar */}
      <div className="px-4 py-3 bg-[#282828] border-t border-[#3e3e3e] flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIsPlaying((p) => !p)}
          aria-label={isPlaying ? "일시정지" : "재생"}
          className="w-8 h-8 rounded-[4px] bg-[#3ea6ff] hover:bg-[#65b8ff] text-[#0f0f0f] flex items-center justify-center transition-colors cursor-pointer shrink-0"
        >
          <span className="material-symbols-outlined text-[20px]">
            {isPlaying ? "pause" : "play_arrow"}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (playerTab === "composite") setCurrentTime(0);
            else setRawTime(0);
            setIsPlaying(true);
          }}
          title="처음부터 재생"
          className="w-8 h-8 rounded-[4px] bg-[#181818] hover:bg-[#323232] border border-[#3e3e3e] text-[#f1f1f1] flex items-center justify-center transition-colors cursor-pointer shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">replay</span>
        </button>

        <div className="flex-1 flex items-center gap-2.5">
          <span className="text-[12px] font-mono text-[#f1f1f1] w-12 text-right">
            {formatTimeMMSS(playerTab === "composite" ? currentTime : rawTime)}
          </span>
          <input
            type="range"
            min={0}
            max={
              playerTab === "composite"
                ? totalCompositeDuration
                : rawTotalDuration
            }
            step={0.05}
            value={playerTab === "composite" ? currentTime : rawTime}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (playerTab === "composite") setCurrentTime(v);
              else setRawTime(v);
            }}
            className="flex-1 accent-[#3ea6ff] h-1.5 bg-[#3e3e3e] rounded-[4px] cursor-pointer"
          />
          <span className="text-[12px] font-mono text-[#aaaaaa] w-12">
            {formatTimeMMSS(
              playerTab === "composite"
                ? totalCompositeDuration
                : rawTotalDuration
            )}
          </span>
        </div>
      </div>

      {/* Scene Thumbnail Strip */}
      <div className="p-3 bg-[#1f1f1f] border-t border-[#3e3e3e]">
        <div className="text-[12px] text-[#aaaaaa] mb-2">
          장면 목록 ({plan.scenes.length}개)
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {plan.scenes.map((sc, idx) => {
            const isSelected = sc.id === selectedSceneId;
            return (
              <button
                key={sc.id}
                type="button"
                onClick={() => {
                  setPlayerTab("composite");
                  handleSelectSceneAndSeek(sc.id);
                }}
                className={`text-left rounded-[4px] overflow-hidden border transition-colors cursor-pointer flex flex-col bg-[#282828] ${
                  isSelected
                    ? "border-[#3ea6ff] bg-[#323232]"
                    : "border-[#3e3e3e] hover:border-[#717171]"
                }`}
              >
                <div className="relative aspect-video bg-[#181818] w-full overflow-hidden">
                  {thumbnails[sc.id] ? (
                    <img
                      src={thumbnails[sc.id]}
                      alt={sc.caption}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[11px] text-[#717171]">
                      준비 중
                    </div>
                  )}
                  <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-[4px] bg-black/80 text-[10px] text-[#f1f1f1]">
                    #{idx + 1}{" "}
                    {sc.kind === "motion"
                      ? "설명"
                      : sc.kind === "ending"
                        ? "마무리"
                        : "원본"}
                  </span>
                  <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded-[4px] bg-black/80 text-[10px] font-mono text-[#f1f1f1]">
                    {sc.durationSec.toFixed(1)}초
                  </span>
                </div>
                <div className="p-1.5 text-[11px] text-[#f1f1f1] truncate">
                  {sc.caption}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
