function draw(ctx, t, w, h, scene, kit) {
  ctx.save();

  var dur = (scene && scene.durationSec) ? scene.durationSec : 4;
  var clamp = function(v, min, max) { return Math.max(min, Math.min(max, v)); };
  var easeOutCubic = function(x) { return 1 - Math.pow(1 - clamp(x, 0, 1), 3); };
  var easeOutBack = function(x) {
    var c1 = 1.70158;
    var c3 = c1 + 1;
    var p = clamp(x, 0, 1);
    return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
  };

  if (kit && kit.setTheme) {
    kit.setTheme('dark');
  }

  // 1. Background: Deep Charcoal (#0B0B0C) + Subtle Grid
  ctx.fillStyle = '#0B0B0C';
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  var gridSize = 80;
  for (var gx = 120; gx <= w - 120; gx += gridSize) {
    ctx.beginPath();
    ctx.moveTo(gx, 96);
    ctx.lineTo(gx, h - 96);
    ctx.stroke();
  }
  for (var gy = 96; gy <= h - 96; gy += gridSize) {
    ctx.beginPath();
    ctx.moveTo(120, gy);
    ctx.lineTo(w - 120, gy);
    ctx.stroke();
  }
  ctx.restore();

  // Safe area frame accent
  var frameProg = easeOutCubic(t / 0.5);
  ctx.save();
  ctx.strokeStyle = 'rgba(215, 255, 58, 0.22)';
  ctx.lineWidth = 2;
  ctx.strokeRect(120, 96, (w - 240) * frameProg, h - 192);
  ctx.restore();

  // 2. Top Header Chip & Status Bar
  var topProg = easeOutCubic((t - 0.05) / 0.45);
  ctx.save();
  ctx.globalAlpha = topProg;
  if (kit && kit.chip) {
    kit.chip('NEXT EPISODE · 본편 프리뷰', 156, 132, true);
  } else {
    ctx.fillStyle = '#D7FF3A';
    ctx.beginPath();
    ctx.roundRect(156, 132, 420, 56, 28);
    ctx.fill();
    ctx.fillStyle = '#0E0E10';
    ctx.font = 'bold 34px "GmarketSansBold", "Pretendard", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('NEXT EPISODE · 본편 프리뷰', 184, 160);
  }

  // Right top live indicator
  ctx.fillStyle = '#D7FF3A';
  var pulse = 0.5 + 0.5 * Math.sin(t * 6);
  ctx.beginPath();
  ctx.arc(w - 410, 160, 10 + pulse * 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#FAFAF8';
  ctx.font = '600 34px "GmarketSansMedium", "Pretendard", sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('ON-SITE REPORT', w - 156, 160);
  ctx.restore();

  // 3. Main Headline + Kinetic Slam / Lime Highlight Bar
  var headProg = easeOutBack((t - 0.15) / 0.55);
  var captionText = (scene && scene.caption) ? scene.caption : '구글 딥마인드 현장으로 출발!';

  ctx.save();
  var headY = 250 + (1 - headProg) * 35;
  ctx.globalAlpha = clamp((t - 0.15) / 0.35, 0, 1);

  // Lime underline accent bar behind key phrase
  var barProg = easeOutCubic((t - 0.35) / 0.5);
  ctx.fillStyle = '#D7FF3A';
  ctx.fillRect(156, headY + 54, 620 * barProg, 24);

  if (kit && kit.slam) {
    kit.slam(captionText, 156, headY, headProg, {
      size: 72,
      color: '#FAFAF8',
      accent: '#D7FF3A'
    });
  } else {
    ctx.font = 'bold 72px "GmarketSansBold", "Pretendard", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#FAFAF8';
    ctx.fillText(captionText, 156, headY);
  }

  // Sub-headline (script summary)
  var subProg = easeOutCubic((t - 0.35) / 0.5);
  ctx.globalAlpha = subProg;
  ctx.fillStyle = '#8A8A90';
  ctx.font = '500 38px "GmarketSansMedium", "Pretendard", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('혁신적인 AI 인사이트와 생생한 현장 이야기, 지금 바로 이어집니다', 156, 355 + (1 - subProg) * 18);
  ctx.restore();

  // 4. Three Visual Keyword Summary Cards (Staggered Entrance)
  var visuals = (scene && scene.visuals && scene.visuals.length >= 3)
    ? scene.visuals
    : ['구글 스타트업 캠퍼스', '딥마인드 X 어텐션', '현장 리뷰 커밍순'];

  var cardSubtitles = [
    'LOCATION · 서울 대치동 현장',
    'SPECIAL SESSION · AI 기술 토크',
    'COMING UP · 본편 핵심 요약'
  ];

  var cardStartX = 156;
  var cardY = 445;
  var cardW = 504;
  var cardH = 310;
  var cardGap = 48;

  for (var i = 0; i < 3; i++) {
    var delay = 0.45 + i * 0.16;
    var cProg = easeOutBack((t - delay) / 0.55);
    var alphaProg = clamp((t - delay) / 0.35, 0, 1);
    if (alphaProg <= 0) continue;

    var cx = cardStartX + i * (cardW + cardGap);
    var cy = cardY + (1 - cProg) * 45;
    var isHighlight = (i === 2);

    ctx.save();
    ctx.globalAlpha = alphaProg;

    // Card Background & Border
    ctx.fillStyle = isHighlight ? '#D7FF3A' : '#FAFAF8';
    ctx.strokeStyle = isHighlight ? '#D7FF3A' : '#0E0E10';
    ctx.lineWidth = 4;

    ctx.beginPath();
    ctx.roundRect(cx, cy, cardW, cardH, 24);
    ctx.fill();
    ctx.stroke();

    // Number Badge inside Card
    var badgeX = cx + 36;
    var badgeY = cy + 36;
    ctx.fillStyle = isHighlight ? '#0E0E10' : '#D7FF3A';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, 92, 54, 14);
    ctx.fill();

    ctx.fillStyle = isHighlight ? '#D7FF3A' : '#0E0E10';
    ctx.font = 'bold 34px "GmarketSansBold", "Pretendard", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('0' + (i + 1), badgeX + 46, badgeY + 27);

    // Top-right arrow icon on each card
    ctx.strokeStyle = '#0E0E10';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx + cardW - 68, badgeY + 38);
    ctx.lineTo(cx + cardW - 40, badgeY + 14);
    ctx.moveTo(cx + cardW - 62, badgeY + 14);
    ctx.lineTo(cx + cardW - 40, badgeY + 14);
    ctx.lineTo(cx + cardW - 40, badgeY + 36);
    ctx.stroke();

    // Card Main Title
    ctx.fillStyle = '#0E0E10';
    ctx.font = 'bold 44px "GmarketSansBold", "Pretendard", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(visuals[i], cx + 36, cy + 125);

    // Divider line
    ctx.strokeStyle = isHighlight ? 'rgba(14, 14, 16, 0.25)' : 'rgba(14, 14, 16, 0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + 36, cy + 205);
    ctx.lineTo(cx + cardW - 36, cy + 205);
    ctx.stroke();

    // Card Subtitle
    ctx.fillStyle = isHighlight ? '#0E0E10' : '#8A8A90';
    ctx.font = '600 34px "GmarketSansMedium", "Pretendard", sans-serif';
    ctx.fillText(cardSubtitles[i], cx + 36, cy + 230);

    ctx.restore();

    // Animated connector arrow between cards
    if (i < 2) {
      var arrowProg = easeOutCubic((t - (delay + 0.25)) / 0.35);
      if (arrowProg > 0) {
        var ax1 = cx + cardW + 8;
        var ax2 = cx + cardW + cardGap - 8;
        var ay = cardY + cardH / 2;
        if (kit && kit.arrow) {
          kit.arrow(ax1, ay, ax2, ay, arrowProg);
        } else {
          ctx.save();
          ctx.strokeStyle = '#D7FF3A';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(ax1, ay);
          ctx.lineTo(ax1 + (ax2 - ax1) * arrowProg, ay);
          ctx.stroke();
          ctx.restore();
        }
      }
    }
  }

  // 5. Bottom CTA Banner ("이어지는 본편에서 함께 확인해 보시죠!")
  var ctaProg = easeOutCubic((t - 1.0) / 0.55);
  if (ctaProg > 0) {
    ctx.save();
    ctx.globalAlpha = ctaProg;
    var ctaY = 815 + (1 - ctaProg) * 25;
    var ctaX = 156;
    var ctaW = w - 312;
    var ctaH = 128;

    // Dark elevated bar with lime border
    ctx.fillStyle = '#16161A';
    ctx.strokeStyle = '#D7FF3A';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(ctaX, ctaY, ctaW, ctaH, 22);
    ctx.fill();
    ctx.stroke();

    // Left Play Button Badge
    var playX = ctaX + 72;
    var playY = ctaY + ctaH / 2;
    ctx.fillStyle = '#D7FF3A';
    ctx.beginPath();
    ctx.arc(playX, playY, 36, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0E0E10';
    ctx.beginPath();
    ctx.moveTo(playX - 10, playY - 16);
    ctx.lineTo(playX + 18, playY);
    ctx.lineTo(playX - 10, playY + 16);
    ctx.closePath();
    ctx.fill();

    // Narrative Script CTA Text
    ctx.fillStyle = '#FAFAF8';
    ctx.font = 'bold 40px "GmarketSansBold", "Pretendard", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('이어지는 본편에서 생생한 AI 현장을 함께 확인해 보시죠!', ctaX + 134, playY);

    // Right animated "STAY TUNED" pill
    var pillShift = Math.sin(t * 5) * 6;
    var pillW = 260;
    var pillH = 68;
    var pillX = ctaX + ctaW - pillW - 32 + pillShift;
    var pillY = playY - pillH / 2;

    ctx.fillStyle = '#D7FF3A';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 34);
    ctx.fill();

    ctx.fillStyle = '#0E0E10';
    ctx.font = 'bold 34px "GmarketSansBold", "Pretendard", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('본편 바로가기 →', pillX + pillW / 2, playY);

    ctx.restore();
  }

  // Subtle transition flash at very beginning
  if (t < 0.25 && kit && kit.flash) {
    kit.flash(1 - t / 0.25);
  }

  ctx.restore();
}