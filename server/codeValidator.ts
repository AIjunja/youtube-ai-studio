import type { PlannedScene } from "../shared/contract.js";
import { MOCK_SCENE_CODES } from "../shared/mockData.js";

/**
 * Forbidden patterns inside AI-generated Canvas 2D draw() code.
 * These prevent DOM manipulation, network exfiltration, or infinite loops.
 */
const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\bdocument\b/, reason: "DOM access (`document`) is forbidden" },
  { pattern: /\bwindow\b/, reason: "Global `window` access is forbidden" },
  { pattern: /\bfetch\s*\(/, reason: "Network calls (`fetch`) are forbidden" },
  { pattern: /\bXMLHttpRequest\b/, reason: "XHR is forbidden" },
  { pattern: /\beval\s*\(/, reason: "`eval()` is forbidden" },
  { pattern: /\bFunction\s*\(/, reason: "`new Function()` is forbidden" },
  { pattern: /\bimport\s*\(/, reason: "Dynamic `import()` is forbidden" },
  { pattern: /\bwhile\s*\(\s*true\s*\)/, reason: "Infinite loop `while(true)` is forbidden" },
  { pattern: /\bfor\s*\(\s*;\s*;\s*\)/, reason: "Infinite loop `for(;;)` is forbidden" },
  { pattern: /Verified by Gemini 4 Argon/i, reason: "Hardcoded 'Verified by Gemini 4 Argon' badge text is forbidden" },
  { pattern: /ORIGINAL KEEP/i, reason: "Hardcoded 'ORIGINAL KEEP' badge text is forbidden" },
];

export interface CodeValidationResult {
  ok: boolean;
  code: string;
  error?: string;
}

/**
 * Extracts raw JavaScript code from markdown code fences or function wrappers,
 * normalizing it into a clean function body or `function draw(ctx, t, w, h, scene)` declaration.
 */
export function extractRawJsCode(rawText: string): string {
  let code = rawText.trim();

  // Strip markdown code block fences if present
  const fenceMatch = code.match(/```(?:javascript|js|ts|typescript)?\s*([\s\S]*?)```/i);
  if (fenceMatch && fenceMatch[1]) {
    code = fenceMatch[1].trim();
  }

  // Strip leading `export default` or `export`
  code = code.replace(/^\s*export\s+default\s+/, "").replace(/^\s*export\s+/, "");

  return code.trim();
}

/**
 * Performs static security + JavaScript syntax validation on Canvas 2D draw() code.
 */
export function validateDrawCode(rawText: string): CodeValidationResult {
  const code = extractRawJsCode(rawText);

  if (!code || code.length < 15) {
    return {
      ok: false,
      code,
      error: "Generated code is empty or too short (< 15 chars).",
    };
  }

  for (const rule of FORBIDDEN_PATTERNS) {
    if (rule.pattern.test(code)) {
      return {
        ok: false,
        code,
        error: `Security/Rule check failed: ${rule.reason}`,
      };
    }
  }

  if (!/\b(ctx|kit)\s*\./.test(code)) {
    return {
      ok: false,
      code,
      error: "Code does not appear to perform any Canvas 2D drawing operations (`ctx.*` or `kit.*` missing).",
    };
  }

  // Verify JavaScript syntax using new Function without executing it
  try {
    // Allow either a full `function draw(ctx, t, w, h, scene, kit) { ... }` or a function body
    // eslint-disable-next-line no-new-func
    new Function("ctx", "t", "w", "h", "scene", "kit", code);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      code,
      error: `JavaScript SyntaxError: ${message}`,
    };
  }

  return {
    ok: true,
    code,
  };
}

/**
 * Deterministic AI쭌 v2 style Canvas 2D fallback template generator.
 * Guarantees 100% crash-free rendering if Argon model call or fix-code fails.
 */
export function buildTemplateFallbackCode(scene: PlannedScene): string {
  // If scene id matches one of our curated mock scenes, return its rich code directly
  if (MOCK_SCENE_CODES[scene.id]?.code) {
    return MOCK_SCENE_CODES[scene.id].code;
  }

  const safeCaption = JSON.stringify(scene.caption || "핵심 요약");
  const safeScript = JSON.stringify(scene.script || "");
  const safeVisuals = JSON.stringify(
    scene.visuals && scene.visuals.length > 0
      ? scene.visuals.slice(0, 3)
      : [scene.caption || "핵심 포인트", scene.visualIdea || "시각화 요약"]
  );
  const isEnding = scene.kind === "ending" || scene.template === "ending";

  if (isEnding) {
    return `function draw(ctx, t, w, h, scene) {
  ctx.save();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const easeOut = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
  const p = easeOut(t / 0.5);

  ctx.fillStyle = '#0E0E10';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#D7FF3A';
  ctx.fillRect(140, 140, 220 * p, 44);
  ctx.fillStyle = '#0E0E10';
  ctx.font = "900 22px 'GmarketSansBold', 'Pretendard', sans-serif";
  ctx.textBaseline = 'middle';
  ctx.fillText('SUMMARY & CTA', 158, 162);

  ctx.fillStyle = '#FAFAF8';
  ctx.font = "900 68px 'GmarketSansBold', 'Pretendard', sans-serif";
  ctx.fillText((scene && scene.caption) || ${safeCaption}, 140, 280);

  ctx.fillStyle = '#8A8A90';
  ctx.font = "600 34px 'GmarketSansMedium', 'Pretendard', sans-serif";
  ctx.fillText(((scene && scene.script) || ${safeScript}).slice(0, 48), 140, 360);

  const items = (scene && scene.visuals && scene.visuals.length) ? scene.visuals.slice(0, 3) : ${safeVisuals};
  items.forEach((item, idx) => {
    const ip = easeOut((t - 0.12 * idx) / 0.45);
    const y = 460 + idx * 125 + (1 - ip) * 24;
    ctx.globalAlpha = ip;
    ctx.fillStyle = idx === items.length - 1 ? '#D7FF3A' : '#1C1C20';
    ctx.fillRect(140, y, w - 280, 96);
    ctx.fillStyle = idx === items.length - 1 ? '#0E0E10' : '#FAFAF8';
    ctx.font = "800 34px 'GmarketSansBold', 'Pretendard', sans-serif";
    ctx.fillText(String(item).slice(0, 40), 180, y + 48);
  });

  ctx.restore();
}`;
  }

  return `function draw(ctx, t, w, h, scene) {
  ctx.save();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const easeOut = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
  const p = easeOut(t / 0.5);

  // Off-white paper background (AI쭌 v2 tone)
  ctx.fillStyle = '#FAFAF8';
  ctx.fillRect(0, 0, w, h);

  // Subtle grid
  ctx.strokeStyle = 'rgba(14, 14, 16, 0.05)';
  ctx.lineWidth = 1;
  for (let x = 120; x < w; x += 120) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 120; y < h; y += 120) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }

  // Top lime highlight bar + category tag
  ctx.fillStyle = '#0E0E10';
  ctx.fillRect(120, 108, 240, 46);
  ctx.fillStyle = '#D7FF3A';
  ctx.font = "800 21px 'GmarketSansBold', 'Pretendard', sans-serif";
  ctx.textBaseline = 'middle';
  ctx.fillText('AI MOTION BRIDGE', 142, 131);

  // Main headline with lime underline accent
  const headline = ((scene && scene.caption) || ${safeCaption}).slice(0, 28);
  ctx.fillStyle = '#D7FF3A';
  ctx.fillRect(120, 244, Math.min(w - 240, headline.length * 48) * p, 28);

  ctx.fillStyle = '#0E0E10';
  ctx.font = "900 64px 'GmarketSansBold', 'Pretendard', sans-serif";
  ctx.fillText(headline, 120, 232);

  // Cards for visuals
  const items = (scene && scene.visuals && scene.visuals.length) ? scene.visuals.slice(0, 3) : ${safeVisuals};
  const count = Math.max(1, items.length);
  const gap = 32;
  const totalW = w - 240;
  const cardW = (totalW - gap * (count - 1)) / count;
  const cardY = 340;
  const cardH = 440;

  items.forEach((label, i) => {
    const cp = easeOut((t - 0.12 - i * 0.12) / 0.5);
    const x = 120 + i * (cardW + gap);
    const y = cardY + (1 - cp) * 36;

    ctx.globalAlpha = cp;
    ctx.fillStyle = i === count - 1 ? '#0E0E10' : '#FFFFFF';
    ctx.fillRect(x, y, cardW, cardH);

    ctx.lineWidth = 3;
    ctx.strokeStyle = '#0E0E10';
    ctx.strokeRect(x, y, cardW, cardH);

    // Step number badge
    ctx.fillStyle = '#D7FF3A';
    ctx.fillRect(x + 28, y + 28, 72, 42);
    ctx.fillStyle = '#0E0E10';
    ctx.font = "900 22px 'GmarketSansBold', 'Pretendard', sans-serif";
    ctx.fillText('0' + (i + 1), x + 48, y + 49);

    // Label text
    ctx.fillStyle = i === count - 1 ? '#FAFAF8' : '#0E0E10';
    ctx.font = "800 36px 'GmarketSansBold', 'Pretendard', sans-serif";
    const textStr = String(label);
    const line1 = textStr.slice(0, 14);
    const line2 = textStr.slice(14, 28);
    ctx.fillText(line1, x + 28, y + 150);
    if (line2) {
      ctx.fillText(line2, x + 28, y + 202);
    }
  });

  // Bottom subtitle bar
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#0E0E10';
  ctx.fillRect(120, 850, w - 240, 110);
  ctx.fillStyle = '#D7FF3A';
  ctx.fillRect(120, 850, 14, 110);

  ctx.fillStyle = '#FAFAF8';
  ctx.font = "700 34px 'GmarketSansMedium', 'Pretendard', sans-serif";
  const subText = ((scene && scene.script) || ${safeScript}).slice(0, 46);
  ctx.fillText(subText, 162, 905);

  ctx.restore();
}`;
}
