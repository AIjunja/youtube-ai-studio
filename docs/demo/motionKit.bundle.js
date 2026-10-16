"use strict";
var MotionKitLib = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // web/src/render/motionKit.ts
  var motionKit_exports = {};
  __export(motionKit_exports, {
    MOTION_DESIGN: () => MOTION_DESIGN,
    clamp01: () => clamp01,
    createMotionKit: () => createMotionKit,
    drawWrappedText: () => drawWrappedText,
    easeOutBack: () => easeOutBack,
    easeOutCubic: () => easeOutCubic,
    easeOutExpo: () => easeOutExpo,
    ensureMotionFontsLoaded: () => ensureMotionFontsLoaded,
    fitAndWrapText: () => fitAndWrapText,
    spring: () => spring
  });
  var MOTION_DESIGN = {
    width: 1920,
    height: 1080,
    safeX: 120,
    safeY: 96,
    minFontPx: 34,
    colors: {
      bgLight: "#FAFAF8",
      bgDark: "#0B0B0C",
      ink: "#0E0E10",
      muted: "#8A8A90",
      lime: "#D7FF3A",
      white: "#FFFFFF",
      border: "#D4D4D8"
    },
    fonts: {
      bold: "'GmarketSansBold', 'Gmarket Sans', 'Pretendard', 'Noto Sans KR', sans-serif",
      medium: "'GmarketSansMedium', 'Gmarket Sans', 'Pretendard', 'Noto Sans KR', sans-serif",
      light: "'GmarketSansLight', 'Gmarket Sans', 'Pretendard', 'Noto Sans KR', sans-serif",
      mono: "'JetBrains Mono', monospace"
    }
  };
  var fontLoadPromise = null;
  function ensureMotionFontsLoaded() {
    if (fontLoadPromise) {
      return fontLoadPromise;
    }
    fontLoadPromise = (async () => {
      if (typeof FontFace === "undefined") {
        return;
      }
      const fontSpecs = [
        { family: "GmarketSansBold", url: "/fonts/GmarketSansTTFBold.ttf", weight: "700" },
        { family: "GmarketSansMedium", url: "/fonts/GmarketSansTTFMedium.ttf", weight: "500" },
        { family: "GmarketSansLight", url: "/fonts/GmarketSansTTFLight.ttf", weight: "300" }
      ];
      const fontSet = typeof document !== "undefined" && document.fonts ? document.fonts : typeof self !== "undefined" && "fonts" in self ? self.fonts : void 0;
      if (!fontSet) return;
      await Promise.all(
        fontSpecs.map(async (spec) => {
          try {
            const face = new FontFace(spec.family, `url(${spec.url})`, {
              weight: spec.weight,
              style: "normal"
            });
            const loaded = await face.load();
            fontSet.add(loaded);
          } catch {
          }
        })
      );
    })();
    return fontLoadPromise;
  }
  function clamp01(x) {
    return Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0));
  }
  function easeOutExpo(x) {
    const c = clamp01(x);
    return c === 1 ? 1 : 1 - Math.pow(2, -10 * c);
  }
  function easeOutCubic(x) {
    const c = clamp01(x);
    return 1 - Math.pow(1 - c, 3);
  }
  function easeOutBack(x) {
    const c = clamp01(x);
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(c - 1, 3) + c1 * Math.pow(c - 1, 2);
  }
  function spring(x) {
    const c = clamp01(x);
    if (c === 0 || c === 1) return c;
    return 1 - Math.exp(-6.5 * c) * Math.cos(9.5 * c);
  }
  function fitAndWrapText(ctx, text, options) {
    const cleanText = String(text ?? "").trim();
    const minFont = Math.max(MOTION_DESIGN.minFontPx, options.minFontSize ?? MOTION_DESIGN.minFontPx);
    let currentSize = Math.max(minFont, Math.round(options.fontSize));
    const maxLines = options.maxLines ?? 3;
    const family = options.fontFamily ?? MOTION_DESIGN.fonts.bold;
    const weight = options.fontWeight ?? 700;
    const lineRatio = options.lineHeightRatio ?? 1.28;
    const safeMaxW = Math.max(120, options.maxWidth);
    const computeLines = (size) => {
      ctx.font = `${weight} ${size}px ${family}`;
      if (!cleanText) return { lines: [], maxW: 0 };
      const paragraphs = cleanText.split(/\n+/);
      const lines = [];
      let maxW = 0;
      for (const para of paragraphs) {
        const words = para.split(/\s+/).filter(Boolean);
        if (words.length === 0) continue;
        let currentLine = "";
        for (const word of words) {
          const candidate = currentLine ? `${currentLine} ${word}` : word;
          const w = ctx.measureText(candidate).width;
          if (w <= safeMaxW) {
            currentLine = candidate;
          } else {
            if (currentLine) {
              lines.push(currentLine);
              maxW = Math.max(maxW, ctx.measureText(currentLine).width);
            }
            if (ctx.measureText(word).width > safeMaxW) {
              let charChunk = "";
              for (const ch of word) {
                const nextChunk = charChunk + ch;
                if (ctx.measureText(nextChunk).width <= safeMaxW) {
                  charChunk = nextChunk;
                } else {
                  if (charChunk) {
                    lines.push(charChunk);
                    maxW = Math.max(maxW, ctx.measureText(charChunk).width);
                  }
                  charChunk = ch;
                }
              }
              currentLine = charChunk;
            } else {
              currentLine = word;
            }
          }
        }
        if (currentLine) {
          lines.push(currentLine);
          maxW = Math.max(maxW, ctx.measureText(currentLine).width);
        }
      }
      return { lines, maxW };
    };
    let wrapped = computeLines(currentSize);
    while ((wrapped.lines.length > maxLines || wrapped.maxW > safeMaxW) && currentSize > minFont) {
      currentSize = Math.max(minFont, currentSize - 4);
      wrapped = computeLines(currentSize);
    }
    if (wrapped.lines.length > maxLines) {
      const kept = wrapped.lines.slice(0, maxLines);
      const lastIdx = kept.length - 1;
      let last = kept[lastIdx];
      ctx.font = `${weight} ${currentSize}px ${family}`;
      while (last.length > 1 && ctx.measureText(`${last}\u2026`).width > safeMaxW) {
        last = last.slice(0, -1);
      }
      kept[lastIdx] = `${last}\u2026`;
      wrapped.lines = kept;
    }
    return {
      lines: wrapped.lines,
      fontSize: currentSize,
      lineHeight: Math.round(currentSize * lineRatio),
      maxLineWidth: wrapped.maxW
    };
  }
  function drawWrappedText(ctx, text, x, y, options) {
    const res = fitAndWrapText(ctx, text, options);
    const family = options.fontFamily ?? MOTION_DESIGN.fonts.bold;
    const weight = options.fontWeight ?? 700;
    const align = options.align ?? "left";
    const color = options.color ?? MOTION_DESIGN.colors.ink;
    ctx.save();
    ctx.font = `${weight} ${res.fontSize}px ${family}`;
    ctx.textBaseline = "top";
    ctx.textAlign = align;
    for (let i = 0; i < res.lines.length; i++) {
      const line = res.lines[i];
      const ly = y + i * res.lineHeight;
      if (options.highlightWord && line.includes(options.highlightWord)) {
        const hw = options.highlightWord;
        const lineW = ctx.measureText(line).width;
        const startX = align === "center" ? x - lineW * 0.5 : align === "right" ? x - lineW : x;
        const beforeIdx = line.indexOf(hw);
        const beforeW = ctx.measureText(line.slice(0, beforeIdx)).width;
        const targetW = ctx.measureText(hw).width;
        ctx.fillStyle = options.highlightColor ?? MOTION_DESIGN.colors.lime;
        ctx.fillRect(
          startX + beforeW - 6,
          ly + res.fontSize * 0.12,
          targetW + 12,
          res.fontSize * 0.88
        );
      }
      ctx.fillStyle = color;
      ctx.fillText(line, x, ly);
    }
    ctx.restore();
    return res;
  }
  function isCanvasContext(arg) {
    return typeof arg === "object" && arg !== null && "fillRect" in arg && "measureText" in arg;
  }
  function createMotionKit(defaultCtx, defaultT, defaultW, defaultH, scene) {
    const s = defaultW / 1920;
    const resolveArgs = (first, second) => {
      if (isCanvasContext(first)) {
        return { ctx: first, opts: second ?? {} };
      }
      return { ctx: defaultCtx, opts: first };
    };
    const drawBackground = (c, width, height, mode = "light") => {
      c.save();
      c.fillStyle = mode === "dark" ? MOTION_DESIGN.colors.bgDark : MOTION_DESIGN.colors.bgLight;
      c.fillRect(0, 0, width, height);
      c.strokeStyle = mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(14,14,16,0.045)";
      c.lineWidth = Math.max(1, 1.5 * (width / 1920));
      const step = Math.max(48, Math.round(96 * (width / 1920)));
      for (let x = step; x < width; x += step) {
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x, height);
        c.stroke();
      }
      for (let y = step; y < height; y += step) {
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(width, y);
        c.stroke();
      }
      c.restore();
    };
    const kit = {
      easeOutExpo,
      easeOutCubic,
      easeOutBack,
      spring,
      clamp01,
      colors: MOTION_DESIGN.colors,
      fonts: MOTION_DESIGN.fonts,
      safeX: Math.round(MOTION_DESIGN.safeX * s),
      safeY: Math.round(MOTION_DESIGN.safeY * s),
      setTheme(ctxOrMode, wOrMode, hArg, modeArg) {
        if (isCanvasContext(ctxOrMode)) {
          const width = typeof wOrMode === "number" ? wOrMode : defaultW;
          const height = typeof hArg === "number" ? hArg : defaultH;
          const mode = typeof wOrMode === "string" ? wOrMode : modeArg ?? "light";
          drawBackground(ctxOrMode, width, height, mode);
        } else {
          drawBackground(defaultCtx, defaultW, defaultH, ctxOrMode ?? "light");
        }
      },
      bg(mode = "light") {
        drawBackground(defaultCtx, defaultW, defaultH, mode);
      },
      chip(ctxOrOpts, maybeOpts) {
        const { ctx, opts } = resolveArgs(ctxOrOpts, maybeOpts);
        const tVal = opts.t ?? defaultT;
        const atVal = opts.at ?? 0;
        const prog = easeOutCubic((tVal - atVal) / 0.32);
        if (prog <= 0) return { width: 0, height: 0 };
        const fontSize = Math.max(
          MOTION_DESIGN.minFontPx,
          Math.round((opts.size ?? 34) * s)
        );
        ctx.save();
        ctx.font = `700 ${fontSize}px ${MOTION_DESIGN.fonts.bold}`;
        const text = String(opts.text ?? "").trim();
        const textW = ctx.measureText(text).width;
        const padX = Math.round(28 * s);
        const padY = Math.round(14 * s);
        const boxW = Math.min(defaultW - 240 * s, textW + padX * 2);
        const boxH = fontSize + padY * 2;
        const drawX = opts.align === "center" ? opts.x - boxW * 0.5 : opts.x;
        const drawY = opts.y + (1 - prog) * 18 * s;
        ctx.globalAlpha = prog;
        if (opts.lime) {
          ctx.fillStyle = MOTION_DESIGN.colors.lime;
          ctx.fillRect(drawX, drawY, boxW, boxH);
          ctx.strokeStyle = MOTION_DESIGN.colors.ink;
          ctx.lineWidth = Math.max(2, 2.5 * s);
          ctx.strokeRect(drawX, drawY, boxW, boxH);
          ctx.fillStyle = MOTION_DESIGN.colors.ink;
        } else {
          ctx.fillStyle = opts.dark ? MOTION_DESIGN.colors.white : MOTION_DESIGN.colors.ink;
          ctx.fillRect(drawX, drawY, boxW, boxH);
          ctx.fillStyle = opts.dark ? MOTION_DESIGN.colors.ink : MOTION_DESIGN.colors.lime;
        }
        ctx.textBaseline = "middle";
        ctx.textAlign = "center";
        ctx.fillText(text, drawX + boxW * 0.5, drawY + boxH * 0.52);
        ctx.restore();
        return { width: boxW, height: boxH };
      },
      slam(ctxOrOpts, maybeOpts) {
        const { ctx, opts } = resolveArgs(ctxOrOpts, maybeOpts);
        const tVal = opts.t ?? defaultT;
        const atVal = opts.at ?? 0;
        const dur = Math.max(0.18, opts.duration ?? 0.38);
        const rawP = clamp01((tVal - atVal) / dur);
        if (rawP <= 0) return;
        const back = easeOutBack(rawP);
        const scale = 1.28 - 0.28 * back;
        const offsetY = -28 * s * (1 - back);
        const x = opts.x ?? defaultW * 0.5;
        const y = opts.y ?? defaultH * 0.34;
        const align = opts.align ?? "center";
        const maxWidth = opts.maxWidth ?? defaultW - 240 * s;
        const targetSize = Math.max(
          MOTION_DESIGN.minFontPx,
          Math.round((opts.size ?? 78) * s)
        );
        ctx.save();
        ctx.globalAlpha = clamp01(rawP * 2.2);
        ctx.translate(x, y + offsetY);
        ctx.scale(scale, scale);
        const wrapped = fitAndWrapText(ctx, opts.text, {
          maxWidth,
          fontSize: targetSize,
          maxLines: 3,
          fontFamily: MOTION_DESIGN.fonts.bold,
          fontWeight: 700
        });
        ctx.font = `700 ${wrapped.fontSize}px ${MOTION_DESIGN.fonts.bold}`;
        ctx.textBaseline = "top";
        ctx.textAlign = align;
        const totalH = wrapped.lines.length * wrapped.lineHeight;
        const startY = -totalH * 0.5;
        for (let i = 0; i < wrapped.lines.length; i++) {
          const line = wrapped.lines[i];
          const lw = ctx.measureText(line).width;
          const ly = startY + i * wrapped.lineHeight;
          const barX = align === "center" ? -lw * 0.5 : align === "right" ? -lw : 0;
          if (opts.accent && i === wrapped.lines.length - 1) {
            ctx.fillStyle = MOTION_DESIGN.colors.lime;
            ctx.fillRect(
              barX - 14 * s,
              ly + wrapped.fontSize * 0.42,
              lw + 28 * s,
              wrapped.fontSize * 0.56
            );
          } else if (opts.accentWord && line.includes(opts.accentWord)) {
            const idx = line.indexOf(opts.accentWord);
            const preW = ctx.measureText(line.slice(0, idx)).width;
            const wordW = ctx.measureText(opts.accentWord).width;
            ctx.fillStyle = MOTION_DESIGN.colors.lime;
            ctx.fillRect(
              barX + preW - 8 * s,
              ly + wrapped.fontSize * 0.1,
              wordW + 16 * s,
              wrapped.fontSize * 0.88
            );
          }
          ctx.fillStyle = opts.color ?? MOTION_DESIGN.colors.ink;
          ctx.fillText(line, 0, ly);
        }
        ctx.restore();
      },
      full(ctxOrOpts, maybeOpts) {
        const { ctx, opts } = resolveArgs(ctxOrOpts, maybeOpts);
        const dark = opts.dark ?? false;
        drawBackground(ctx, defaultW, defaultH, dark ? "dark" : "light");
        const tVal = opts.t ?? defaultT;
        const atVal = opts.at ?? 0;
        if (opts.tag) {
          kit.chip(ctx, {
            text: opts.tag,
            x: defaultW * 0.5,
            y: 128 * s,
            align: "center",
            lime: true,
            t: tVal,
            at: atVal
          });
        }
        kit.slam(ctx, {
          text: opts.text || scene?.caption || "",
          x: defaultW * 0.5,
          y: opts.subtext ? defaultH * 0.43 : defaultH * 0.48,
          size: opts.size ?? 92,
          maxWidth: defaultW - 260 * s,
          align: "center",
          color: dark ? MOTION_DESIGN.colors.white : MOTION_DESIGN.colors.ink,
          accent: !opts.accentWord && !dark,
          accentWord: opts.accentWord,
          t: tVal,
          at: atVal + 0.05
        });
        if (opts.subtext) {
          const subP = easeOutCubic((tVal - (atVal + 0.22)) / 0.38);
          if (subP > 0) {
            ctx.save();
            ctx.globalAlpha = subP;
            drawWrappedText(
              ctx,
              opts.subtext,
              defaultW * 0.5,
              defaultH * 0.66 + (1 - subP) * 20 * s,
              {
                maxWidth: defaultW - 320 * s,
                fontSize: Math.round(46 * s),
                maxLines: 2,
                align: "center",
                color: dark ? MOTION_DESIGN.colors.lime : MOTION_DESIGN.colors.muted,
                fontFamily: MOTION_DESIGN.fonts.medium,
                fontWeight: 500
              }
            );
            ctx.restore();
          }
        }
      },
      card(ctxOrOpts, maybeOpts) {
        const { ctx, opts } = resolveArgs(ctxOrOpts, maybeOpts);
        const tVal = opts.t ?? defaultT;
        const atVal = opts.at ?? 0;
        const prog = easeOutCubic((tVal - atVal) / 0.38);
        if (prog <= 0) return;
        const { x, y, w, h } = opts;
        const pad = Math.round(38 * s);
        const innerW = Math.max(120, w - pad * 2);
        ctx.save();
        ctx.globalAlpha = prog;
        ctx.translate(0, (1 - prog) * 28 * s);
        ctx.fillStyle = opts.dark ? MOTION_DESIGN.colors.ink : MOTION_DESIGN.colors.white;
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = MOTION_DESIGN.colors.ink;
        ctx.lineWidth = Math.max(2, 3 * s);
        ctx.strokeRect(x, y, w, h);
        if (opts.accent || opts.dark) {
          ctx.fillStyle = MOTION_DESIGN.colors.lime;
          ctx.fillRect(x, y, w, Math.round(14 * s));
        }
        let curY = y + pad + (opts.accent || opts.dark ? 10 * s : 0);
        if (opts.tag) {
          const chipDim = kit.chip(ctx, {
            text: opts.tag,
            x: x + pad,
            y: curY,
            lime: Boolean(opts.dark || opts.accent),
            size: 34,
            t: 1,
            at: 0
          });
          curY += chipDim.height + Math.round(24 * s);
        }
        if (opts.title) {
          const titleRes = drawWrappedText(ctx, opts.title, x + pad, curY, {
            maxWidth: innerW,
            fontSize: Math.round(52 * s),
            maxLines: 2,
            color: opts.dark ? MOTION_DESIGN.colors.white : MOTION_DESIGN.colors.ink,
            fontFamily: MOTION_DESIGN.fonts.bold,
            fontWeight: 700
          });
          curY += titleRes.lines.length * titleRes.lineHeight + Math.round(22 * s);
        }
        if (opts.body) {
          const lines = Array.isArray(opts.body) ? opts.body : [opts.body];
          for (const item of lines) {
            if (curY > y + h - pad - 34 * s) break;
            const bodyRes = drawWrappedText(ctx, item, x + pad, curY, {
              maxWidth: innerW,
              fontSize: Math.round(38 * s),
              maxLines: 2,
              color: opts.dark ? MOTION_DESIGN.colors.lime : MOTION_DESIGN.colors.muted,
              fontFamily: MOTION_DESIGN.fonts.medium,
              fontWeight: 500
            });
            curY += bodyRes.lines.length * bodyRes.lineHeight + Math.round(14 * s);
          }
        }
        ctx.restore();
      },
      numbered(ctxOrOpts, maybeOpts) {
        const { ctx, opts } = resolveArgs(ctxOrOpts, maybeOpts);
        const items = (opts.items ?? []).slice(0, 4);
        if (items.length === 0) return;
        const tVal = opts.t ?? defaultT;
        const atVal = opts.at ?? 0;
        const startX = opts.x ?? Math.round(MOTION_DESIGN.safeX * s);
        const startY = opts.y ?? Math.round(280 * s);
        const boxW = opts.w ?? defaultW - startX * 2;
        const gap = Math.round(24 * s);
        const rowH = Math.round(
          Math.min(180 * s, (defaultH - startY - 160 * s - gap * (items.length - 1)) / items.length)
        );
        for (let i = 0; i < items.length; i++) {
          const prog = easeOutCubic((tVal - (atVal + i * 0.16)) / 0.36);
          if (prog <= 0) continue;
          const ry = startY + i * (rowH + gap);
          const isActive = typeof opts.activeIndex === "number" ? opts.activeIndex === i : i === items.length - 1;
          ctx.save();
          ctx.globalAlpha = prog;
          ctx.translate((1 - prog) * 36 * s, 0);
          ctx.fillStyle = isActive ? MOTION_DESIGN.colors.ink : MOTION_DESIGN.colors.white;
          ctx.fillRect(startX, ry, boxW, rowH);
          ctx.strokeStyle = MOTION_DESIGN.colors.ink;
          ctx.lineWidth = Math.max(2, 3 * s);
          ctx.strokeRect(startX, ry, boxW, rowH);
          if (isActive) {
            ctx.fillStyle = MOTION_DESIGN.colors.lime;
            ctx.fillRect(startX, ry, Math.round(16 * s), rowH);
          }
          const badgeW = Math.round(96 * s);
          const badgeH = Math.round(72 * s);
          const bx = startX + Math.round(32 * s);
          const by = ry + (rowH - badgeH) * 0.5;
          ctx.fillStyle = MOTION_DESIGN.colors.lime;
          ctx.fillRect(bx, by, badgeW, badgeH);
          ctx.fillStyle = MOTION_DESIGN.colors.ink;
          ctx.font = `700 ${Math.round(40 * s)}px ${MOTION_DESIGN.fonts.bold}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(`0${i + 1}`, bx + badgeW * 0.5, by + badgeH * 0.52);
          const textX = bx + badgeW + Math.round(32 * s);
          const maxTextW = boxW - (textX - startX) - Math.round(36 * s);
          const wrapped = fitAndWrapText(ctx, items[i], {
            maxWidth: maxTextW,
            fontSize: Math.round(46 * s),
            maxLines: 2,
            fontFamily: MOTION_DESIGN.fonts.bold,
            fontWeight: 700
          });
          const totalTextH = wrapped.lines.length * wrapped.lineHeight;
          drawWrappedText(
            ctx,
            items[i],
            textX,
            ry + (rowH - totalTextH) * 0.5,
            {
              maxWidth: maxTextW,
              fontSize: wrapped.fontSize,
              maxLines: 2,
              color: isActive ? MOTION_DESIGN.colors.white : MOTION_DESIGN.colors.ink,
              fontFamily: MOTION_DESIGN.fonts.bold,
              fontWeight: 700
            }
          );
          ctx.restore();
        }
      },
      chat(ctxOrOpts, maybeOpts) {
        const { ctx, opts } = resolveArgs(ctxOrOpts, maybeOpts);
        const tVal = opts.t ?? defaultT;
        const atVal = opts.at ?? 0;
        const x = opts.x ?? Math.round(160 * s);
        const y = opts.y ?? Math.round(260 * s);
        const w = opts.w ?? defaultW - x * 2;
        const p1 = easeOutCubic((tVal - atVal) / 0.34);
        if (p1 > 0) {
          const promptH = Math.round(140 * s);
          ctx.save();
          ctx.globalAlpha = p1;
          ctx.translate(0, (1 - p1) * 24 * s);
          ctx.fillStyle = MOTION_DESIGN.colors.white;
          ctx.strokeStyle = MOTION_DESIGN.colors.ink;
          ctx.lineWidth = Math.max(2, 3 * s);
          ctx.fillRect(x, y, w, promptH);
          ctx.strokeRect(x, y, w, promptH);
          ctx.fillStyle = MOTION_DESIGN.colors.lime;
          ctx.beginPath();
          ctx.arc(x + 48 * s, y + promptH * 0.5, 16 * s, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeRect(x + 32 * s, y + promptH * 0.5 - 16 * s, 32 * s, 32 * s);
          drawWrappedText(ctx, opts.prompt, x + 92 * s, y + 38 * s, {
            maxWidth: w - 130 * s,
            fontSize: Math.round(42 * s),
            maxLines: 2,
            color: MOTION_DESIGN.colors.ink,
            fontFamily: MOTION_DESIGN.fonts.medium,
            fontWeight: 500
          });
          ctx.restore();
        }
        const p2 = easeOutCubic((tVal - (atVal + 0.25)) / 0.38);
        if (p2 > 0) {
          kit.card(ctx, {
            x,
            y: y + Math.round(180 * s),
            w,
            h: Math.round(340 * s),
            tag: opts.status || "\uD575\uC2EC \uC815\uB9AC",
            title: opts.response,
            dark: true,
            accent: true,
            t: tVal,
            at: atVal + 0.25
          });
        }
      },
      arrow(ctxOrOpts, maybeOpts) {
        const { ctx, opts } = resolveArgs(ctxOrOpts, maybeOpts);
        const p = clamp01(opts.progress ?? 1);
        if (p <= 0) return;
        const curX = opts.x1 + (opts.x2 - opts.x1) * p;
        const curY = opts.y1 + (opts.y2 - opts.y1) * p;
        const lw = opts.lineWidth ?? Math.max(3, 5 * s);
        const head = Math.round(18 * s);
        const angle = Math.atan2(opts.y2 - opts.y1, opts.x2 - opts.x1);
        ctx.save();
        ctx.strokeStyle = opts.color ?? MOTION_DESIGN.colors.ink;
        ctx.fillStyle = opts.color ?? MOTION_DESIGN.colors.ink;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(opts.x1, opts.y1);
        ctx.lineTo(curX, curY);
        ctx.stroke();
        if (p > 0.6) {
          ctx.beginPath();
          ctx.moveTo(curX, curY);
          ctx.lineTo(
            curX - head * Math.cos(angle - Math.PI / 6),
            curY - head * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(
            curX - head * Math.cos(angle + Math.PI / 6),
            curY - head * Math.sin(angle + Math.PI / 6)
          );
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      },
      flow(ctxOrOpts, maybeOpts) {
        const { ctx, opts } = resolveArgs(ctxOrOpts, maybeOpts);
        const rawSteps = (opts.steps ?? []).slice(0, 4);
        const count = rawSteps.length;
        if (count === 0) return;
        const tVal = opts.t ?? defaultT;
        const atVal = opts.at ?? 0;
        const startX = opts.x ?? Math.round(MOTION_DESIGN.safeX * s);
        const startY = opts.y ?? Math.round(330 * s);
        const totalW = opts.w ?? defaultW - startX * 2;
        const boxH = opts.h ?? Math.round(420 * s);
        const gap = Math.round(54 * s);
        const boxW = Math.floor((totalW - gap * (count - 1)) / count);
        for (let i = 0; i < count; i++) {
          const item = rawSteps[i];
          const stepObj = typeof item === "string" ? { title: item } : item;
          const stepAt = atVal + i * 0.18;
          const bx = startX + i * (boxW + gap);
          const isActive = typeof opts.activeIndex === "number" ? opts.activeIndex === i : i === count - 1;
          kit.card(ctx, {
            x: bx,
            y: startY,
            w: boxW,
            h: boxH,
            tag: stepObj.tag || `0${i + 1}`,
            title: stepObj.title,
            body: stepObj.desc,
            dark: isActive,
            accent: isActive,
            t: tVal,
            at: stepAt
          });
          if (i < count - 1) {
            const arrowP = easeOutCubic((tVal - (stepAt + 0.12)) / 0.25);
            kit.arrow(ctx, {
              x1: bx + boxW + 8 * s,
              y1: startY + boxH * 0.5,
              x2: bx + boxW + gap - 8 * s,
              y2: startY + boxH * 0.5,
              progress: arrowP,
              color: MOTION_DESIGN.colors.ink
            });
          }
        }
      },
      box(ctxOrOpts, maybeOpts) {
        const { ctx, opts } = resolveArgs(ctxOrOpts, maybeOpts);
        const tVal = opts.t ?? defaultT;
        const atVal = opts.at ?? 0;
        const prog = easeOutCubic((tVal - atVal) / 0.32);
        if (prog <= 0) return;
        ctx.save();
        ctx.globalAlpha = prog;
        ctx.fillStyle = opts.dark ? MOTION_DESIGN.colors.ink : MOTION_DESIGN.colors.white;
        ctx.fillRect(opts.x, opts.y, opts.w, opts.h);
        ctx.strokeStyle = opts.limeBorder ? MOTION_DESIGN.colors.lime : MOTION_DESIGN.colors.ink;
        ctx.lineWidth = Math.max(2, 4 * s);
        ctx.strokeRect(opts.x, opts.y, opts.w, opts.h);
        if (opts.text) {
          const wrapped = fitAndWrapText(ctx, opts.text, {
            maxWidth: opts.w - 64 * s,
            fontSize: Math.round(44 * s),
            maxLines: 2,
            fontFamily: MOTION_DESIGN.fonts.bold,
            fontWeight: 700
          });
          const totalH = wrapped.lines.length * wrapped.lineHeight;
          drawWrappedText(
            ctx,
            opts.text,
            opts.x + opts.w * 0.5,
            opts.y + (opts.h - totalH) * 0.5,
            {
              maxWidth: opts.w - 64 * s,
              fontSize: wrapped.fontSize,
              maxLines: 2,
              align: "center",
              color: opts.dark ? MOTION_DESIGN.colors.white : MOTION_DESIGN.colors.ink,
              fontFamily: MOTION_DESIGN.fonts.bold,
              fontWeight: 700
            }
          );
        }
        ctx.restore();
      },
      caption(ctxOrOpts, maybeOpts) {
        let ctx = defaultCtx;
        let opts;
        if (typeof ctxOrOpts === "string") {
          opts = { text: ctxOrOpts };
        } else if (isCanvasContext(ctxOrOpts)) {
          ctx = ctxOrOpts;
          opts = maybeOpts ?? { text: scene?.script || scene?.caption || "" };
        } else {
          opts = ctxOrOpts;
        }
        const raw = String(opts.text ?? "").trim();
        if (!raw) return;
        const barW = defaultW - 240 * s;
        const barX = 120 * s;
        const fontSize = Math.max(MOTION_DESIGN.minFontPx, Math.round(42 * s));
        const wrapped = fitAndWrapText(ctx, raw, {
          maxWidth: barW - 96 * s,
          fontSize,
          maxLines: 2,
          fontFamily: MOTION_DESIGN.fonts.medium,
          fontWeight: 500
        });
        const barH = Math.max(
          Math.round(92 * s),
          wrapped.lines.length * wrapped.lineHeight + Math.round(36 * s)
        );
        const barY = opts.y ?? defaultH - barH - Math.round(48 * s);
        ctx.save();
        ctx.fillStyle = "rgba(14, 14, 16, 0.92)";
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = MOTION_DESIGN.colors.lime;
        ctx.fillRect(barX, barY, Math.round(12 * s), barH);
        const textStartY = barY + (barH - wrapped.lines.length * wrapped.lineHeight) * 0.5;
        drawWrappedText(ctx, raw, defaultW * 0.5, textStartY, {
          maxWidth: barW - 96 * s,
          fontSize: wrapped.fontSize,
          maxLines: 2,
          align: "center",
          color: MOTION_DESIGN.colors.white,
          fontFamily: MOTION_DESIGN.fonts.medium,
          fontWeight: 500,
          highlightWord: opts.highlight,
          highlightColor: "rgba(215, 255, 58, 0.28)"
        });
        ctx.restore();
      },
      flash(ctxOrTime, tArg, atArg, wArg, hArg) {
        let ctx = defaultCtx;
        let curT = defaultT;
        let at = 0;
        let width = defaultW;
        let height = defaultH;
        if (isCanvasContext(ctxOrTime)) {
          ctx = ctxOrTime;
          curT = tArg ?? defaultT;
          at = atArg ?? 0;
          width = wArg ?? defaultW;
          height = hArg ?? defaultH;
        } else if (typeof ctxOrTime === "number") {
          curT = ctxOrTime;
          at = tArg ?? 0;
        }
        const dt = curT - at;
        if (dt < 0 || dt > 0.12) return;
        const alpha = (1 - dt / 0.12) * 0.72;
        ctx.save();
        ctx.fillStyle = `rgba(250, 250, 248, ${alpha.toFixed(3)})`;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      },
      wrapText(text, x, y, opts = {}) {
        return drawWrappedText(defaultCtx, text, x, y, {
          maxWidth: opts.maxWidth ?? defaultW - 240 * s,
          fontSize: opts.fontSize ?? Math.round(48 * s),
          minFontSize: opts.minFontSize,
          maxLines: opts.maxLines ?? 3,
          color: opts.color ?? MOTION_DESIGN.colors.ink,
          align: opts.align ?? "center",
          fontFamily: opts.fontFamily ?? MOTION_DESIGN.fonts.bold,
          fontWeight: opts.fontWeight ?? 700,
          highlightWord: opts.highlightWord
        });
      }
    };
    return kit;
  }
  return __toCommonJS(motionKit_exports);
})();
