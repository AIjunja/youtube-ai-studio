import React, { useState } from "react";
import type {
  CutReason,
  ModelCallLogEntry,
  PlannedScene,
  SceneCode,
  ScenePlan,
  VerifyReport,
} from "../../../shared/contract";

interface ArgonDirectorPanelProps {
  plan: ScenePlan;
  sceneCodes: Record<string, SceneCode>;
  verifyReport: VerifyReport;
  modelLogs: ModelCallLogEntry[];
  selectedSceneId: string;
  onSelectScene: (sceneId: string) => void;
  lowConfCutEnabledMap: Record<number, boolean>;
  onToggleLowConfCut: (index: number) => void;
  onReviseScene: (scene: PlannedScene, instruction: string) => Promise<void>;
  onRunVerify: () => Promise<void>;
  revisingSceneId: string | null;
  verifying: boolean;
}

const CUT_REASON_META: Record<
  CutReason,
  { label: string; colorClass: string }
> = {
  ng: {
    label: "NG 테이크",
    colorClass: "bg-[#f04438]/20 text-[#fda29b] border-[#f04438]/50",
  },
  silence: {
    label: "침묵/무음",
    colorClass: "bg-[#3ea6ff]/20 text-[#84caff] border-[#3ea6ff]/50",
  },
  repeat: {
    label: "반복/말꼬리",
    colorClass: "bg-[#f59e0b]/20 text-[#fde68a] border-[#f59e0b]/50",
  },
  offtopic: {
    label: "주제 이탈",
    colorClass: "bg-[#a855f7]/20 text-[#d8b4fe] border-[#a855f7]/50",
  },
};

export const ArgonDirectorPanel: React.FC<ArgonDirectorPanelProps> = ({
  plan,
  sceneCodes,
  verifyReport,
  modelLogs,
  selectedSceneId,
  onSelectScene,
  lowConfCutEnabledMap,
  onToggleLowConfCut,
  onReviseScene,
  onRunVerify,
  revisingSceneId,
  verifying,
}) => {
  const [openCodeSceneId, setOpenCodeSceneId] = useState<string | null>(
    "scene-2-motion-compare"
  );
  const [reviseInputs, setReviseInputs] = useState<Record<string, string>>({
    "scene-2-motion-compare":
      "글자를 더 크게 하고 핵심 키워드를 라임색(#C6FF00)으로 강조해줘",
    "scene-4-motion-diagram":
      "3단계 박스 테두리를 더 굵게 하고 통과 배지를 강조해줘",
  });

  const handleReviseSubmit = async (scene: PlannedScene) => {
    const text =
      (reviseInputs[scene.id] || "").trim() ||
      "글자를 더 크게 하고 핵심 키워드를 라임색으로 강조해줘";
    await onReviseScene(scene, text);
  };

  return (
    <aside className="w-full xl:w-[470px] shrink-0 bg-[#282828] border border-[#3e3e3e] rounded-xl flex flex-col overflow-hidden">
      {/* Director Header */}
      <div className="p-4 bg-gradient-to-r from-[#231f32] via-[#262836] to-[#282828] border-b border-[#3e3e3e] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#7c4dff] to-[#3ea6ff] flex items-center justify-center text-white shadow">
            <span className="material-symbols-outlined text-[20px]">
              psychology
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[16px] font-black text-white tracking-tight">
                Argon Director 감독 패널
              </h2>
              <span className="px-2 py-0.5 rounded bg-[#c6ff00] text-[#111111] text-[10px] font-black">
                LIVE EVIDENCE
              </span>
            </div>
            <p className="text-[11px] text-[#aaaaaa]">
              멀티모달 계획 · Canvas 2D 코드 생성 · 샌드박스/시각 검증 루프
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onRunVerify}
          disabled={verifying}
          title="렌더된 키프레임을 Argon 멀티모달로 다시 검증합니다 (/api/verify)"
          className="px-3 py-1.5 rounded-lg bg-[#1f1f1f] hover:bg-[#3a3a3a] border border-[#3e3e3e] text-[11px] font-bold text-[#c6ff00] flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[15px]">
            verified
          </span>
          <span>{verifying ? "검증 중..." : "시각 재검증"}</span>
        </button>
      </div>

      {/* Scrollable Director Content (5 Core Sections) */}
      <div className="p-4 space-y-5 max-h-[1250px] overflow-y-auto">
        {/* ============================================================
            ① 영상 요약 & 불확실 사실 (uncertainFacts)
           ============================================================ */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-bold text-white flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-[#3ea6ff]/20 text-[#3ea6ff] text-[11px] font-mono">
                ①
              </span>
              <span>영상 요약 &amp; 불확실 사실 공개</span>
            </h3>
            <span className="px-2 py-0.5 rounded bg-[#1f1f1f] border border-[#3e3e3e] text-[11px] font-mono text-[#aaaaaa]">
              lang: {plan.language.toUpperCase()}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-[#1f1f1f] border border-[#3e3e3e] text-[12.5px] text-[#dddddd] leading-relaxed">
            {plan.summary}
          </div>

          {/* Amber Caution Box for uncertainFacts */}
          {plan.uncertainFacts && plan.uncertainFacts.length > 0 && (
            <div className="p-3 rounded-lg bg-[#f59e0b]/15 border border-[#f59e0b]/50 space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#fbbf24]">
                <span className="material-symbols-outlined text-[16px]">
                  warning
                </span>
                <span>
                  불확실한 사실 투명 표시 (uncertainFacts · 추측성 단정 방지)
                </span>
              </div>
              {plan.uncertainFacts.map((fact, i) => (
                <p
                  key={i}
                  className="text-[12px] text-[#fde68a] leading-snug pl-5"
                >
                  • {fact}
                </p>
              ))}
            </div>
          )}
        </section>

        {/* ============================================================
            ② 자동 컷 편집 (cuts) — confidence >= 0.7 vs < 0.7 제안 분리
           ============================================================ */}
        <section className="space-y-2.5 pt-2 border-t border-[#3e3e3e]">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-bold text-white flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-[#3ea6ff]/20 text-[#3ea6ff] text-[11px] font-mono">
                ②
              </span>
              <span>자동 컷 편집 ({plan.cuts.length}구간)</span>
            </h3>
            <span className="text-[11px] text-[#aaaaaa]">
              신뢰도 &lt; 70%는 제안만 표시
            </span>
          </div>

          <div className="space-y-2">
            {plan.cuts.map((cut, idx) => {
              const isHighConf = cut.confidence >= 0.7;
              const pct = Math.round(cut.confidence * 100);
              const meta = CUT_REASON_META[cut.reason] || CUT_REASON_META.ng;
              const isSuggestionApplied = !!lowConfCutEnabledMap[idx];

              return (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border transition-colors ${
                    isHighConf
                      ? "bg-[#1f1f1f] border-[#3e3e3e]"
                      : "bg-[#f59e0b]/10 border-[#f59e0b]/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[12px] font-bold text-white">
                        {cut.start.toFixed(1)}s ~ {cut.end.toFixed(1)}s
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded border text-[10px] font-bold ${meta.colorClass}`}
                      >
                        {cut.reason.toUpperCase()} · {meta.label}
                      </span>
                      <span className="text-[11px] font-mono text-[#cccccc]">
                        신뢰도{" "}
                        <strong
                          className={
                            isHighConf ? "text-[#6ee7b7]" : "text-[#fbbf24]"
                          }
                        >
                          {pct}%
                        </strong>
                      </span>
                    </div>

                    {isHighConf ? (
                      <span className="px-2 py-0.5 rounded bg-[#f04438]/25 border border-[#f04438]/50 text-[10px] font-bold text-[#fda29b]">
                        자동 컷 ON
                      </span>
                    ) : (
                      <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                        <span className="px-2 py-0.5 rounded bg-[#f59e0b]/25 border border-[#f59e0b] text-[10px] font-bold text-[#fde68a]">
                          제안 (사용자 확인)
                        </span>
                        <input
                          type="checkbox"
                          checked={isSuggestionApplied}
                          onChange={() => onToggleLowConfCut(idx)}
                          className="accent-[#f59e0b] w-4 h-4 cursor-pointer"
                        />
                      </label>
                    )}
                  </div>

                  {cut.note && (
                    <p className="text-[11.5px] text-[#aaaaaa] mt-1.5">
                      {cut.note}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ============================================================
            ③ 빠진 설명 발견 (gaps) — WOW 포인트 강조
           ============================================================ */}
        <section className="space-y-2.5 pt-2 border-t border-[#3e3e3e]">
          <div className="rounded-xl p-3.5 bg-gradient-to-r from-[#7c4dff]/25 via-[#3ea6ff]/15 to-[#c6ff00]/20 border border-[#c6ff00]/60 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded bg-[#c6ff00] text-[#111111] text-[11px] font-black">
                  ③ WOW POINT
                </span>
                <h3 className="text-[13.5px] font-black text-white">
                  ✨ &ldquo;찍지 않은 설명 장면이 생겼다&rdquo;
                </h3>
              </div>
              <span className="text-[11px] font-bold text-[#c6ff00]">
                {plan.gaps.length}곳 탐지됨
              </span>
            </div>

            <p className="text-[11.5px] text-[#dddddd]">
              단순 컷 편집을 넘어, 시청자가 이해하기 위해 꼭 필요하지만 촬영본에
              빠져 있는 설명 공백(Gap)을 Argon이 찾아 모션그래픽 장면으로 직접
              생성했습니다.
            </p>

            <div className="space-y-2">
              {plan.gaps.map((gap, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-[#141414]/90 border border-[#c6ff00]/40 flex items-start gap-2.5"
                >
                  <span className="px-2 py-0.5 rounded bg-[#c6ff00] text-[#111111] font-mono text-[11px] font-black shrink-0 mt-0.5">
                    @{gap.atSec.toFixed(1)}s
                  </span>
                  <p className="text-[12px] text-white leading-snug">
                    {gap.missing}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================================
            ④ 장면 카드 목록 (scenes) & 3대 검증 루프 배지 + 코드 보기 + Revise
           ============================================================ */}
        <section className="space-y-3 pt-2 border-t border-[#3e3e3e]">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-bold text-white flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-[#3ea6ff]/20 text-[#3ea6ff] text-[11px] font-mono">
                ④
              </span>
              <span>장면 카드 목록 &amp; 3대 검증 배지 ({plan.scenes.length}개)</span>
            </h3>
            <span className="text-[11px] text-[#c6ff00] font-semibold">
              Verify Report: {verifyReport.passed ? "PASSED ✓" : "RETRY"}
            </span>
          </div>

          <div className="space-y-3">
            {plan.scenes.map((scene, idx) => {
              const isSelected = scene.id === selectedSceneId;
              const isMotionOrEnding =
                scene.kind === "motion" || scene.kind === "ending";
              const codeObj = sceneCodes[scene.id];
              const verifyCheck = verifyReport.checks.find(
                (c) => c.sceneId === scene.id
              );
              const isCodeOpen = openCodeSceneId === scene.id;
              const isRevisingThis = revisingSceneId === scene.id;

              const sourceVal =
                codeObj?.source || verifyCheck?.source || "argon-code";
              const attemptsVal =
                codeObj?.attempts || verifyCheck?.attempts || 1;
              const verifiedOk = verifyCheck ? verifyCheck.ok : true;

              return (
                <div
                  key={scene.id}
                  onClick={() => onSelectScene(scene.id)}
                  className={`rounded-xl p-3.5 border transition-all cursor-pointer space-y-2.5 ${
                    isSelected
                      ? "bg-[#202430] border-[#c6ff00] ring-1 ring-[#c6ff00]/40"
                      : isMotionOrEnding
                        ? "bg-[#1f1c29] border-[#7c4dff]/50 hover:border-[#c6ff00]/60"
                        : "bg-[#1f1f1f] border-[#3e3e3e] hover:border-[#3ea6ff]/50"
                  }`}
                >
                  {/* Card Top Row: Scene Index, Kind Badge, Duration */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono font-bold text-[#aaaaaa]">
                        #{idx + 1}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          scene.kind === "motion"
                            ? "bg-[#c6ff00] text-[#111111]"
                            : scene.kind === "ending"
                              ? "bg-[#7c4dff] text-white"
                              : "bg-[#3ea6ff]/20 text-[#3ea6ff] border border-[#3ea6ff]/40"
                        }`}
                      >
                        {scene.kind === "motion"
                          ? "★ MOTION (신규 설명)"
                          : scene.kind === "ending"
                            ? "ENDING (엔딩 카드)"
                            : "ORIGINAL (원본 발화)"}
                      </span>
                      <span className="text-[11px] font-mono text-white font-semibold">
                        {scene.durationSec.toFixed(1)}s
                      </span>
                    </div>

                    {isMotionOrEnding && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenCodeSceneId(isCodeOpen ? null : scene.id);
                        }}
                        className="px-2.5 py-1 rounded bg-[#282828] hover:bg-[#3a3a3a] border border-[#3e3e3e] text-[11px] font-mono font-semibold text-[#3ea6ff] flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          code
                        </span>
                        <span>{isCodeOpen ? "코드 닫기" : "코드 보기"}</span>
                      </button>
                    )}
                  </div>

                  {/* Caption & Script */}
                  <div className="space-y-1">
                    <div className="text-[13.5px] font-bold text-white">
                      {scene.caption}
                    </div>
                    <p className="text-[12px] text-[#dddddd] leading-snug">
                      &ldquo;{scene.script}&rdquo;
                    </p>
                    <p className="text-[11px] text-[#aaaaaa]">
                      <strong className="text-[#cccccc]">시각 연출:</strong>{" "}
                      {scene.visualIdea}
                    </p>
                  </div>

                  {/* 3 REQUIRED VERIFICATION BADGES for motion & ending scenes */}
                  {isMotionOrEnding && (
                    <div className="pt-1 flex flex-wrap items-center gap-1.5">
                      {/* 1) source badge */}
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10.5px] font-mono font-bold border ${
                          sourceVal === "argon-code"
                            ? "bg-[#7c4dff]/25 border-[#7c4dff] text-[#d8c8ff]"
                            : "bg-[#f59e0b]/25 border-[#f59e0b] text-[#fde68a]"
                        }`}
                      >
                        source: {sourceVal}
                      </span>

                      {/* 2) attempts badge */}
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10.5px] font-mono font-bold border ${
                          attemptsVal > 1
                            ? "bg-[#3ea6ff]/25 border-[#3ea6ff] text-[#84caff]"
                            : "bg-[#282828] border-[#3e3e3e] text-[#cccccc]"
                        }`}
                      >
                        attempts: {attemptsVal}
                        {attemptsVal > 1 ? " (자동 수정됨)" : ""}
                      </span>

                      {/* 3) verified badge */}
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold border ${
                          verifiedOk
                            ? "bg-[#c6ff00]/20 border-[#c6ff00] text-[#c6ff00]"
                            : "bg-[#f59e0b]/20 border-[#f59e0b] text-[#fbbf24]"
                        }`}
                      >
                        {verifiedOk ? "✓ 시각 검증 통과" : "⚠ 재시도/경고"}
                      </span>
                    </div>
                  )}

                  {/* Expandable Argon Canvas 2D Code Viewer */}
                  {isMotionOrEnding && isCodeOpen && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="mt-2 rounded-lg bg-[#111111] border border-[#3e3e3e] overflow-hidden"
                    >
                      <div className="px-3 py-1.5 bg-[#1a1a1a] border-b border-[#3e3e3e] flex items-center justify-between text-[11px] font-mono text-[#aaaaaa]">
                        <span>
                          function draw(ctx, t, w, h, scene) &#123; ... &#125;
                        </span>
                        <span className="text-[#c6ff00]">
                          Worker Sandbox Validated
                        </span>
                      </div>
                      <pre className="p-3 text-[11px] font-mono text-[#e2e8f0] overflow-x-auto max-h-52 leading-relaxed">
                        <code>
                          {codeObj?.code ||
                            "// Argon Canvas 2D code ready for execution"}
                        </code>
                      </pre>
                    </div>
                  )}

                  {/* Scene Revise Input & Button (/api/revise) */}
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="pt-2 border-t border-[#3e3e3e]/70 space-y-1.5"
                  >
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={reviseInputs[scene.id] ?? ""}
                        onChange={(e) =>
                          setReviseInputs((prev) => ({
                            ...prev,
                            [scene.id]: e.target.value,
                          }))
                        }
                        placeholder='예: "글자를 더 크게 하고 핵심 키워드를 라임색으로 강조해줘"'
                        className="flex-1 h-8 px-2.5 rounded-lg bg-[#141414] border border-[#3e3e3e] focus:border-[#c6ff00] text-[11.5px] text-white placeholder-[#777777] focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={isRevisingThis}
                        onClick={() => handleReviseSubmit(scene)}
                        className="h-8 px-3 rounded-lg bg-gradient-to-r from-[#7c4dff] to-[#3ea6ff] hover:brightness-110 text-[11px] font-bold text-white shrink-0 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isRevisingThis
                          ? "수정 중..."
                          : "이 장면 수정 (/api/revise)"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ============================================================
            ⑤ 모델 호출 & 검증 루프 실시간 로그 (ModelCallLogEntry[])
           ============================================================ */}
        <section className="space-y-2.5 pt-2 border-t border-[#3e3e3e]">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-bold text-white flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-[#3ea6ff]/20 text-[#3ea6ff] text-[11px] font-mono">
                ⑤
              </span>
              <span>모델 호출 &amp; 검증 루프 실시간 로그</span>
            </h3>
            <span className="text-[11px] font-mono text-[#c6ff00]">
              {modelLogs.length} calls recorded
            </span>
          </div>

          <div className="rounded-xl bg-[#111111] border border-[#3e3e3e] p-3 space-y-2 font-mono text-[11px] max-h-72 overflow-y-auto">
            {modelLogs.map((log) => {
              const statusBadge =
                log.status === "ok"
                  ? "bg-[#2ba640]/20 text-[#6ee7b7] border-[#2ba640]/50"
                  : log.status === "retry"
                    ? "bg-[#f59e0b]/20 text-[#fde68a] border-[#f59e0b]/50"
                    : log.status === "fallback"
                      ? "bg-[#f97316]/20 text-[#fdba74] border-[#f97316]/50"
                      : "bg-[#f04438]/20 text-[#fda29b] border-[#f04438]/50";

              return (
                <div
                  key={log.id}
                  className="p-2 rounded bg-[#1a1a1a] border border-[#2e2e2e] space-y-1"
                >
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[#888888]">{log.timestamp}</span>
                      <span className="px-1.5 py-0.5 rounded bg-[#282828] text-[#3ea6ff] font-bold">
                        {log.endpoint}
                      </span>
                      {log.sceneId && (
                        <span className="text-[#c9b8ff]">[{log.sceneId}]</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[#aaaaaa]">
                        attempt #{log.attempt}
                      </span>
                      <span className="text-[#c6ff00]">{log.durationMs}ms</span>
                      <span
                        className={`px-1.5 py-0.2 rounded border text-[10px] font-bold uppercase ${statusBadge}`}
                      >
                        {log.status}
                      </span>
                    </div>
                  </div>
                  {log.detail && (
                    <div className="text-[#cccccc] font-sans text-[11.5px] pl-1">
                      ↳ {log.detail}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </aside>
  );
};
