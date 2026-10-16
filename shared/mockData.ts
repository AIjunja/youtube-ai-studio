import type {
  ScenePlan,
  SceneCode,
  VerifyReport,
  ModelCallLogEntry,
} from "./contract.js";

export const MOCK_SCENE_PLAN: ScenePlan = {
  summary:
    "AI 에이전트 자동화 파이프라인을 소개하는 16초 촬영본입니다. 초반 박수·'다시' NG 구간과 중간 1.8초 침묵을 컷하고, 빠진 '단순 프롬프트 vs 검증 루프 에이전트 차이'와 '3단계 작동 원리'를 모션그래픽 장면으로 보완합니다.",
  language: "ko",
  transcript: [
    { start: 0.0, end: 1.9, text: "(박수) 아 잠깐만요, 다시 갈게요." },
    {
      start: 2.0,
      end: 6.4,
      text: "많은 분들이 AI 자동화를 시도하다가 첫 단계에서 바로 막힙니다.",
    },
    { start: 6.4, end: 8.2, text: "(무음... 어...)" },
    {
      start: 8.2,
      end: 13.0,
      text: "그냥 프롬프트 한 줄 넣는다고 끝나는 게 아니라 검증 루프가 핵심이거든요.",
    },
    {
      start: 13.0,
      end: 15.8,
      text: "어떻게 세팅하는지 지금 바로 보여드릴게요.",
    },
  ],
  keep: [
    { start: 2.0, end: 6.4 },
    { start: 8.2, end: 15.8 },
  ],
  cuts: [
    {
      start: 0.0,
      end: 2.0,
      reason: "ng",
      confidence: 0.96,
      note: "박수 소리 및 '다시 갈게요' NG 테이크",
    },
    {
      start: 6.4,
      end: 8.2,
      reason: "silence",
      confidence: 0.91,
      note: "1.8초 호흡 대기 및 망설임 구간",
    },
    {
      start: 12.1,
      end: 13.0,
      reason: "repeat",
      confidence: 0.62,
      note: "말꼬리 흐림 의심 (신뢰도 < 0.7 이므로 제안만 표시)",
    },
  ],
  gaps: [
    {
      atSec: 6.4,
      missing:
        "'왜 첫 단계에서 막히는지'에 대한 구체적 비교(단순 1회 호출 vs 자가 수정 루프) 설명이 빠져 있습니다.",
    },
    {
      atSec: 13.0,
      missing:
        "'검증 루프가 어떻게 돌아가는지' 3단계 구조(계획 → 코드 실행 → 시각 검증) 도식이 필요합니다.",
    },
  ],
  scenes: [
    {
      id: "scene-1-intro",
      kind: "original",
      durationSec: 4.4,
      script: "많은 분들이 AI 자동화를 시도하다가 첫 단계에서 바로 막힙니다.",
      caption: "AI 자동화, 왜 첫 단계에서 막힐까?",
      visualIdea: "원본 카메라 컷 (NG 제거 후 첫 핵심 발화)",
      sourceRange: { start: 2.0, end: 6.4 },
      template: "title",
      visuals: ["원본 발화 유지", "하단 먹색+라임 포인트 자막"],
    },
    {
      id: "scene-2-motion-compare",
      kind: "motion",
      durationSec: 4.0,
      script:
        "단순 1회 프롬프트는 오류에서 멈추지만, 에이전트 루프는 스스로 고쳐 완성합니다.",
      caption: "단발성 프롬프트 vs 자가 검증 루프",
      visualIdea:
        "흰 여백 배경(#F8F9FA), 좌측 회색 카드(1회 호출 → 실패) vs 우측 먹색 카드+라임(#C6FF00) 하이라이트(계획 → 수정 → 통과) 키네틱 비교",
      template: "compare",
      visuals: ["1회 호출: 에러 시 중단", "검증 루프: 최대 2회 자동 수정 + 통과"],
    },
    {
      id: "scene-3-body",
      kind: "original",
      durationSec: 4.8,
      script:
        "그냥 프롬프트 한 줄 넣는다고 끝나는 게 아니라 검증 루프가 핵심이거든요.",
      caption: "핵심은 프롬프트가 아니라 '검증 루프'",
      visualIdea: "원본 카메라 컷 (1.8초 침묵 제거 후 자연스럽게 연결)",
      sourceRange: { start: 8.2, end: 13.0 },
      template: "kinetic",
      visuals: ["원본 발화 유지", "핵심 키워드 라임 강조"],
    },
    {
      id: "scene-4-motion-diagram",
      kind: "motion",
      durationSec: 4.5,
      script:
        "계획 수립부터 샌드박스 코드 렌더, 프레임 시각 검증까지 3단계로 자동 완성됩니다.",
      caption: "Argon 3단계 자가 검증 파이프라인",
      visualIdea:
        "1. 멀티모달 계획 → 2. Canvas 2D 코드 생성·수정 → 3. 키프레임 시각 검증 3개 노드가 순서대로 연결되는 다이어그램",
      template: "diagram",
      visuals: ["① 멀티모달 계획", "② 코드 생성·샌드박스", "③ 키프레임 시각 검증"],
    },
    {
      id: "scene-5-outro-original",
      kind: "original",
      durationSec: 2.8,
      script: "어떻게 세팅하는지 지금 바로 보여드릴게요.",
      caption: "지금 바로 세팅 시작하기",
      visualIdea: "원본 마무리 발화 구간",
      sourceRange: { start: 13.0, end: 15.8 },
      template: "title",
      visuals: ["원본 발화 유지"],
    },
    {
      id: "scene-6-ending",
      kind: "ending",
      durationSec: 3.0,
      script: "촬영만 하세요. 나머지는 AI Studio가 완성합니다.",
      caption: "Just Record. AI Does the Rest.",
      visualIdea:
        "먹색 풀블리드 배경 위 라임(#C6FF00) 배지와 채널 시그니처 엔딩 카드",
      template: "ending",
      visuals: ["AI Studio for Creators", "구독 · 다음 영상 보기"],
    },
  ],
  uncertainFacts: [
    "발화자의 '검증 루프'가 특정 프레임워크(LangGraph 등)를 지칭하는지 여부는 원본에서 언급되지 않아 일반 원리로 표현했습니다.",
  ],
};

export const MOCK_SCENE_CODES: Record<string, SceneCode> = {
  "scene-2-motion-compare": {
    sceneId: "scene-2-motion-compare",
    attempts: 1,
    source: "argon-code",
    code: `
// White margin background (#F8F9FA), ink text (#111111), lime accent (#C6FF00)
const dur = (scene && scene.durationSec) ? scene.durationSec : 4;
const p = Math.min(1, Math.max(0, t / dur));
const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

ctx.fillStyle = "#F8F9FA";
ctx.fillRect(0, 0, w, h);

// Subtle grid
ctx.strokeStyle = "rgba(17,17,17,0.05)";
ctx.lineWidth = 2;
for (let x = 80; x < w; x += 80) {
  ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
}

// Top tag + kinetic title
const eTitle = ease(p * 3.2);
ctx.save();
ctx.translate(0, (1 - eTitle) * 30);
ctx.fillStyle = "#111111";
ctx.fillRect(w * 0.08, h * 0.1, 240, 48);
ctx.fillStyle = "#C6FF00";
ctx.font = "800 24px sans-serif";
ctx.textBaseline = "middle";
ctx.fillText("MISSING EXPLANATION", w * 0.08 + 20, h * 0.1 + 24);

ctx.fillStyle = "#111111";
ctx.font = "900 64px sans-serif";
ctx.fillText("단발성 프롬프트 vs 자가 검증 루프", w * 0.08, h * 0.24);
ctx.restore();

// Left card: One-shot prompt
const eLeft = ease((p - 0.12) * 3.0);
if (eLeft > 0) {
  ctx.save();
  ctx.globalAlpha = eLeft;
  const lx = w * 0.08, ly = h * 0.34, cw = w * 0.39, ch = h * 0.48;
  ctx.fillStyle = "#FFFFFF";
  ctx.strokeStyle = "#D0D5DD";
  ctx.lineWidth = 4;
  ctx.fillRect(lx, ly, cw, ch);
  ctx.strokeRect(lx, ly, cw, ch);

  ctx.fillStyle = "#667085";
  ctx.font = "700 36px sans-serif";
  ctx.fillText("기존: 1회 프롬프트", lx + 44, ly + 72);

  ctx.fillStyle = "#111111";
  ctx.font = "700 48px sans-serif";
  ctx.fillText("프롬프트 → 오류 시 중단", lx + 44, ly + 170);

  ctx.fillStyle = "#FEE4E2";
  ctx.fillRect(lx + 44, ly + 240, 320, 68);
  ctx.fillStyle = "#D92D20";
  ctx.font = "800 32px sans-serif";
  ctx.fillText("✕ 편집 지식 직접 요구", lx + 68, ly + 284);
  ctx.restore();
}

// Right card: Argon verification loop
const eRight = ease((p - 0.28) * 3.0);
if (eRight > 0) {
  ctx.save();
  ctx.globalAlpha = eRight;
  const rx = w * 0.53, ry = h * 0.34, cw = w * 0.39, ch = h * 0.48;
  ctx.fillStyle = "#111111";
  ctx.fillRect(rx, ry, cw, ch);

  ctx.fillStyle = "#C6FF00";
  ctx.fillRect(rx, ry, cw, 14);
  ctx.font = "800 36px sans-serif";
  ctx.fillText("AI STUDIO: 검증 루프", rx + 44, ry + 78);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "800 48px sans-serif";
  ctx.fillText("계획 → 코드 → 자동 수정", rx + 44, ry + 170);

  ctx.fillStyle = "#C6FF00";
  ctx.fillRect(rx + 44, ry + 240, 380, 68);
  ctx.fillStyle = "#111111";
  ctx.font = "900 32px sans-serif";
  ctx.fillText("✓ 찍지 않은 설명 자동 생성", rx + 68, ry + 284);
  ctx.restore();
}
`.trim(),
  },
  "scene-4-motion-diagram": {
    sceneId: "scene-4-motion-diagram",
    attempts: 2,
    source: "argon-code",
    code: `
const dur = (scene && scene.durationSec) ? scene.durationSec : 4.5;
const p = Math.min(1, Math.max(0, t / dur));
const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

ctx.fillStyle = "#F8F9FA";
ctx.fillRect(0, 0, w, h);

ctx.fillStyle = "#111111";
ctx.font = "900 60px sans-serif";
ctx.fillText("Argon 3단계 자가 검증 파이프라인", w * 0.08, h * 0.20);

ctx.fillStyle = "#C6FF00";
ctx.fillRect(w * 0.08, h * 0.23, 520, 14);

const steps = [
  { num: "01", title: "멀티모달 계획", desc: "NG 컷 + 빠진 설명 탐지" },
  { num: "02", title: "모션 코드 작성", desc: "Worker 격리 샌드박스" },
  { num: "03", title: "시각 프레임 검증", desc: "키프레임 대조 & 통과" }
];

const boxW = w * 0.25;
const boxH = h * 0.42;
const startX = w * 0.08;
const gap = w * 0.045;
const y = h * 0.36;

for (let i = 0; i < steps.length; i++) {
  const ep = ease((p - i * 0.18) * 2.8);
  if (ep <= 0) continue;
  const x = startX + i * (boxW + gap);
  const active = i === 2 || (p > i * 0.28 && p < (i + 1) * 0.34);

  ctx.save();
  ctx.globalAlpha = ep;
  ctx.translate(0, (1 - ep) * 40);

  ctx.fillStyle = active ? "#111111" : "#FFFFFF";
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 4;
  ctx.fillRect(x, y, boxW, boxH);
  ctx.strokeRect(x, y, boxW, boxH);

  ctx.fillStyle = "#C6FF00";
  ctx.fillRect(x + 28, y + 28, 92, 54);
  ctx.fillStyle = "#111111";
  ctx.font = "900 32px sans-serif";
  ctx.fillText(steps[i].num, x + 50, y + 66);

  ctx.fillStyle = active ? "#FFFFFF" : "#111111";
  ctx.font = "800 48px sans-serif";
  ctx.fillText(steps[i].title, x + 28, y + 170);

  ctx.fillStyle = active ? "#C6FF00" : "#475467";
  ctx.font = "700 34px sans-serif";
  ctx.fillText(steps[i].desc, x + 28, y + 245);
  ctx.restore();
}
`.trim(),
  },
};

export const MOCK_VERIFY_REPORT: VerifyReport = {
  passed: true,
  retried: false,
  checks: [
    {
      sceneId: "scene-2-motion-compare",
      ok: true,
      source: "argon-code",
      attempts: 1,
    },
    {
      sceneId: "scene-4-motion-diagram",
      ok: true,
      source: "argon-code",
      attempts: 2,
    },
    {
      sceneId: "scene-6-ending",
      ok: true,
      source: "argon-code",
      attempts: 1,
    },
  ],
};

export const MOCK_MODEL_LOGS: ModelCallLogEntry[] = [
  {
    id: "log-1",
    timestamp: "12:00:05",
    endpoint: "/api/plan",
    model: "gemini-4-argon",
    attempt: 1,
    durationMs: 3420,
    status: "ok",
    detail: "멀티모달 영상 분석 완료: keep 2구간, cut 3구간, 빠진 설명(gap) 2곳 도출",
  },
  {
    id: "log-2",
    timestamp: "12:00:08",
    endpoint: "/api/scene-code",
    model: "gemini-4-argon",
    sceneId: "scene-2-motion-compare",
    attempt: 1,
    durationMs: 2150,
    status: "ok",
    detail: "draw(ctx,t,w,h,scene) 생성 및 Worker 샌드박스 프레임 검증 통과",
  },
  {
    id: "log-3",
    timestamp: "12:00:11",
    endpoint: "/api/scene-code",
    model: "gemini-4-argon",
    sceneId: "scene-4-motion-diagram",
    attempt: 1,
    durationMs: 1980,
    status: "retry",
    detail: "1차 코드 Canvas 텍스트 겹침 감지 → /api/fix-code 자동 호출",
  },
  {
    id: "log-4",
    timestamp: "12:00:13",
    endpoint: "/api/fix-code",
    model: "gemini-4-argon",
    sceneId: "scene-4-motion-diagram",
    attempt: 2,
    durationMs: 1840,
    status: "ok",
    detail: "2차 수정 코드 샌드박스 렌더 및 비어있지 않은 프레임 확인 완료",
  },
  {
    id: "log-5",
    timestamp: "12:00:16",
    endpoint: "/api/verify",
    model: "gemini-4-argon",
    attempt: 1,
    durationMs: 2290,
    status: "ok",
    detail: "추출된 키프레임 3장 멀티모달 시각 검증 통과 (가독성·대본 일치 OK)",
  },
];
