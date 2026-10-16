import React from "react";
import type { ScenePlan } from "../../../shared/contract";

interface TimelineComparisonProps {
  plan: ScenePlan;
  selectedSceneId: string;
  onSelectScene: (sceneId: string) => void;
  lowConfCutEnabledMap: Record<number, boolean>;
}

export const TimelineComparison: React.FC<TimelineComparisonProps> = ({
  plan,
  selectedSceneId,
  onSelectScene,
  lowConfCutEnabledMap,
}) => {
  const rawTotalSec = 16.0;
  const totalCompositeSec =
    plan.scenes.reduce((acc, s) => acc + s.durationSec, 0) || 20;

  return (
    <div className="bg-[#282828] border border-[#3e3e3e] rounded-xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-[#3ea6ff]">
            view_timeline
          </span>
          <h3 className="text-[15px] font-bold text-white">
            타임라인 구조 비교 (원본 컷/공백 vs AI 완성 시퀀스)
          </h3>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#cccccc]">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-[#3ea6ff]/80 inline-block" />
            원본 Keep
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-[#f04438]/40 border border-dashed border-[#f04438] inline-block" />
            자동 컷 (≥70%)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-[#f59e0b]/30 border border-dashed border-[#f59e0b] inline-block" />
            컷 제안 (&lt;70%)
          </span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#c6ff00]">
            <span className="w-3 h-3 rounded-sm bg-gradient-to-r from-[#7c4dff] to-[#c6ff00] inline-block" />
            ★ 찍지 않은 설명 장면 (Motion)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-[#111111] border border-[#c6ff00] inline-block" />
            엔딩 카드
          </span>
        </div>
      </div>

      {/* TRACK 1: Raw Original Footage Timeline (Keep + Cuts + Gaps) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[12px]">
          <span className="font-semibold text-[#aaaaaa]">
            ① 원본 촬영본 분석 (총 {rawTotalSec.toFixed(1)}s)
          </span>
          <span className="text-[11px] text-[#aaaaaa]">
            Keep {plan.keep.length}구간 · Cut {plan.cuts.length}구간 · 빠진 설명{" "}
            <strong className="text-[#c6ff00]">{plan.gaps.length}곳</strong>
          </span>
        </div>

        <div className="relative h-12 rounded-lg bg-[#181818] border border-[#3e3e3e] overflow-hidden">
          {/* Keep blocks */}
          {plan.keep.map((k, idx) => {
            const left = (k.start / rawTotalSec) * 100;
            const width = ((k.end - k.start) / rawTotalSec) * 100;
            return (
              <div
                key={`keep-${idx}`}
                style={{ left: `${left}%`, width: `${width}%` }}
                className="absolute top-1.5 bottom-1.5 rounded bg-[#3ea6ff]/25 border border-[#3ea6ff] flex flex-col justify-center px-2 overflow-hidden"
                title={`Keep 구간: ${k.start.toFixed(1)}s ~ ${k.end.toFixed(1)}s`}
              >
                <span className="text-[11px] font-bold text-[#3ea6ff] truncate">
                  KEEP ({k.start.toFixed(1)}~{k.end.toFixed(1)}s)
                </span>
              </div>
            );
          })}

          {/* Cut blocks */}
          {plan.cuts.map((c, idx) => {
            const left = (c.start / rawTotalSec) * 100;
            const width = Math.max(4, ((c.end - c.start) / rawTotalSec) * 100);
            const isAutoCut = c.confidence >= 0.7;
            const isApplied = isAutoCut || !!lowConfCutEnabledMap[idx];

            return (
              <div
                key={`cut-${idx}`}
                style={{ left: `${left}%`, width: `${width}%` }}
                className={`absolute top-1.5 bottom-1.5 rounded px-1.5 flex flex-col justify-center overflow-hidden ${
                  isAutoCut
                    ? "bg-[#f04438]/25 border border-dashed border-[#f04438] text-[#fda29b]"
                    : "bg-[#f59e0b]/25 border border-dashed border-[#f59e0b] text-[#fde68a]"
                }`}
                title={`${c.reason.toUpperCase()} (${Math.round(c.confidence * 100)}%): ${c.note || ""}`}
              >
                <span
                  className={`text-[10px] font-bold truncate ${
                    isApplied ? "line-through" : ""
                  }`}
                >
                  {isAutoCut ? `✂️ ${c.reason.toUpperCase()}` : `💡 제안`} (
                  {Math.round(c.confidence * 100)}%)
                </span>
              </div>
            );
          })}

          {/* Explanation Gap Pins */}
          {plan.gaps.map((g, idx) => {
            const left = Math.min(96, Math.max(3, (g.atSec / rawTotalSec) * 100));
            return (
              <div
                key={`gap-${idx}`}
                style={{ left: `${left}%` }}
                title={`빠진 설명 발견 (${g.atSec}s): ${g.missing}`}
                className="absolute top-0 bottom-0 -translate-x-1/2 z-10 flex flex-col items-center justify-between pointer-events-none"
              >
                <span className="px-1.5 py-0.5 rounded bg-[#c6ff00] text-[#111111] text-[9px] font-black shadow whitespace-nowrap">
                  ★ 설명 공백 @{g.atSec}s
                </span>
                <div className="w-0.5 flex-1 bg-[#c6ff00]" />
              </div>
            );
          })}
        </div>
      </div>

      {/* TRACK 2: AI Composite Sequence Timeline */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[12px]">
          <span className="font-semibold text-white">
            ② AI 완성 시퀀스 타임라인 (총 {totalCompositeSec.toFixed(1)}s · 장면 클릭
            시 이동)
          </span>
          <span className="text-[11px] text-[#c6ff00] font-semibold">
            ★ 찍지 않은 설명 모션그래픽 {plan.scenes.filter((s) => s.kind === "motion").length}개 +
            엔딩 카드 자동 합성됨
          </span>
        </div>

        <div className="flex items-stretch gap-1.5 h-16 w-full">
          {plan.scenes.map((scene, idx) => {
            const widthPct = (scene.durationSec / totalCompositeSec) * 100;
            const isSelected = scene.id === selectedSceneId;

            if (scene.kind === "motion") {
              return (
                <button
                  key={scene.id}
                  type="button"
                  onClick={() => onSelectScene(scene.id)}
                  style={{ width: `${widthPct}%` }}
                  className={`group relative rounded-lg p-2 text-left flex flex-col justify-between overflow-hidden transition-all cursor-pointer bg-gradient-to-r from-[#7c4dff]/35 via-[#5c6cff]/30 to-[#c6ff00]/25 ${
                    isSelected
                      ? "ring-2 ring-[#c6ff00] border-2 border-[#c6ff00] shadow-md shadow-[#c6ff00]/20"
                      : "border border-[#7c4dff] hover:border-[#c6ff00]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="px-1.5 py-0.5 rounded bg-[#c6ff00] text-[#111111] text-[10px] font-black truncate">
                      ★ 찍지 않은 설명 장면
                    </span>
                    <span className="text-[10px] font-mono text-white shrink-0">
                      {scene.durationSec.toFixed(1)}s
                    </span>
                  </div>
                  <div className="text-[11px] font-bold text-white truncate">
                    #{idx + 1} {scene.caption}
                  </div>
                </button>
              );
            }

            if (scene.kind === "ending") {
              return (
                <button
                  key={scene.id}
                  type="button"
                  onClick={() => onSelectScene(scene.id)}
                  style={{ width: `${widthPct}%` }}
                  className={`relative rounded-lg p-2 text-left flex flex-col justify-between overflow-hidden transition-all cursor-pointer bg-[#111111] ${
                    isSelected
                      ? "ring-2 ring-[#c6ff00] border-2 border-[#c6ff00]"
                      : "border border-[#c6ff00]/70 hover:border-[#c6ff00]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="px-1.5 py-0.5 rounded bg-[#c6ff00]/20 border border-[#c6ff00] text-[#c6ff00] text-[10px] font-bold truncate">
                      ENDING
                    </span>
                    <span className="text-[10px] font-mono text-[#aaaaaa] shrink-0">
                      {scene.durationSec.toFixed(1)}s
                    </span>
                  </div>
                  <div className="text-[11px] font-bold text-white truncate">
                    #{idx + 1} {scene.caption}
                  </div>
                </button>
              );
            }

            return (
              <button
                key={scene.id}
                type="button"
                onClick={() => onSelectScene(scene.id)}
                style={{ width: `${widthPct}%` }}
                className={`relative rounded-lg p-2 text-left flex flex-col justify-between overflow-hidden transition-all cursor-pointer bg-[#3ea6ff]/15 ${
                  isSelected
                    ? "ring-2 ring-[#3ea6ff] border-2 border-[#3ea6ff] bg-[#3ea6ff]/25"
                    : "border border-[#3ea6ff]/50 hover:border-[#3ea6ff]"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="px-1.5 py-0.5 rounded bg-[#3ea6ff]/25 text-[#3ea6ff] text-[10px] font-bold truncate">
                    원본 KEEP
                  </span>
                  <span className="text-[10px] font-mono text-[#cccccc] shrink-0">
                    {scene.durationSec.toFixed(1)}s
                  </span>
                </div>
                <div className="text-[11px] font-semibold text-white truncate">
                  #{idx + 1} {scene.caption}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
