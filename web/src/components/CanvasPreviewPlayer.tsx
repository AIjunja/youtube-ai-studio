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

interface CanvasPreviewPlayerProps {
  plan: ScenePlan;
  sceneCodes: Record<string, SceneCode>;
  verifyReport: VerifyReport;
  selectedSceneId: string;
  onSelectScene: (sceneId: string) => void;
  uploadedVideoUrl: string | null;
  uploadedFileName: string | null;
}

export const CanvasPreviewPlayer: React.FC<CanvasPreviewPlayerProps> = ({
  plan,
  sceneCodes,
  verifyReport,
  selectedSceneId,
  onSelectScene,
  uploadedVideoUrl,
  uploadedFileName,
}) => {
  const [playerTab, setPlayerTab] = useState<PlayerTabMode>("composite");
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [loopSingleScene, setLoopSingleScene] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [rawTime, setRawTime] = useState<number>(0);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null);
  const profileImgRef = useRef<HTMLImageElement | null>(null);

  // Preload channel profile image for simulated camera view
  useEffect(() => {
    const img = new Image();
    img.src = "/studio/channels4_profile.jpg";
    profileImgRef.current = img;
  }, []);

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

  const rawTotalDuration = 16.0;

  // Generate offscreen keyframe thumbnails whenever scenes or sceneCodes update
  useEffect(() => {
    const nextThumbs: Record<string, string> = {};
    for (const sc of plan.scenes) {
      nextThumbs[sc.id] = renderSceneThumbnailDataUrl(sc, sceneCodes[sc.id]);
    }
    setThumbnails(nextThumbs);
  }, [plan.scenes, sceneCodes]);

  // When user clicks a scene externally, seek composite time to that scene's start
  const handleSelectSceneAndSeek = (sceneId: string) => {
    onSelectScene(sceneId);
    const found = sceneTimings.find((st) => st.scene.id === sceneId);
    if (found) {
      setCurrentTime(found.start + 0.05);
    }
  };

  // Determine active scene from currentTime
  const activeTiming = React.useMemo(() => {
    if (loopSingleScene) {
      const found =
        sceneTimings.find((st) => st.scene.id === selectedSceneId) ||
        sceneTimings[0];
      return found;
    }
    return (
      sceneTimings.find(
        (st) => currentTime >= st.start && currentTime <= st.end
      ) ||
      sceneTimings[sceneTimings.length - 1] ||
      sceneTimings[0]
    );
  }, [currentTime, loopSingleScene, sceneTimings, selectedSceneId]);

  // Keep selectedSceneId synced when playing full sequence
  useEffect(() => {
    if (!loopSingleScene && activeTiming && isPlaying) {
      if (activeTiming.scene.id !== selectedSceneId) {
        onSelectScene(activeTiming.scene.id);
      }
    }
  }, [activeTiming, isPlaying, loopSingleScene, onSelectScene, selectedSceneId]);

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
            if (loopSingleScene && activeTiming) {
              const next = prev + dt;
              if (next >= activeTiming.end || next < activeTiming.start) {
                return activeTiming.start;
              }
              return next;
            }
            const next = prev + dt;
            return next >= totalCompositeDuration ? 0 : next;
          });
        } else {
          setRawTime((prev) => {
            const next = prev + dt;
            return next >= rawTotalDuration ? 0 : next;
          });
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [
    activeTiming,
    isPlaying,
    loopSingleScene,
    playerTab,
    totalCompositeDuration,
  ]);

  // Draw current frame onto Composite 1920x1080 Canvas
  useEffect(() => {
    if (playerTab !== "composite") return;
    const canvas = canvasRef.current;
    if (!canvas || !activeTiming) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const scene = activeTiming.scene;
    const localT = Math.max(0, currentTime - activeTiming.start);

    // Sync hidden video element if original scene & video uploaded
    const vid = hiddenVideoRef.current;
    if (vid && uploadedVideoUrl && scene.kind === "original") {
      const targetVidTime = (scene.sourceRange?.start ?? 0) + localT;
      if (Math.abs(vid.currentTime - targetVidTime) > 0.35) {
        try {
          vid.currentTime = targetVidTime;
        } catch {
          // ignore seek errors before metadata load
        }
      }
    }

    ctx.clearRect(0, 0, 1920, 1080);

    if (scene.kind === "original") {
      renderOriginalSceneToCanvas(
        ctx,
        localT,
        1920,
        1080,
        scene,
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

      // Draw subtle bottom subtitle overlay on motion scenes if caption/script exists
      if (scene.script) {
        ctx.save();
        ctx.fillStyle = "rgba(17, 17, 17, 0.88)";
        ctx.fillRect(1920 * 0.08, 1080 - 118, 1920 * 0.84, 78);
        ctx.fillStyle = "#C6FF00";
        ctx.fillRect(1920 * 0.08, 1080 - 118, 12, 78);
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "700 32px sans-serif";
        ctx.textBaseline = "middle";
        ctx.fillText(scene.script, 1920 * 0.08 + 32, 1080 - 79);
        ctx.restore();
      }
    }
  }, [activeTiming, currentTime, playerTab, sceneCodes, uploadedVideoUrl]);

  // Draw Raw Original Video tab (shows NG cuts and Silence segments in real time)
  useEffect(() => {
    if (playerTab !== "original") return;
    const canvas = rawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const activeCut = plan.cuts.find(
      (c) => rawTime >= c.start && rawTime <= c.end
    );
    const activeTranscript = plan.transcript.find(
      (tr) => rawTime >= tr.start && rawTime <= tr.end
    );

    const fakeScene: PlannedScene = {
      id: "raw-preview",
      kind: "original",
      durationSec: rawTotalDuration,
      caption: activeCut
        ? activeCut.confidence >= 0.7
          ? `✂️ AUTO CUT (${activeCut.reason.toUpperCase()} · 신뢰도 ${Math.round(activeCut.confidence * 100)}%)`
          : `💡 제안 컷 (${activeCut.reason.toUpperCase()} · 신뢰도 ${Math.round(activeCut.confidence * 100)}% - 사용자 확인)`
        : "✓ 원본 KEEP 구간 (정상 발화)",
      script:
        activeTranscript?.text ||
        (activeCut?.note ?? "원본 카메라 촬영 구간 재생 중..."),
      visualIdea: "원본 무편집 스트림",
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

    if (activeCut) {
      ctx.save();
      ctx.fillStyle =
        activeCut.confidence >= 0.7
          ? "rgba(240, 68, 56, 0.28)"
          : "rgba(245, 158, 11, 0.25)";
      ctx.fillRect(0, 0, 1920, 1080);

      ctx.fillStyle = activeCut.confidence >= 0.7 ? "#F04438" : "#F59E0B";
      ctx.fillRect(1920 - 620, 84, 540, 68);
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "900 30px sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText(
        activeCut.confidence >= 0.7
          ? `✂️ AI 완성본에서 자동 삭제됨 (${activeCut.reason.toUpperCase()})`
          : `⚠️ 신뢰도 < 0.7 제안 구간 (${activeCut.reason.toUpperCase()})`,
        1920 - 595,
        118
      );
      ctx.restore();
    }
  }, [plan.cuts, plan.transcript, playerTab, rawTime, uploadedVideoUrl]);

  const currentScene = activeTiming?.scene;
  const currentCode = currentScene ? sceneCodes[currentScene.id] : undefined;
  const currentVerify = currentScene
    ? verifyReport.checks.find((c) => c.sceneId === currentScene.id)
    : undefined;

  return (
    <div className="bg-[#282828] border border-[#3e3e3e] rounded-xl overflow-hidden">
      {/* Hidden video element for uploaded camera footage */}
      {uploadedVideoUrl && (
        <video
          ref={hiddenVideoRef}
          src={uploadedVideoUrl}
          muted
          playsInline
          className="hidden"
        />
      )}

      {/* Top Player Bar: Tab Toggle (원본 영상 <-> AI 완성본) + Mode Controls */}
      <div className="px-4 py-3 border-b border-[#3e3e3e] flex flex-wrap items-center justify-between gap-3 bg-[#222222]">
        <div className="flex items-center gap-1.5 bg-[#181818] p-1 rounded-lg border border-[#3e3e3e]">
          <button
            type="button"
            onClick={() => setPlayerTab("composite")}
            className={`px-3.5 py-1.5 rounded-md text-[13px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              playerTab === "composite"
                ? "bg-gradient-to-r from-[#7c4dff] to-[#3ea6ff] text-white shadow"
                : "text-[#aaaaaa] hover:text-white"
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">
              auto_awesome
            </span>
            <span>AI 완성본 (합성 프리뷰)</span>
          </button>

          <button
            type="button"
            onClick={() => setPlayerTab("original")}
            className={`px-3.5 py-1.5 rounded-md text-[13px] font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              playerTab === "original"
                ? "bg-[#383838] text-white"
                : "text-[#aaaaaa] hover:text-white"
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">
              videocam
            </span>
            <span>
              원본 영상 ({uploadedFileName ? uploadedFileName : "16.0s 촬영본"})
            </span>
          </button>
        </div>

        {/* Live Scene Status Pill */}
        {playerTab === "composite" && currentScene && (
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <span
              className={`px-2.5 py-1 rounded-full font-bold uppercase tracking-wide ${
                currentScene.kind === "motion"
                  ? "bg-[#c6ff00] text-[#111111]"
                  : currentScene.kind === "ending"
                    ? "bg-[#7c4dff] text-white"
                    : "bg-[#3ea6ff]/20 text-[#3ea6ff] border border-[#3ea6ff]/40"
              }`}
            >
              {currentScene.kind === "motion"
                ? "★ 찍지 않은 설명 모션 장면 (Argon Canvas 2D)"
                : currentScene.kind === "ending"
                  ? "★ AI 엔딩 카드 (Argon Canvas 2D)"
                  : "원본 KEEP 구간 + 자막"}
            </span>

            {currentCode && (
              <span className="px-2.5 py-1 rounded-full bg-[#1f1f1f] border border-[#3e3e3e] text-[#cccccc] font-mono">
                {currentCode.source} · attempts: {currentCode.attempts}
              </span>
            )}

            {currentVerify?.ok && (
              <span className="px-2.5 py-1 rounded-full bg-[#2ba640]/20 border border-[#2ba640]/50 text-[#6ee7b7] font-semibold">
                ✓ 시각 검증 통과
              </span>
            )}
          </div>
        )}
      </div>

      {/* 16:9 Responsive 1920x1080 Canvas Viewport */}
      <div className="relative bg-[#0f0f0f] aspect-video w-full overflow-hidden group">
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

        {/* Top-Right Resolution & Engine Watermark */}
        <div className="absolute top-3 right-3 flex items-center gap-2 pointer-events-none">
          <span className="px-2.5 py-1 rounded bg-black/75 border border-white/15 text-[11px] font-mono text-[#c6ff00]">
            1920×1080 · 60fps Canvas 2D
          </span>
        </div>
      </div>

      {/* Transport Controls & Scrubber Bar */}
      <div className="px-4 py-3 bg-[#222222] border-t border-[#3e3e3e] flex flex-col gap-2.5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsPlaying((p) => !p)}
            aria-label={isPlaying ? "일시정지" : "재생"}
            className="w-9 h-9 rounded-full bg-[#3ea6ff] hover:bg-[#65b8ff] text-[#111111] flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <span className="material-symbols-outlined text-[22px]">
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
            className="w-8 h-8 rounded-full bg-[#303030] hover:bg-[#3e3e3e] text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">
              replay
            </span>
          </button>

          {/* Range Scrubber */}
          <div className="flex-1 flex items-center gap-3">
            <span className="text-[12px] font-mono text-white w-11 text-right">
              {(playerTab === "composite" ? currentTime : rawTime).toFixed(1)}s
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
              className="flex-1 accent-[#c6ff00] h-1.5 bg-[#3e3e3e] rounded-lg cursor-pointer"
            />
            <span className="text-[12px] font-mono text-[#aaaaaa] w-11">
              {(playerTab === "composite"
                ? totalCompositeDuration
                : rawTotalDuration
              ).toFixed(1)}
              s
            </span>
          </div>

          {playerTab === "composite" && (
            <button
              type="button"
              onClick={() => setLoopSingleScene((v) => !v)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors cursor-pointer ${
                loopSingleScene
                  ? "bg-[#7c4dff]/25 border-[#7c4dff] text-white"
                  : "bg-[#1f1f1f] border-[#3e3e3e] text-[#aaaaaa] hover:text-white"
              }`}
            >
              {loopSingleScene ? "🔁 선택 장면 반복 중" : "▶ 전체 시퀀스 재생"}
            </button>
          )}
        </div>
      </div>

      {/* Keyframe Preview Thumbnail Strip */}
      <div className="p-4 bg-[#1f1f1f] border-t border-[#3e3e3e]">
        <div className="flex items-center justify-between mb-2.5">
          <div className="text-[12px] font-bold text-[#cccccc] flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-[#c6ff00]">
              view_carousel
            </span>
            <span>
              장면별 키프레임 미리보기 스트립 ({plan.scenes.length}개 장면 · 클릭하여
              시크)
            </span>
          </div>
          <span className="text-[11px] text-[#aaaaaa]">
            보라/라임 테두리 = Argon이 코드로 새로 생성한 설명 장면
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {plan.scenes.map((sc, idx) => {
            const isSelected = sc.id === selectedSceneId;
            const codeInfo = sceneCodes[sc.id];
            const verifyInfo = verifyReport.checks.find(
              (c) => c.sceneId === sc.id
            );

            return (
              <button
                key={sc.id}
                type="button"
                onClick={() => {
                  setPlayerTab("composite");
                  handleSelectSceneAndSeek(sc.id);
                }}
                className={`group text-left rounded-lg overflow-hidden border transition-all cursor-pointer flex flex-col ${
                  isSelected
                    ? "border-[#c6ff00] ring-2 ring-[#c6ff00]/40 bg-[#282828]"
                    : sc.kind === "motion"
                      ? "border-[#7c4dff]/70 hover:border-[#c6ff00] bg-[#242031]"
                      : "border-[#3e3e3e] hover:border-[#3ea6ff] bg-[#282828]"
                }`}
              >
                <div className="relative aspect-video bg-[#111111] w-full overflow-hidden">
                  {thumbnails[sc.id] ? (
                    <img
                      src={thumbnails[sc.id]}
                      alt={sc.caption}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[11px] text-[#aaaaaa]">
                      Rendering...
                    </div>
                  )}

                  {/* Top-left scene index & kind badge */}
                  <span
                    className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                      sc.kind === "motion"
                        ? "bg-[#c6ff00] text-[#111111]"
                        : sc.kind === "ending"
                          ? "bg-[#7c4dff] text-white"
                          : "bg-black/80 text-[#3ea6ff]"
                    }`}
                  >
                    #{idx + 1}{" "}
                    {sc.kind === "motion"
                      ? "★ MOTION"
                      : sc.kind === "ending"
                        ? "ENDING"
                        : "KEEP"}
                  </span>

                  {/* Bottom-right duration */}
                  <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono text-white">
                    {sc.durationSec.toFixed(1)}s
                  </span>
                </div>

                <div className="p-2 flex-1 flex flex-col justify-between">
                  <div className="text-[11px] font-semibold text-white truncate">
                    {sc.caption}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10px]">
                    {codeInfo ? (
                      <span className="text-[#c9b8ff] font-mono">
                        {codeInfo.source === "argon-code"
                          ? `argon (${codeInfo.attempts}회)`
                          : "fallback"}
                      </span>
                    ) : (
                      <span className="text-[#aaaaaa]">원본 카메라</span>
                    )}
                    {verifyInfo?.ok && (
                      <span
                        className="text-[#c6ff00] font-bold"
                        title="시각 검증 통과"
                      >
                        ✓ OK
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
