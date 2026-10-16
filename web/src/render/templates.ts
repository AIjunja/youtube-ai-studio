import type {
  PlannedScene,
  SceneCode,
  SceneTemplate,
} from "../../../shared/contract";

/**
 * Infers the most appropriate fallback template for a scene if `scene.template` is not set.
 */
export function inferSceneTemplate(scene: PlannedScene): SceneTemplate {
  if (scene.template) {
    return scene.template;
  }
  if (scene.kind === "ending") {
    return "ending";
  }
  const text = `${scene.caption} ${scene.script} ${scene.visualIdea}`.toLowerCase();
  if (text.includes("vs") || text.includes("비교") || text.includes("차이")) {
    return "compare";
  }
  if (
    text.includes("단계") ||
    text.includes("파이프라인") ||
    text.includes("구조") ||
    text.includes("흐름") ||
    text.includes("diagram")
  ) {
    return "diagram";
  }
  if (
    (scene.visuals && scene.visuals.length >= 3) ||
    text.includes("목록") ||
    text.includes("체크") ||
    text.includes("포인트")
  ) {
    return "bullets";
  }
  if (scene.kind === "motion") {
    return "kinetic";
  }
  return "title";
}

/**
 * Generates deterministic Canvas 2D `draw(ctx, t, w, h, scene)` function body code
 * for the 6 required fallback templates:
 * `title`, `bullets`, `diagram`, `compare`, `kinetic`, `ending`.
 *
 * Design system (docs/agy-context.md Section 4):
 * - White margin background (#F8F9FA)
 * - Ink black text (#111111)
 * - Single lime point accent (#C6FF00)
 * - >= 48px bold typography on 1080p scale
 * - Word/card-unit kinetic entrance animations driven deterministically by `t`
 */
export function getTemplateCode(
  templateInput: SceneTemplate | undefined,
  scene?: PlannedScene
): string {
  const template: SceneTemplate =
    templateInput ?? (scene ? inferSceneTemplate(scene) : "kinetic");

  switch (template) {
    case "title":
      return `
const dur = (scene && scene.durationSec) ? Math.max(1, scene.durationSec) : 4;
const p = Math.min(1, Math.max(0, t / dur));
const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const s = w / 1920;

ctx.fillStyle = "#F8F9FA";
ctx.fillRect(0, 0, w, h);

// Subtle architectural grid
ctx.strokeStyle = "rgba(17, 17, 17, 0.05)";
ctx.lineWidth = Math.max(1, 2 * s);
const gridStep = Math.max(40, Math.round(96 * s));
for (let x = gridStep; x < w; x += gridStep) {
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, h);
  ctx.stroke();
}
for (let y = gridStep; y < h; y += gridStep) {
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(w, y);
  ctx.stroke();
}

// Top badge
const badgeEase = ease(p * 3.5);
ctx.save();
ctx.translate(0, (1 - badgeEase) * 32 * s);
ctx.fillStyle = "#111111";
ctx.fillRect(w * 0.08, h * 0.14, 340 * s, 58 * s);
ctx.fillStyle = "#C6FF00";
ctx.font = "900 " + Math.round(28 * s) + "px 'Pretendard', 'Noto Sans KR', sans-serif";
ctx.textBaseline = "middle";
ctx.fillText("KEY POINT · AI STUDIO", w * 0.08 + 24 * s, h * 0.14 + 29 * s);
ctx.restore();

// Word-by-word kinetic caption
const rawTitle = (scene && scene.caption) ? String(scene.caption) : "핵심 설명 포인트";
const words = rawTitle.split(/\\s+/).filter(Boolean);
ctx.font = "900 " + Math.round(80 * s) + "px 'Pretendard', 'Noto Sans KR', sans-serif";
ctx.textBaseline = "top";

let curX = w * 0.08;
let curY = h * 0.28;
const maxW = w * 0.84;
const lineH = 104 * s;

for (let i = 0; i < words.length; i++) {
  const word = words[i];
  const ww = ctx.measureText(word + " ").width;
  if (curX + ww > w * 0.08 + maxW && curX > w * 0.08) {
    curX = w * 0.08;
    curY += lineH;
  }
  const wp = ease((p - i * 0.06) * 3.8);
  ctx.save();
  ctx.globalAlpha = wp;
  ctx.translate(0, (1 - wp) * 36 * s);
  if (i === words.length - 1 || i === 0) {
    ctx.fillStyle = "#C6FF00";
    ctx.fillRect(curX - 6 * s, curY + 54 * s, ww - 12 * s, 32 * s);
  }
  ctx.fillStyle = "#111111";
  ctx.fillText(word, curX, curY);
  ctx.restore();
  curX += ww;
}

// Bottom script card
const cardEase = ease((p - 0.18) * 3.0);
if (cardEase > 0) {
  const cx = w * 0.08;
  const cy = h * 0.62;
  const cw = w * 0.84;
  const ch = h * 0.24;
  ctx.save();
  ctx.globalAlpha = cardEase;
  ctx.translate(0, (1 - cardEase) * 28 * s);
  ctx.fillStyle = "#111111";
  ctx.fillRect(cx, cy, cw, ch);
  ctx.fillStyle = "#C6FF00";
  ctx.fillRect(cx, cy, 16 * s, ch);

  const scriptText = (scene && scene.script) ? String(scene.script) : rawTitle;
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 " + Math.round(48 * s) + "px 'Pretendard', 'Noto Sans KR', sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(scriptText.slice(0, 42), cx + 48 * s, cy + ch * 0.38);
  if (scriptText.length > 42) {
    ctx.fillStyle = "#C6FF00";
    ctx.font = "700 " + Math.round(44 * s) + "px 'Pretendard', 'Noto Sans KR', sans-serif";
    ctx.fillText(scriptText.slice(42, 84), cx + 48 * s, cy + ch * 0.72);
  }
  ctx.restore();
}
`.trim();

    case "bullets":
      return `
const dur = (scene && scene.durationSec) ? Math.max(1, scene.durationSec) : 4;
const p = Math.min(1, Math.max(0, t / dur));
const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const s = w / 1920;

ctx.fillStyle = "#F8F9FA";
ctx.fillRect(0, 0, w, h);

// Header bar
ctx.fillStyle = "#111111";
ctx.font = "900 " + Math.round(64 * s) + "px 'Pretendard', 'Noto Sans KR', sans-serif";
ctx.textBaseline = "top";
const title = (scene && scene.caption) ? String(scene.caption) : "핵심 체크리스트";
ctx.fillText(title, w * 0.08, h * 0.11);

ctx.fillStyle = "#C6FF00";
ctx.fillRect(w * 0.08, h * 0.20, 460 * s, 14 * s);

const rawItems = (scene && Array.isArray(scene.visuals) && scene.visuals.length > 0)
  ? scene.visuals
  : [
      (scene && scene.script) ? String(scene.script).slice(0, 36) : "첫 번째 핵심 요약 포인트",
      "불필요한 NG·침묵 구간 자동 제거",
      "빠진 맥락을 채우는 모션그래픽 보완"
    ];
const items = rawItems.slice(0, 3);

for (let i = 0; i < items.length; i++) {
  const ep = ease((p - 0.1 - i * 0.16) * 3.2);
  if (ep <= 0) continue;
  const bx = w * 0.08;
  const by = h * 0.27 + i * (h * 0.21);
  const bw = w * 0.84;
  const bh = h * 0.17;
  const isHighlight = i === items.length - 1;

  ctx.save();
  ctx.globalAlpha = ep;
  ctx.translate((1 - ep) * 48 * s, 0);

  ctx.fillStyle = isHighlight ? "#111111" : "#FFFFFF";
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = Math.max(2, 4 * s);
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeRect(bx, by, bw, bh);

  // Number badge
  ctx.fillStyle = "#C6FF00";
  ctx.fillRect(bx + 28 * s, by + (bh - 76 * s) * 0.5, 92 * s, 76 * s);
  ctx.fillStyle = "#111111";
  ctx.font = "900 " + Math.round(44 * s) + "px 'Pretendard', 'Noto Sans KR', sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText("0" + (i + 1), bx + 48 * s, by + bh * 0.5);

  // Bullet text (>= 48px)
  ctx.fillStyle = isHighlight ? "#FFFFFF" : "#111111";
  ctx.font = "800 " + Math.round(50 * s) + "px 'Pretendard', 'Noto Sans KR', sans-serif";
  ctx.fillText(String(items[i]).slice(0, 40), bx + 152 * s, by + bh * 0.5);
  ctx.restore();
}
`.trim();

    case "diagram":
      return `
const dur = (scene && scene.durationSec) ? Math.max(1, scene.durationSec) : 4.5;
const p = Math.min(1, Math.max(0, t / dur));
const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const s = w / 1920;

ctx.fillStyle = "#F8F9FA";
ctx.fillRect(0, 0, w, h);

const heading = (scene && scene.caption) ? String(scene.caption) : "3단계 작동 다이어그램";
ctx.fillStyle = "#111111";
ctx.font = "900 " + Math.round(62 * s) + "px 'Pretendard', 'Noto Sans KR', sans-serif";
ctx.textBaseline = "top";
ctx.fillText(heading, w * 0.08, h * 0.11);

ctx.fillStyle = "#C6FF00";
ctx.fillRect(w * 0.08, h * 0.20, 520 * s, 14 * s);

const visuals = (scene && Array.isArray(scene.visuals) && scene.visuals.length >= 3)
  ? scene.visuals.slice(0, 3)
  : ["① 멀티모달 분석", "② 모션 코드 생성", "③ 시각 검증 완료"];

const boxW = w * 0.25;
const boxH = h * 0.44;
const startX = w * 0.08;
const gap = w * 0.045;
const boxY = h * 0.32;

for (let i = 0; i < 3; i++) {
  const ep = ease((p - i * 0.16) * 3.0);
  if (ep <= 0) continue;
  const x = startX + i * (boxW + gap);
  const active = i === 2 || (p > i * 0.25 && p < (i + 1) * 0.35);

  // Connector arrow
  if (i > 0) {
    const ax = x - gap + 8 * s;
    const ay = boxY + boxH * 0.5;
    ctx.save();
    ctx.globalAlpha = ep;
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = Math.max(2, 6 * s);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(x - 8 * s, ay);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.globalAlpha = ep;
  ctx.translate(0, (1 - ep) * 40 * s);

  ctx.fillStyle = active ? "#111111" : "#FFFFFF";
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = Math.max(2, 4 * s);
  ctx.fillRect(x, boxY, boxW, boxH);
  ctx.strokeRect(x, boxY, boxW, boxH);

  ctx.fillStyle = "#C6FF00";
  ctx.fillRect(x + 28 * s, boxY + 28 * s, 104 * s, 60 * s);
  ctx.fillStyle = "#111111";
  ctx.font = "900 " + Math.round(36 * s) + "px 'Pretendard', 'Noto Sans KR', sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText("STEP " + (i + 1), x + 40 * s, boxY + 58 * s);

  ctx.fillStyle = active ? "#FFFFFF" : "#111111";
  ctx.font = "800 " + Math.round(48 * s) + "px 'Pretendard', 'Noto Sans KR', sans-serif";
  const label = String(visuals[i] || ("단계 " + (i + 1))).replace(/^[①②③0-9.\\s]+/, "");
  ctx.fillText(label.slice(0, 12), x + 28 * s, boxY + 175 * s);

  ctx.fillStyle = active ? "#C6FF00" : "#475467";
  ctx.font = "700 " + Math.round(34 * s) + "px 'Pretendard', 'Noto Sans KR', sans-serif";
  ctx.fillText(active ? "✓ VERIFIED" : "AUTO PIPELINE", x + 28 * s, boxY + 265 * s);
  ctx.restore();
}

// Footer caption
const footText = (scene && scene.script) ? String(scene.script) : "";
if (footText) {
  ctx.fillStyle = "#111111";
  ctx.font = "700 " + Math.round(44 * s) + "px 'Pretendard', 'Noto Sans KR', sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(footText.slice(0, 52), w * 0.08, h * 0.86);
}
`.trim();

    case "compare":
      return `
const dur = (scene && scene.durationSec) ? Math.max(1, scene.durationSec) : 4;
const p = Math.min(1, Math.max(0, t / dur));
const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const s = w / 1920;

ctx.fillStyle = "#F8F9FA";
ctx.fillRect(0, 0, w, h);

const title = (scene && scene.caption) ? String(scene.caption) : "기존 방식 vs AI 검증 루프";
const leftText = (scene && Array.isArray(scene.visuals) && scene.visuals[0])
  ? String(scene.visuals[0])
  : "단발성 시도: 오류 시 중단";
const rightText = (scene && Array.isArray(scene.visuals) && scene.visuals[1])
  ? String(scene.visuals[1])
  : "검증 루프: 자동 수정 및 완성";

const eTitle = ease(p * 3.2);
ctx.save();
ctx.translate(0, (1 - eTitle) * 28 * s);
ctx.fillStyle = "#111111";
ctx.fillRect(w * 0.08, h * 0.10, 260 * s, 48 * s);
ctx.fillStyle = "#C6FF00";
ctx.font = "800 " + Math.round(24 * s) + "px 'Pretendard', 'Noto Sans KR', sans-serif";
ctx.textBaseline = "middle";
ctx.fillText("COMPARE VIEW", w * 0.08 + 22 * s, h * 0.10 + 24 * s);

ctx.fillStyle = "#111111";
ctx.font = "900 " + Math.round(62 * s) + "px 'Pretendard', 'Noto Sans KR', sans-serif";
ctx.fillText(title.slice(0, 34), w * 0.08, h * 0.23);
ctx.restore();

// Left card
const eLeft = ease((p - 0.10) * 3.0);
if (eLeft > 0) {
  const lx = w * 0.08, ly = h * 0.33, cw = w * 0.39, ch = h * 0.50;
  ctx.save();
  ctx.globalAlpha = eLeft;
  ctx.fillStyle = "#FFFFFF";
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = Math.max(2, 4 * s);
  ctx.fillRect(lx, ly, cw, ch);
  ctx.strokeRect(lx, ly, cw, ch);

  ctx.fillStyle = "#667085";
  ctx.font = "800 " + Math.round(36 * s) + "px 'Pretendard', 'Noto Sans KR', sans-serif";
  ctx.fillText("BEFORE", lx + 44 * s, ly + 72 * s);

  ctx.fillStyle = "#111111";
  ctx.font = "800 " + Math.round(48 * s) + "px 'Pretendard', 'Noto Sans KR', sans-serif";
  ctx.fillText(leftText.slice(0, 18), lx + 44 * s, ly + 175 * s);
  if (leftText.length > 18) {
    ctx.fillText(leftText.slice(18, 36), lx + 44 * s, ly + 235 * s);
  }

  ctx.fillStyle = "#FEE4E2";
  ctx.fillRect(lx + 44 * s, ly + ch - 116 * s, 320 * s, 68 * s);
  ctx.fillStyle = "#D92D20";
  ctx.font = "800 " + Math.round(32 * s) + "px 'Pretendard', 'Noto Sans KR', sans-serif";
  ctx.fillText("✕ 수동 편집 필요", lx + 68 * s, ly + ch - 82 * s);
  ctx.restore();
}

// Right card
const eRight = ease((p - 0.24) * 3.0);
if (eRight > 0) {
  const rx = w * 0.53, ry = h * 0.33, cw = w * 0.39, ch = h * 0.50;
  ctx.save();
  ctx.globalAlpha = eRight;
  ctx.fillStyle = "#111111";
  ctx.fillRect(rx, ry, cw, ch);

  ctx.fillStyle = "#C6FF00";
  ctx.fillRect(rx, ry, cw, 16 * s);
  ctx.font = "800 " + Math.round(36 * s) + "px 'Pretendard', 'Noto Sans KR', sans-serif";
  ctx.fillText("AFTER · AI STUDIO", rx + 44 * s, ry + 72 * s);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "800 " + Math.round(48 * s) + "px 'Pretendard', 'Noto Sans KR', sans-serif";
  ctx.fillText(rightText.slice(0, 18), rx + 44 * s, ry + 175 * s);
  if (rightText.length > 18) {
    ctx.fillText(rightText.slice(18, 36), rx + 44 * s, ry + 235 * s);
  }

  ctx.fillStyle = "#C6FF00";
  ctx.fillRect(rx + 44 * s, ry + ch - 116 * s, 380 * s, 68 * s);
  ctx.fillStyle = "#111111";
  ctx.font = "900 " + Math.round(32 * s) + "px 'Pretendard', 'Noto Sans KR', sans-serif";
  ctx.fillText("✓ 자가 검증 루프 완성", rx + 68 * s, ry + ch - 82 * s);
  ctx.restore();
}
`.trim();

    case "kinetic":
      return `
const dur = (scene && scene.durationSec) ? Math.max(1, scene.durationSec) : 4;
const p = Math.min(1, Math.max(0, t / dur));
const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const s = w / 1920;

ctx.fillStyle = "#F8F9FA";
ctx.fillRect(0, 0, w, h);

// Corner accent block
ctx.fillStyle = "#111111";
ctx.fillRect(w * 0.08, h * 0.12, 18 * s, h * 0.76);

const caption = (scene && scene.caption) ? String(scene.caption) : "핵심 개념 키네틱 요약";
const tokens = caption.split(/\\s+/).filter(Boolean);

ctx.textBaseline = "top";
let x = w * 0.12;
let y = h * 0.18;
const maxLineW = w * 0.80;

for (let i = 0; i < tokens.length; i++) {
  const token = tokens[i];
  const ep = ease((p - i * 0.07) * 3.6);
  if (ep <= 0) continue;

  ctx.font = "900 " + Math.round(88 * s) + "px 'Pretendard', 'Noto Sans KR', sans-serif";
  const tw = ctx.measureText(token).width + 36 * s;
  if (x + tw > w * 0.12 + maxLineW && x > w * 0.12) {
    x = w * 0.12;
    y += 124 * s;
  }

  const isLime = i === tokens.length - 1 || i === 1;
  ctx.save();
  ctx.globalAlpha = ep;
  ctx.translate(0, (1 - ep) * 42 * s);

  ctx.fillStyle = isLime ? "#C6FF00" : "#111111";
  ctx.fillRect(x, y, tw, 104 * s);

  ctx.fillStyle = isLime ? "#111111" : "#FFFFFF";
  ctx.fillText(token, x + 18 * s, y + 10 * s);
  ctx.restore();

  x += tw + 18 * s;
}

// Sub-script panel
const subEase = ease((p - 0.25) * 3.0);
if (subEase > 0) {
  const script = (scene && scene.script) ? String(scene.script) : caption;
  ctx.save();
  ctx.globalAlpha = subEase;
  ctx.fillStyle = "#111111";
  ctx.font = "800 " + Math.round(50 * s) + "px 'Pretendard', 'Noto Sans KR', sans-serif";
  ctx.fillText(script.slice(0, 44), w * 0.12, h * 0.72);
  if (script.length > 44) {
    ctx.fillStyle = "#475467";
    ctx.font = "700 " + Math.round(46 * s) + "px 'Pretendard', 'Noto Sans KR', sans-serif";
    ctx.fillText(script.slice(44, 88), w * 0.12, h * 0.81);
  }
  ctx.restore();
}
`.trim();

    case "ending":
      return `
const dur = (scene && scene.durationSec) ? Math.max(1, scene.durationSec) : 3;
const p = Math.min(1, Math.max(0, t / dur));
const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const s = w / 1920;

// Ink full-bleed background with white inner frame + lime accent
ctx.fillStyle = "#111111";
ctx.fillRect(0, 0, w, h);

ctx.strokeStyle = "#F8F9FA";
ctx.lineWidth = Math.max(2, 4 * s);
ctx.strokeRect(w * 0.06, h * 0.08, w * 0.88, h * 0.84);

const e1 = ease(p * 3.2);
ctx.save();
ctx.globalAlpha = e1;
ctx.translate(0, (1 - e1) * 30 * s);

ctx.fillStyle = "#C6FF00";
ctx.fillRect(w * 0.10, h * 0.18, 420 * s, 64 * s);
ctx.fillStyle = "#111111";
ctx.font = "900 " + Math.round(32 * s) + "px 'Pretendard', 'Noto Sans KR', sans-serif";
ctx.textBaseline = "middle";
ctx.fillText("AI STUDIO FOR CREATORS", w * 0.10 + 24 * s, h * 0.18 + 32 * s);

const mainTitle = (scene && scene.caption)
  ? String(scene.caption)
  : "Just Record. AI Does the Rest.";
ctx.fillStyle = "#F8F9FA";
ctx.font = "900 " + Math.round(82 * s) + "px 'Pretendard', 'Noto Sans KR', sans-serif";
ctx.fillText(mainTitle.slice(0, 34), w * 0.10, h * 0.44);

const subTitle = (scene && scene.script)
  ? String(scene.script)
  : "촬영만 하세요. 나머지는 AI Studio가 완성합니다.";
ctx.fillStyle = "#C6FF00";
ctx.font = "800 " + Math.round(52 * s) + "px 'Pretendard', 'Noto Sans KR', sans-serif";
ctx.fillText(subTitle.slice(0, 40), w * 0.10, h * 0.60);

// CTA pill
ctx.fillStyle = "#F8F9FA";
ctx.fillRect(w * 0.10, h * 0.72, 460 * s, 80 * s);
ctx.fillStyle = "#111111";
ctx.font = "900 " + Math.round(38 * s) + "px 'Pretendard', 'Noto Sans KR', sans-serif";
ctx.fillText("▶ 구독 · 다음 영상 바로가기", w * 0.10 + 32 * s, h * 0.72 + 40 * s);
ctx.restore();
`.trim();
  }
}

/**
 * Directly executes the deterministic fallback template onto a 2D canvas context.
 */
export function drawTemplateFallback(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  t: number,
  w: number,
  h: number,
  scene: PlannedScene,
  templateOverride?: SceneTemplate
): void {
  const tpl = templateOverride ?? inferSceneTemplate(scene);
  const code = getTemplateCode(tpl, scene);
  ctx.save();
  try {
    const fn = new Function("ctx", "t", "w", "h", "scene", code) as (
      c: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
      time: number,
      width: number,
      height: number,
      sc: PlannedScene
    ) => void;
    fn(ctx, t, w, h, scene);
  } finally {
    ctx.restore();
  }
}

/**
 * Wraps the deterministic fallback template into a `SceneCode` record (`source: "template-fallback"`).
 */
export function createFallbackSceneCode(
  scene: PlannedScene,
  attempts = 2,
  lastError?: string
): SceneCode {
  const tpl = inferSceneTemplate(scene);
  return {
    sceneId: scene.id,
    code: getTemplateCode(tpl, scene),
    attempts,
    source: "template-fallback",
    ...(lastError ? { lastError } : {}),
  };
}

export const FALLBACK_TEMPLATES: Record<SceneTemplate, string> = {
  title: getTemplateCode("title"),
  bullets: getTemplateCode("bullets"),
  diagram: getTemplateCode("diagram"),
  compare: getTemplateCode("compare"),
  kinetic: getTemplateCode("kinetic"),
  ending: getTemplateCode("ending"),
};
