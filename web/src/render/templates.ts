import type {
  PlannedScene,
  SceneCode,
  SceneTemplate,
} from "../../../shared/contract";
import { createMotionKit, type AnyCanvas2DContext } from "./motionKit";

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
 * Generates deterministic Canvas 2D `draw(ctx, t, w, h, scene, kit)` function body code
 * for the 6 fallback templates (`title`, `bullets`, `diagram`, `compare`, `kinetic`, `ending`).
 *
 * Uses `kit.*` components on the unified 1920x1080 coordinate system with:
 * - GmarketSansBold / GmarketSansMedium
 * - Background #FAFAF8 (or #0B0B0C for ending), Ink #0E0E10, Lime #D7FF3A
 * - Auto text measurement & wrapping (`measureText`) with min font size 34px
 * - Zero internal debug/verification labels on the canvas
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
kit.bg("light");
const title = (scene && scene.caption) ? String(scene.caption) : "핵심 요약 포인트";
const sub = (scene && scene.script) ? String(scene.script) : "";
const firstVisual = (scene && Array.isArray(scene.visuals) && scene.visuals[0])
  ? String(scene.visuals[0])
  : "핵심 포인트";

kit.full(ctx, {
  tag: firstVisual,
  text: title,
  subtext: sub,
  t,
  at: 0
});
kit.flash(ctx, t, 0, w, h);
`.trim();

    case "bullets":
      return `
kit.bg("light");
const title = (scene && scene.caption) ? String(scene.caption) : "꼭 기억할 핵심 정리";
const items = (scene && Array.isArray(scene.visuals) && scene.visuals.length > 0)
  ? scene.visuals.slice(0, 3)
  : [
      (scene && scene.script) ? String(scene.script) : "첫 번째 핵심 내용을 확인하세요",
      "불필요한 구간은 덜어내고 핵심만 남깁니다",
      "시청자가 이해하기 쉽게 단계별로 정리합니다"
    ];

kit.slam(ctx, {
  text: title,
  x: w * 0.5,
  y: 165,
  size: 64,
  maxWidth: w - 240,
  align: "center",
  accent: true,
  t,
  at: 0
});

const dur = Math.max(2.5, (scene && scene.durationSec) || 4);
const activeIdx = Math.min(items.length - 1, Math.floor((t / dur) * items.length));

kit.numbered(ctx, {
  items,
  x: 120,
  y: 280,
  w: w - 240,
  activeIndex: activeIdx,
  t,
  at: 0.14
});
kit.flash(ctx, t, 0, w, h);
`.trim();

    case "diagram":
      return `
kit.bg("light");
const heading = (scene && scene.caption) ? String(scene.caption) : "단계별 핵심 흐름";
const rawVisuals = (scene && Array.isArray(scene.visuals) && scene.visuals.length >= 2)
  ? scene.visuals.slice(0, 3)
  : ["문제 원인 파악", "핵심 구조 설계", "실제 적용 및 완성"];

kit.slam(ctx, {
  text: heading,
  x: w * 0.5,
  y: 170,
  size: 64,
  maxWidth: w - 240,
  align: "center",
  accent: true,
  t,
  at: 0
});

const dur = Math.max(2.5, (scene && scene.durationSec) || 4.5);
const activeIdx = Math.min(rawVisuals.length - 1, Math.floor((t / dur) * rawVisuals.length));

kit.flow(ctx, {
  steps: rawVisuals.map((v, i) => ({
    tag: "0" + (i + 1),
    title: String(v).replace(/^[①②③④0-9.\\s]+/, ""),
    desc: i === rawVisuals.length - 1 ? "핵심 완료 단계" : "다음 단계로 연결"
  })),
  x: 120,
  y: 310,
  w: w - 240,
  h: 430,
  activeIndex: activeIdx,
  t,
  at: 0.12
});
kit.flash(ctx, t, 0, w, h);
`.trim();

    case "compare":
      return `
kit.bg("light");
const title = (scene && scene.caption) ? String(scene.caption) : "한눈에 보는 핵심 차이";
const visuals = (scene && Array.isArray(scene.visuals)) ? scene.visuals : [];
const leftTitle = visuals[0] ? String(visuals[0]) : "기존 방식의 한계";
const rightTitle = visuals[1] ? String(visuals[1]) : "개선된 핵심 해법";

kit.slam(ctx, {
  text: title,
  x: w * 0.5,
  y: 165,
  size: 64,
  maxWidth: w - 240,
  align: "center",
  accent: true,
  t,
  at: 0
});

const cardW = Math.floor((w - 240 - 60) / 2);
const cardY = 285;
const cardH = 480;

kit.card(ctx, {
  x: 120,
  y: cardY,
  w: cardW,
  h: cardH,
  tag: "비교 01",
  title: leftTitle,
  body: "반복 시행착오와 시간 소모가 발생합니다",
  dark: false,
  accent: false,
  t,
  at: 0.12
});

kit.card(ctx, {
  x: 120 + cardW + 60,
  y: cardY,
  w: cardW,
  h: cardH,
  tag: "핵심 해법",
  title: rightTitle,
  body: (scene && scene.script) ? String(scene.script) : "체계적인 과정으로 빠르고 정확하게 완성합니다",
  dark: true,
  accent: true,
  t,
  at: 0.26
});
kit.flash(ctx, t, 0, w, h);
`.trim();

    case "kinetic":
      return `
kit.bg("light");
const caption = (scene && scene.caption) ? String(scene.caption) : "핵심 개념 한눈에 보기";
const script = (scene && scene.script) ? String(scene.script) : "";
const words = caption.split(/\\s+/).filter(Boolean);
const accentWord = words.length > 1 ? words[words.length - 1] : words[0];

kit.slam(ctx, {
  text: caption,
  x: w * 0.5,
  y: 340,
  size: 86,
  maxWidth: w - 240,
  align: "center",
  accent: true,
  accentWord,
  t,
  at: 0
});

if (script) {
  kit.card(ctx, {
    x: 180,
    y: 550,
    w: w - 360,
    h: 240,
    title: script,
    dark: true,
    accent: true,
    t,
    at: 0.22
  });
}
kit.flash(ctx, t, 0, w, h);
`.trim();

    case "ending":
      return `
kit.bg("dark");
const mainTitle = (scene && scene.caption)
  ? String(scene.caption)
  : "오늘 내용이 도움이 되셨다면";
const subTitle = (scene && scene.script)
  ? String(scene.script)
  : "구독과 좋아요로 다음 영상에서 또 만나요";

kit.chip(ctx, {
  text: "다음 영상에서 계속",
  x: w * 0.5,
  y: 190,
  align: "center",
  lime: true,
  size: 36,
  t,
  at: 0
});

kit.slam(ctx, {
  text: mainTitle,
  x: w * 0.5,
  y: 430,
  size: 84,
  maxWidth: w - 260,
  align: "center",
  color: "#FAFAF8",
  t,
  at: 0.08
});

kit.wrapText(subTitle, w * 0.5, 600, {
  maxWidth: w - 300,
  fontSize: 46,
  maxLines: 2,
  align: "center",
  color: "#D7FF3A",
  fontFamily: kit.fonts.medium,
  fontWeight: 500
});

kit.chip(ctx, {
  text: "구독과 알림 설정",
  x: w * 0.5,
  y: 760,
  align: "center",
  lime: true,
  size: 40,
  t,
  at: 0.24
});
kit.flash(ctx, t, 0, w, h);
`.trim();
  }
}

/**
 * Directly executes the deterministic fallback template onto a 2D canvas context.
 */
export function drawTemplateFallback(
  ctx: AnyCanvas2DContext,
  t: number,
  w: number,
  h: number,
  scene: PlannedScene,
  templateOverride?: SceneTemplate
): void {
  const tpl = templateOverride ?? inferSceneTemplate(scene);
  const code = getTemplateCode(tpl, scene);
  const kit = createMotionKit(ctx, t, w, h, scene);
  ctx.save();
  try {
    const fn = new Function("ctx", "t", "w", "h", "scene", "kit", code) as (
      c: AnyCanvas2DContext,
      time: number,
      width: number,
      height: number,
      sc: PlannedScene,
      k: ReturnType<typeof createMotionKit>
    ) => void;
    fn(ctx, t, w, h, scene, kit);
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
  lastError?: string,
  usedModel = "template-fallback"
): SceneCode {
  const tpl = inferSceneTemplate(scene);
  return {
    sceneId: scene.id,
    code: getTemplateCode(tpl, scene),
    attempts,
    source: "template-fallback",
    usedModel,
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
