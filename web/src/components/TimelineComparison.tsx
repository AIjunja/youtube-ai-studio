import React from "react";
import type { ScenePlan } from "../../../shared/contract";

interface TimelineComparisonProps {
  plan: ScenePlan;
  selectedSceneId: string;
  onSelectScene: (sceneId: string) => void;
  activeCutMap: Record<number, boolean>;
  onToggleCut: (index: number) => void;
  rawDurationSec?: number;
}

const CUT_REASON_KO: Record<string, string> = {
  ng: "NG",
  silence: "침묵",
  repeat: "반복",
  offtopic: "이탈",
};

export const TimelineComparison: React.FC<TimelineComparisonProps> = ({
  plan,
  selectedSceneId,
  onSelectScene,
  activeCutMap,
  onToggleCut,
  rawDurationSec = 16.0,
}) => {
  const isScriptOnly =
    plan.mode === "script-only" ||
    (plan.keep.length === 0 && plan.cuts.length === 0);

  const rawTotalSec = Math.max(
    rawDurationSec,
    plan.keep.reduce((m, r) => Math.max(m, r.end), 0),
    plan.cuts.reduce((m, c) => Math.max(m, c.end), 0),
    10
  );

  const totalCompositeSec =
    plan.scenes.reduce((acc, s) => acc + s.durationSec, 0) || 20;

  return (
    <div className="bg-[#282828] border border-[#3e3e3e] rounded-[8px] p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[14px] font-medium text-[#f1f1f1]">
          타임라인 구성
        </h3>
        <div className="flex flex-wrap items-center gap-3 text-[12px] text-[#aaaaaa]">
          {!isScriptOnly && (
            <>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-[2px] bg-[#3ea6ff] inline-block" />
                유지 구간
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-[2px] bg-[#ff4e45] inline-block" />
                잘린 부분 (클릭하여 되살리기/잘라내기)
              </span>
            </>
          )}
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-[2px] bg-[#2ba640] inline-block" />
            AI 설명 장면
          </span>
        </div>
      </div>

      {/* TRACK 1: Raw Original Footage Timeline (hidden in script-only mode) */}
      {!isScriptOnly && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[12px] text-[#aaaaaa]">
            <span>원본 영상 ({rawTotalSec.toFixed(1)}초)</span>
            <span>
              유지 {plan.keep.length}구간 · 잘린 부분 {plan.cuts.length}곳
            </span>
          </div>

          <div className="relative h-10 rounded-[4px] bg-[#181818] border border-[#3e3e3e] overflow-hidden">
            {plan.keep.map((k, idx) => {
              const left = (k.start / rawTotalSec) * 100;
              const width = ((k.end - k.start) / rawTotalSec) * 100;
              return (
                <div
                  key={`keep-${idx}`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  className="absolute top-1 bottom-1 rounded-[2px] bg-[#3ea6ff]/20 border border-[#3ea6ff]/60 flex items-center px-2 overflow-hidden"
                  title={`유지 구간: ${k.start.toFixed(1)}초 ~ ${k.end.toFixed(1)}초`}
                >
                  <span className="text-[11px] text-[#f1f1f1] truncate">
                    유지 ({k.start.toFixed(1)}~{k.end.toFixed(1)}초)
                  </span>
                </div>
              );
            })}

            {plan.cuts.map((c, idx) => {
              const left = (c.start / rawTotalSec) * 100;
              const width = Math.max(4, ((c.end - c.start) / rawTotalSec) * 100);
              const isCutApplied =
                activeCutMap[idx] !== undefined
                  ? activeCutMap[idx]
                  : c.confidence >= 0.7;

              return (
                <button
                  key={`cut-${idx}`}
                  type="button"
                  onClick={() => onToggleCut(idx)}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  className={`absolute top-1 bottom-1 rounded-[2px] px-1.5 flex items-center overflow-hidden cursor-pointer transition-colors ${
                    isCutApplied
                      ? "bg-[#ff4e45]/25 border border-[#ff4e45] text-[#f1f1f1]"
                      : "bg-[#323232] border border-[#717171] text-[#aaaaaa]"
                  }`}
                  title={`${CUT_REASON_KO[c.reason] || c.reason} (${c.start.toFixed(1)}~${c.end.toFixed(1)}초) — 클릭하여 ${
                    isCutApplied ? "되살리기" : "잘라내기"
                  }`}
                >
                  <span
                    className={`text-[10px] truncate ${
                      isCutApplied ? "line-through" : ""
                    }`}
                  >
                    {CUT_REASON_KO[c.reason] || c.reason}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* TRACK 2: Final Composite Sequence */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[12px] text-[#aaaaaa]">
          <span>완성 영상 ({totalCompositeSec.toFixed(1)}초)</span>
          <span>
            AI 설명 장면 {plan.scenes.filter((s) => s.kind === "motion").length}개 포함
          </span>
        </div>

        <div className="flex items-stretch gap-1 h-12 w-full">
          {plan.scenes.map((scene, idx) => {
            const widthPct = (scene.durationSec / totalCompositeSec) * 100;
            const isSelected = scene.id === selectedSceneId;

            const kindBadge =
              scene.kind === "motion"
                ? "AI 설명"
                : scene.kind === "ending"
                  ? "마무리"
                  : "원본";

            return (
              <button
                key={scene.id}
                type="button"
                onClick={() => onSelectScene(scene.id)}
                style={{ width: `${widthPct}%` }}
                className={`rounded-[4px] px-2 py-1 text-left flex flex-col justify-between overflow-hidden transition-colors cursor-pointer border ${
                  isSelected
                    ? "bg-[#323232] border-[#3ea6ff]"
                    : scene.kind === "motion"
                      ? "bg-[#181818] border-[#2ba640]/70 hover:bg-[#323232]"
                      : "bg-[#181818] border-[#3e3e3e] hover:bg-[#323232]"
                }`}
              >
                <div className="flex items-center justify-between gap-1 text-[10px] text-[#aaaaaa]">
                  <span className="truncate font-medium text-[#f1f1f1]">
                    {kindBadge}
                  </span>
                  <span className="font-mono shrink-0">
                    {scene.durationSec.toFixed(1)}초
                  </span>
                </div>
                <div className="text-[11px] text-[#f1f1f1] truncate">
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
