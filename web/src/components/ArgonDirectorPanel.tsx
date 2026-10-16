import React, { useState } from "react";
import type {
  CutReason,
  ModelCallLogEntry,
  PlannedScene,
  SceneCode,
  ScenePlan,
  VerifyReport,
} from "../../../shared/contract";

export type ReviewTabId = "subtitles" | "cuts" | "ai-scenes" | "logs";

interface ArgonDirectorPanelProps {
  plan: ScenePlan;
  sceneCodes: Record<string, SceneCode>;
  verifyReport: VerifyReport;
  modelLogs: ModelCallLogEntry[];
  selectedSceneId: string;
  onSelectScene: (sceneId: string) => void;
  activeCutMap: Record<number, boolean>;
  onToggleCut: (index: number) => void;
  onPreviewCutInRaw: (startSec: number) => void;
  onUpdateTranscriptText: (index: number, newText: string) => void;
  onUpdateSceneText: (
    sceneId: string,
    updates: { caption?: string; script?: string }
  ) => void;
  onSynthesizeSceneTts: (scene: PlannedScene, autoPlay?: boolean) => Promise<void>;
  ttsLoadingSceneId: string | null;
  onReviseScene: (scene: PlannedScene, instruction: string) => Promise<void>;
  onRunVerify: () => Promise<void>;
  revisingSceneId: string | null;
  verifying: boolean;
}

const CUT_REASON_LABEL: Record<CutReason, string> = {
  ng: "NG",
  silence: "침묵",
  repeat: "반복",
  offtopic: "주제 이탈",
};

function formatTimeSec(sec: number): string {
  const safe = Math.max(0, sec);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${s.toFixed(1).padStart(4, "0")}`;
}

export const ArgonDirectorPanel: React.FC<ArgonDirectorPanelProps> = ({
  plan,
  sceneCodes,
  verifyReport,
  modelLogs,
  selectedSceneId,
  onSelectScene,
  activeCutMap,
  onToggleCut,
  onPreviewCutInRaw,
  onUpdateTranscriptText,
  onUpdateSceneText,
  onSynthesizeSceneTts,
  ttsLoadingSceneId,
  onReviseScene,
  onRunVerify,
  revisingSceneId,
  verifying,
}) => {
  const [activeTab, setActiveTab] = useState<ReviewTabId>("subtitles");
  const [openCodeSceneId, setOpenCodeSceneId] = useState<string | null>(null);
  const [reviseInputs, setReviseInputs] = useState<Record<string, string>>({});
  const [playingSceneId, setPlayingSceneId] = useState<string | null>(null);

  const aiScenes = plan.scenes.filter(
    (s) => s.kind === "motion" || s.kind === "ending"
  );

  const handlePlaySceneAudio = async (scene: PlannedScene) => {
    const src =
      scene.audioUrl ||
      (scene.audioBase64
        ? scene.audioBase64.startsWith("data:")
          ? scene.audioBase64
          : `data:audio/wav;base64,${scene.audioBase64}`
        : "");

    if (src) {
      setPlayingSceneId(scene.id);
      const audio = new Audio(src);
      audio.onended = () => setPlayingSceneId(null);
      audio.onerror = () => setPlayingSceneId(null);
      await audio.play().catch(() => setPlayingSceneId(null));
    } else {
      await onSynthesizeSceneTts(scene, true);
    }
  };

  return (
    <div className="w-full bg-[#282828] border border-[#3e3e3e] rounded-[8px] flex flex-col overflow-hidden">
      {/* Top 4 Review Tabs */}
      <div className="flex border-b border-[#3e3e3e] bg-[#282828] overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("subtitles")}
          className={`px-4 py-3 text-[14px] font-medium whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
            activeTab === "subtitles"
              ? "border-[#3ea6ff] text-[#f1f1f1]"
              : "border-transparent text-[#aaaaaa] hover:text-[#f1f1f1]"
          }`}
        >
          자막
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("cuts")}
          className={`px-4 py-3 text-[14px] font-medium whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
            activeTab === "cuts"
              ? "border-[#3ea6ff] text-[#f1f1f1]"
              : "border-transparent text-[#aaaaaa] hover:text-[#f1f1f1]"
          }`}
        >
          잘린 부분 ({plan.cuts.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("ai-scenes")}
          className={`px-4 py-3 text-[14px] font-medium whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
            activeTab === "ai-scenes"
              ? "border-[#3ea6ff] text-[#f1f1f1]"
              : "border-transparent text-[#aaaaaa] hover:text-[#f1f1f1]"
          }`}
        >
          AI 장면 ({aiScenes.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("logs")}
          className={`px-4 py-3 text-[14px] font-medium whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
            activeTab === "logs"
              ? "border-[#3ea6ff] text-[#f1f1f1]"
              : "border-transparent text-[#aaaaaa] hover:text-[#f1f1f1]"
          }`}
        >
          AI 작업 기록
        </button>
      </div>

      {/* Tab Content */}
      <div className="p-4 space-y-4 max-h-[720px] overflow-y-auto">
        {/* ==================== TAB 1: 자막 ==================== */}
        {activeTab === "subtitles" && (
          <div className="space-y-4">
            <div className="text-[12px] text-[#aaaaaa]">
              자막을 클릭해 바로 수정하면 오른쪽 미리보기와 내보내기 영상에 즉시 반영됩니다.
            </div>

            {plan.transcript.length > 0 && (
              <div className="space-y-2">
                <div className="text-[12px] font-medium text-[#aaaaaa]">
                  원본 음성 자막
                </div>
                {plan.transcript.map((item, idx) => (
                  <div
                    key={`tr-${idx}`}
                    className="p-3 rounded-[4px] bg-[#181818] border border-[#3e3e3e] flex items-start gap-3"
                  >
                    <span className="text-[12px] font-mono text-[#aaaaaa] pt-1.5 shrink-0">
                      {formatTimeSec(item.start)}
                    </span>
                    <input
                      type="text"
                      value={item.text}
                      onChange={(e) =>
                        onUpdateTranscriptText(idx, e.target.value)
                      }
                      aria-label={`자막 ${idx + 1}`}
                      className="flex-1 bg-[#282828] border border-[#3e3e3e] focus:border-[#3ea6ff] rounded-[4px] px-2.5 py-1.5 text-[14px] text-[#f1f1f1] focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <div className="text-[12px] font-medium text-[#aaaaaa]">
                완성 영상 장면별 자막 ({plan.scenes.length}개)
              </div>
              {plan.scenes.map((scene, idx) => {
                const isSelected = scene.id === selectedSceneId;
                return (
                  <div
                    key={scene.id}
                    onClick={() => onSelectScene(scene.id)}
                    className={`p-3 rounded-[4px] border transition-colors cursor-pointer space-y-2 ${
                      isSelected
                        ? "bg-[#1f1f1f] border-[#3ea6ff] border-l-[3px]"
                        : "bg-[#181818] border-[#3e3e3e] hover:bg-[#323232]"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[12px] text-[#aaaaaa]">
                      <span>
                        #{idx + 1}{" "}
                        {scene.kind === "motion"
                          ? "AI 설명 장면"
                          : scene.kind === "ending"
                            ? "마무리 장면"
                            : "원본 구간"}
                      </span>
                      <span className="font-mono">
                        {scene.durationSec.toFixed(1)}초
                      </span>
                    </div>
                    <input
                      type="text"
                      value={scene.script}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        onUpdateSceneText(scene.id, { script: e.target.value })
                      }
                      placeholder="화면에 표시할 자막을 입력하세요"
                      className="w-full bg-[#282828] border border-[#3e3e3e] focus:border-[#3ea6ff] rounded-[4px] px-2.5 py-1.5 text-[14px] text-[#f1f1f1] focus:outline-none"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================== TAB 2: 잘린 부분 ==================== */}
        {activeTab === "cuts" && (
          <div className="space-y-3">
            {plan.cuts.length === 0 ? (
              <div className="p-6 rounded-[4px] bg-[#181818] border border-[#3e3e3e] text-center text-[14px] text-[#aaaaaa]">
                원본 영상에서 잘린 구간이 없습니다.
              </div>
            ) : (
              <>
                <div className="text-[12px] text-[#aaaaaa]">
                  말이 끊기거나 실수한 구간입니다. 되살리기를 누르면 완성 영상에 다시 포함됩니다.
                </div>
                {plan.cuts.map((cut, idx) => {
                  const isCutApplied =
                    activeCutMap[idx] !== undefined
                      ? activeCutMap[idx]
                      : cut.confidence >= 0.7;

                  return (
                    <div
                      key={idx}
                      className="p-3.5 rounded-[4px] bg-[#181818] border border-[#3e3e3e] space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-[4px] bg-[#282828] border border-[#3e3e3e] text-[12px] font-medium text-[#f1f1f1]">
                            {CUT_REASON_LABEL[cut.reason] || cut.reason}
                          </span>
                          <span className="text-[13px] font-mono text-[#f1f1f1]">
                            {formatTimeSec(cut.start)} ~ {formatTimeSec(cut.end)}
                          </span>
                          {cut.confidence < 0.7 && (
                            <span className="text-[11px] text-[#aaaaaa]">
                              (확인 권장)
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onPreviewCutInRaw(cut.start)}
                            className="px-2.5 py-1 rounded-[4px] bg-[#282828] hover:bg-[#323232] border border-[#3e3e3e] text-[12px] text-[#f1f1f1] cursor-pointer"
                          >
                            해당 부분 들어보기
                          </button>
                          <button
                            type="button"
                            onClick={() => onToggleCut(idx)}
                            className={`px-3 py-1 rounded-[4px] text-[12px] font-medium cursor-pointer border transition-colors ${
                              isCutApplied
                                ? "bg-[#282828] hover:bg-[#323232] border-[#3e3e3e] text-[#3ea6ff]"
                                : "bg-[#3ea6ff] text-[#0f0f0f] border-[#3ea6ff]"
                            }`}
                          >
                            {isCutApplied ? "되살리기" : "잘라내기"}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[12px] text-[#aaaaaa]">
                        <span>{cut.note || "불필요한 구간"}</span>
                        <span>
                          {isCutApplied ? "현재: 잘라냄" : "현재: 복원됨"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* ==================== TAB 3: AI 장면 ==================== */}
        {activeTab === "ai-scenes" && (
          <div className="space-y-4">
            <div className="text-[12px] text-[#aaaaaa]">
              보충 설명이 필요한 부분에 AI가 만든 설명 장면과 내레이션입니다.
            </div>

            {aiScenes.map((scene, idx) => {
              const isSelected = scene.id === selectedSceneId;
              const isRevisingThis = revisingSceneId === scene.id;
              const isTtsLoading = ttsLoadingSceneId === scene.id;
              const hasAudio = Boolean(scene.audioUrl || scene.audioBase64);

              return (
                <div
                  key={scene.id}
                  onClick={() => onSelectScene(scene.id)}
                  className={`p-4 rounded-[4px] border space-y-3 transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-[#1f1f1f] border-[#3ea6ff] border-l-[3px]"
                      : "bg-[#181818] border-[#3e3e3e]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-[#f1f1f1]">
                      장면 #{idx + 1} ·{" "}
                      {scene.kind === "ending" ? "마무리 카드" : "설명 모션 장면"}
                    </span>
                    <span className="text-[12px] font-mono text-[#aaaaaa]">
                      {scene.durationSec.toFixed(1)}초
                    </span>
                  </div>

                  {/* Title / Caption */}
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="space-y-1"
                  >
                    <label className="text-[12px] text-[#aaaaaa] block">
                      장면 제목
                    </label>
                    <input
                      type="text"
                      value={scene.caption}
                      onChange={(e) =>
                        onUpdateSceneText(scene.id, { caption: e.target.value })
                      }
                      className="w-full bg-[#282828] border border-[#3e3e3e] focus:border-[#3ea6ff] rounded-[4px] px-2.5 py-1.5 text-[14px] text-[#f1f1f1] focus:outline-none"
                    />
                  </div>

                  {/* Script / Narration */}
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="space-y-1.5"
                  >
                    <label className="text-[12px] text-[#aaaaaa] block">
                      내레이션 대본
                    </label>
                    <textarea
                      rows={2}
                      value={scene.script}
                      onChange={(e) =>
                        onUpdateSceneText(scene.id, { script: e.target.value })
                      }
                      className="w-full bg-[#282828] border border-[#3e3e3e] focus:border-[#3ea6ff] rounded-[4px] px-2.5 py-1.5 text-[14px] text-[#f1f1f1] focus:outline-none resize-none"
                    />

                    {/* TTS Audio Controls */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        disabled={isTtsLoading}
                        onClick={() => handlePlaySceneAudio(scene)}
                        className="px-3 py-1.5 rounded-[4px] bg-[#282828] hover:bg-[#323232] border border-[#3e3e3e] text-[12px] font-medium text-[#f1f1f1] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[16px] text-[#3ea6ff]">
                          {playingSceneId === scene.id ? "volume_up" : "play_arrow"}
                        </span>
                        <span>
                          {isTtsLoading
                            ? "음성 생성 중..."
                            : playingSceneId === scene.id
                              ? "재생 중..."
                              : "▶ 음성 듣기"}
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={isTtsLoading}
                        onClick={() => onSynthesizeSceneTts(scene, true)}
                        className="px-3 py-1.5 rounded-[4px] bg-[#282828] hover:bg-[#323232] border border-[#3e3e3e] text-[12px] text-[#aaaaaa] hover:text-[#f1f1f1] cursor-pointer disabled:opacity-50"
                      >
                        음성 다시 생성
                      </button>

                      {hasAudio && (
                        <span className="text-[11px] text-[#2ba640]">
                          ✓ 내 목소리 적용됨
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quick Revise Buttons + Custom Revise Input */}
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="pt-2 border-t border-[#3e3e3e] space-y-2"
                  >
                    <div className="text-[12px] text-[#aaaaaa]">
                      장면 다듬기
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={isRevisingThis}
                        onClick={() =>
                          onReviseScene(
                            scene,
                            "전문 용어를 줄이고 더 쉬운 표현과 직관적인 도형으로 바꿔줘"
                          )
                        }
                        className="px-2.5 py-1 rounded-[4px] bg-[#282828] hover:bg-[#323232] border border-[#3e3e3e] text-[12px] text-[#f1f1f1] cursor-pointer disabled:opacity-50"
                      >
                        더 쉽게
                      </button>
                      <button
                        type="button"
                        disabled={isRevisingThis}
                        onClick={() =>
                          onReviseScene(
                            scene,
                            "문장을 더 짧고 간결하게 줄이고 핵심 단어만 크게 강조해줘"
                          )
                        }
                        className="px-2.5 py-1 rounded-[4px] bg-[#282828] hover:bg-[#323232] border border-[#3e3e3e] text-[12px] text-[#f1f1f1] cursor-pointer disabled:opacity-50"
                      >
                        더 짧게
                      </button>
                      <button
                        type="button"
                        disabled={isRevisingThis}
                        onClick={() =>
                          onReviseScene(
                            scene,
                            "화면 구성과 모션 그래픽 배치를 새로운 형태로 다시 만들어줘"
                          )
                        }
                        className="px-2.5 py-1 rounded-[4px] bg-[#282828] hover:bg-[#323232] border border-[#3e3e3e] text-[12px] text-[#f1f1f1] cursor-pointer disabled:opacity-50"
                      >
                        다시 만들기
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={reviseInputs[scene.id] ?? ""}
                        onChange={(e) =>
                          setReviseInputs((prev) => ({
                            ...prev,
                            [scene.id]: e.target.value,
                          }))
                        }
                        placeholder="원하는 수정 내용을 직접 입력하세요"
                        className="flex-1 bg-[#282828] border border-[#3e3e3e] focus:border-[#3ea6ff] rounded-[4px] px-2.5 py-1.5 text-[13px] text-[#f1f1f1] placeholder-[#717171] focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={isRevisingThis}
                        onClick={() => {
                          const text =
                            (reviseInputs[scene.id] || "").trim() ||
                            "글자를 더 크게 하고 핵심 키워드를 강조해줘";
                          onReviseScene(scene, text);
                        }}
                        className="px-3 py-1.5 rounded-[4px] bg-[#3ea6ff] hover:bg-[#65b8ff] text-[#0f0f0f] text-[13px] font-medium shrink-0 cursor-pointer disabled:opacity-50"
                      >
                        {isRevisingThis ? "수정 중..." : "적용"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ==================== TAB 4: AI 작업 기록 ==================== */}
        {activeTab === "logs" && (
          <div className="space-y-4">
            {/* Verification Summary */}
            <div className="p-3.5 rounded-[4px] bg-[#181818] border border-[#3e3e3e] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-[#f1f1f1]">
                  화면 품질 확인 결과
                </span>
                <button
                  type="button"
                  disabled={verifying}
                  onClick={onRunVerify}
                  className="px-2.5 py-1 rounded-[4px] bg-[#282828] hover:bg-[#323232] border border-[#3e3e3e] text-[12px] text-[#f1f1f1] cursor-pointer disabled:opacity-50"
                >
                  {verifying ? "확인 중..." : "화면 다시 확인"}
                </button>
              </div>
              <div className="text-[12px] text-[#aaaaaa] space-y-1">
                <div>
                  상태:{" "}
                  <strong className="text-[#f1f1f1]">
                    {verifyReport.passed ? "통과" : "재확인 필요"}
                  </strong>
                </div>
                <div>
                  검증 방식:{" "}
                  <span className="text-[#f1f1f1]">
                    {verifyReport.verificationMode === "structural-check"
                      ? "구조 검증 (structural-check)"
                      : "멀티모달 화면 검증 (multimodal-argon)"}
                  </span>
                </div>
                {verifyReport.usedModel && (
                  <div>
                    검증 모델:{" "}
                    <span className="font-mono text-[#f1f1f1]">
                      {verifyReport.usedModel}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Per-Scene Code & Fallback Status */}
            <div className="space-y-2">
              <div className="text-[12px] font-medium text-[#aaaaaa]">
                장면별 코드 생성 기록
              </div>
              {aiScenes.map((scene) => {
                const codeObj = sceneCodes[scene.id];
                const check = verifyReport.checks.find(
                  (c) => c.sceneId === scene.id
                );
                const source = codeObj?.source || check?.source || "argon-code";
                const attempts = codeObj?.attempts || check?.attempts || 1;
                const isCodeOpen = openCodeSceneId === scene.id;

                return (
                  <div
                    key={scene.id}
                    className="p-3 rounded-[4px] bg-[#181818] border border-[#3e3e3e] space-y-2 text-[12px]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-[#f1f1f1]">
                        {scene.caption}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setOpenCodeSceneId(isCodeOpen ? null : scene.id)
                        }
                        className="px-2 py-0.5 rounded-[4px] bg-[#282828] hover:bg-[#323232] border border-[#3e3e3e] text-[11px] text-[#3ea6ff] cursor-pointer"
                      >
                        {isCodeOpen ? "모션 코드 닫기" : "모션 코드 보기"}
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[#aaaaaa]">
                      <span>
                        생성 방식:{" "}
                        <strong className="text-[#f1f1f1]">
                          {source === "argon-code"
                            ? "AI 코드 생성 (argon-code)"
                            : "기본 템플릿 대체 (template-fallback)"}
                        </strong>
                      </span>
                      <span>시도 횟수: {attempts}회</span>
                      {codeObj?.usedModel && (
                        <span>모델: {codeObj.usedModel}</span>
                      )}
                    </div>

                    {isCodeOpen && (
                      <pre className="p-2.5 rounded-[4px] bg-[#111111] border border-[#3e3e3e] text-[11px] font-mono text-[#cccccc] overflow-x-auto max-h-48">
                        <code>{codeObj?.code || "// 코드 없음"}</code>
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Uncertain Facts if any */}
            {plan.uncertainFacts && plan.uncertainFacts.length > 0 && (
              <div className="p-3 rounded-[4px] bg-[#181818] border border-[#3e3e3e] space-y-1">
                <div className="text-[12px] font-medium text-[#f1f1f1]">
                  참고 사항 (확인 필요 내용)
                </div>
                {plan.uncertainFacts.map((fact, idx) => (
                  <p key={idx} className="text-[12px] text-[#aaaaaa]">
                    • {fact}
                  </p>
                ))}
              </div>
            )}

            {/* Full API / Model Call Log */}
            <div className="space-y-2">
              <div className="text-[12px] font-medium text-[#aaaaaa]">
                API 호출 기록 ({modelLogs.length}건)
              </div>
              {modelLogs.length === 0 ? (
                <div className="text-[12px] text-[#717171]">
                  아직 기록된 호출이 없습니다.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {modelLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-2.5 rounded-[4px] bg-[#181818] border border-[#3e3e3e] text-[11px] space-y-1"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1 font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#717171]">{log.timestamp}</span>
                          <span className="text-[#3ea6ff]">{log.endpoint}</span>
                          <span className="text-[#aaaaaa]">
                            ({log.usedModel || log.model})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[#aaaaaa]">
                            시도 {log.attempt}회 · {log.durationMs}ms
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded-[2px] ${
                              log.status === "ok"
                                ? "text-[#2ba640]"
                                : log.status === "error"
                                  ? "text-[#ff4e45]"
                                  : "text-[#aaaaaa]"
                            }`}
                          >
                            {log.status}
                          </span>
                        </div>
                      </div>
                      {log.detail && (
                        <div className="text-[#aaaaaa]">{log.detail}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
