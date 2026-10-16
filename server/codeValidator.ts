import type { PlannedScene } from "../shared/contract.js";
import { MOCK_SCENE_CODES } from "../shared/mockData.js";

const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bfetch\s*\(/, label: "fetch()" },
  { pattern: /\bXMLHttpRequest\b/, label: "XMLHttpRequest" },
  { pattern: /\bWebSocket\b/, label: "WebSocket" },
  { pattern: /\bimportScripts\b/, label: "importScripts" },
  { pattern: /\bdocument\s*\./, label: "document.*" },
  { pattern: /\bwindow\s*\./, label: "window.*" },
  { pattern: /\bnew\s+Image\s*\(/, label: "new Image()" },
  { pattern: /\beval\s*\(/, label: "eval()" },
  { pattern: /\bMath\.random\s*\(/, label: "Math.random() (non-deterministic)" },
];

/**
 * Strip markdown fences and outer `function draw(...) { ... }` wrapper if present,
 * leaving only the inner JavaScript function body for `draw(ctx, t, w, h, scene)`.
 */
export function extractDrawFunctionBody(rawText: string): string {
  let cleaned = rawText.trim();

  // Extract from ```js / ```javascript / ```ts / ``` code fence if present
  const fenceMatch = cleaned.match(/```(?:javascript|js|typescript|ts)?\s*([\s\S]*?)```/i);
  if (fenceMatch && fenceMatch[1]) {
    cleaned = fenceMatch[1].trim();
  }

  // Remove leading/trailing backticks if any remain
  cleaned = cleaned.replace(/^`+|`+$/g, "").trim();

  // If the model wrapped the body in `function draw(ctx, t, w, h, scene) { ... }`
  const fnMatch = cleaned.match(
    /^(?:export\s+)?(?:async\s+)?function\s+draw\s*\([^)]*\)\s*\{([\s\S]*)\}\s*;?\s*$/
  );
  if (fnMatch && fnMatch[1]) {
    cleaned = fnMatch[1].trim();
  }

  return cleaned;
}

export type CodeValidationResult = {
  ok: boolean;
  code: string;
  error?: string;
};

/**
 * Perform static validation on generated Canvas 2D draw body:
 * 1. Non-empty check & canvas drawing call check
 * 2. Forbidden token scan (network, DOM, Image, Math.random)
 * 3. Syntax check via `new Function("ctx", "t", "w", "h", "scene", code)` (never executed on server)
 */
export function validateDrawCode(rawText: string): CodeValidationResult {
  const code = extractDrawFunctionBody(rawText);

  if (!code || code.length < 20) {
    return {
      ok: false,
      code,
      error: "Generated code body is empty or too short.",
    };
  }

  if (!/\bctx\s*\./.test(code)) {
    return {
      ok: false,
      code,
      error: "Generated code does not use Canvas 2D context (`ctx.*`).",
    };
  }

  for (const { pattern, label } of FORBIDDEN_PATTERNS) {
    if (pattern.test(code)) {
      return {
        ok: false,
        code,
        error: `Forbidden API or non-deterministic token detected: ${label}`,
      };
    }
  }

  try {
    // Syntax check only — never invoked on the server
    new Function("ctx", "t", "w", "h", "scene", code);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      code,
      error: `JavaScript SyntaxError in draw body: ${msg}`,
    };
  }

  return { ok: true, code };
}

/**
 * Safe deterministic Canvas 2D fallback template generator (AI쭌 v2 style).
 * Ensures export/rendering never breaks even if model calls or code fixes fail.
 */
export function buildTemplateFallbackCode(scene: PlannedScene): string {
  // Check if mockData already has a tailored high-craft code for this exact scene ID
  if (MOCK_SCENE_CODES[scene.id]?.code) {
    return MOCK_SCENE_CODES[scene.id].code;
  }

  if (scene.kind === "ending") {
    return `
// AI쭌 v2 Ending Card — Ink Full-bleed (#111111) + Lime Accent (#C6FF00)
const dur = (scene && scene.durationSec) ? scene.durationSec : 3.0;
const p = Math.min(1, Math.max(0, t / dur));
const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const eIn = ease(t / 0.55);

ctx.fillStyle = "#111111";
ctx.fillRect(0, 0, w, h);

// Subtle corner frame
ctx.strokeStyle = "rgba(198, 255, 0, 0.22)";
ctx.lineWidth = 3;
ctx.strokeRect(w * 0.06, h * 0.08, w * 0.88, h * 0.84);

ctx.save();
ctx.translate(0, (1 - eIn) * 36);
ctx.globalAlpha = Math.max(0.2, eIn);

// Lime badge
ctx.fillStyle = "#C6FF00";
ctx.fillRect(w * 0.09, h * 0.24, 420, 62);
ctx.fillStyle = "#111111";
ctx.font = "900 36px sans-serif";
ctx.textBaseline = "middle";
ctx.fillText("AI STUDIO FOR CREATORS", w * 0.09 + 24, h * 0.24 + 31);

// Main caption
const title = (scene && scene.caption) ? scene.caption : "Just Record. AI Does the Rest.";
ctx.fillStyle = "#FFFFFF";
ctx.font = "900 72px sans-serif";
ctx.fillText(title.slice(0, 34), w * 0.09, h * 0.47);

// Sub script
const sub = (scene && scene.script) ? scene.script : "촬영만 하세요. 나머지는 AI Studio가 완성합니다.";
ctx.fillStyle = "#C6FF00";
ctx.font = "700 48px sans-serif";
ctx.fillText(sub.slice(0, 42), w * 0.09, h * 0.62);

// Bottom progress bar
ctx.fillStyle = "rgba(255,255,255,0.16)";
ctx.fillRect(w * 0.09, h * 0.78, w * 0.82, 12);
ctx.fillStyle = "#C6FF00";
ctx.fillRect(w * 0.09, h * 0.78, w * 0.82 * p, 12);
ctx.restore();
`.trim();
  }

  // Default AI쭌 v2 Paper Motion Graphic (#F8F9FA background, #111111 ink, #C6FF00 lime)
  return `
// AI쭌 v2 Concept Motion Card — White Margin (#F8F9FA) + Ink (#111111) + Lime (#C6FF00)
const dur = (scene && scene.durationSec) ? scene.durationSec : 4.0;
const p = Math.min(1, Math.max(0, t / dur));
const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const eTitle = ease(t / 0.45);

ctx.fillStyle = "#F8F9FA";
ctx.fillRect(0, 0, w, h);

// Subtle grid
ctx.strokeStyle = "rgba(17, 17, 17, 0.05)";
ctx.lineWidth = 2;
for (let x = 96; x < w; x += 96) {
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, h);
  ctx.stroke();
}

// Header Tag + Title
ctx.save();
ctx.translate(0, (1 - eTitle) * 28);
ctx.fillStyle = "#111111";
ctx.fillRect(w * 0.08, h * 0.10, 310, 54);
ctx.fillStyle = "#C6FF00";
ctx.font = "900 28px sans-serif";
ctx.textBaseline = "middle";
ctx.fillText("AI EXPLANATION SCENE", w * 0.08 + 22, h * 0.10 + 27);

const caption = (scene && scene.caption) ? String(scene.caption) : "핵심 개념 요약";
ctx.fillStyle = "#111111";
ctx.font = "900 64px sans-serif";
ctx.fillText(caption.slice(0, 28), w * 0.08, h * 0.24);
ctx.fillStyle = "#C6FF00";
ctx.fillRect(w * 0.08, h * 0.28, Math.min(w * 0.75, Math.max(280, caption.length * 36)), 14);
ctx.restore();

// Visual Points / Cards
const items = (scene && Array.isArray(scene.visuals) && scene.visuals.length > 0)
  ? scene.visuals.slice(0, 3)
  : [
      caption,
      (scene && scene.script) ? String(scene.script).slice(0, 32) : "핵심 원리 도식화",
      "검증 루프 통과 완료"
    ];

const cardW = w * 0.84;
const cardH = h * 0.16;
const startX = w * 0.08;
const startY = h * 0.36;
const gapY = h * 0.04;

for (let i = 0; i < items.length; i++) {
  const eCard = ease((t - i * 0.14) / 0.45);
  if (eCard <= 0) continue;
  const cy = startY + i * (cardH + gapY);
  const isHighlight = i === items.length - 1;

  ctx.save();
  ctx.globalAlpha = Math.max(0.15, eCard);
  ctx.translate((1 - eCard) * 40, 0);

  ctx.fillStyle = isHighlight ? "#111111" : "#FFFFFF";
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 4;
  ctx.fillRect(startX, cy, cardW, cardH);
  ctx.strokeRect(startX, cy, cardW, cardH);

  // Number badge
  ctx.fillStyle = "#C6FF00";
  ctx.fillRect(startX + 28, cy + (cardH - 64) / 2, 84, 64);
  ctx.fillStyle = "#111111";
  ctx.font = "900 36px sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText("0" + (i + 1), startX + 48, cy + cardH / 2);

  // Card text (minimum 48px)
  ctx.fillStyle = isHighlight ? "#FFFFFF" : "#111111";
  ctx.font = "800 48px sans-serif";
  ctx.fillText(String(items[i]).slice(0, 34), startX + 140, cy + cardH / 2);
  ctx.restore();
}
`.trim();
}
