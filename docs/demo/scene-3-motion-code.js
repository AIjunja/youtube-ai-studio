function draw(ctx, t, w, h, scene, kit) {
  ctx.save();

  // 1. 편의 헬퍼 & 이징(Easing) 함수
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const easeOutExpo = (x) => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x));
  const easeOutBack = (x) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  };

  const dur = (scene && scene.durationSec) || 3.5;
  const progress = clamp(t / dur, 0, 1);

  // 2. 배경 렌더링: 오프화이트 (#FAFAF8) + 미세 테크 그리드 패턴
  ctx.fillStyle = '#FAFAF8';
  ctx.fillRect(0, 0, w, h);

  // 섬세한 도트/그리드 모션 가이드
  ctx.strokeStyle = 'rgba(14, 14, 16, 0.04)';
  ctx.lineWidth = 1;
  const gridSize = 64;
  for (let gx = 120; gx <= w - 120; gx += gridSize) {
    ctx.beginPath();
    ctx.moveTo(gx, 96);
    ctx.lineTo(gx, h - 96);
    ctx.stroke();
  }
  for (let gy = 96; gy <= h - 96; gy += gridSize) {
    ctx.beginPath();
    ctx.moveTo(120, gy);
    ctx.lineTo(w - 120, gy);
    ctx.stroke();
  }

  // 3. 상단 카테고리 칩 바 (t: 0.1s ~ 0.5s)
  const topBarP = clamp((t - 0.1) / 0.4, 0, 1);
  if (topBarP > 0) {
    const easeTop = easeOutExpo(topBarP);
    ctx.save();
    ctx.translate(140, 120 + (1 - easeTop) * -20);
    ctx.globalAlpha = easeTop;

    // 카테고리 칩 (라임 포인트)
    const chipW = 280;
    const chipH = 46;
    ctx.fillStyle = '#D7FF3A';
    ctx.beginPath();
    ctx.roundRect(0, 0, chipW, chipH, 8);
    ctx.fill();
    ctx.strokeStyle = '#0E0E10';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#0E0E10';
    ctx.font = 'bold 34px "GmarketSansBold", "Pretendard", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('AI 현장 브이로그', 16, chipH / 2 + 1);

    // 우측 메타 라벨
    ctx.fillStyle = '#8A8A90';
    ctx.font = '500 34px "Pretendard", sans-serif';
    ctx.fillText('SPECIAL REPORT // GOOGLE CAMPUS', chipW + 28, chipH / 2 + 1);
    ctx.restore();
  }

  // 4. 중앙 메인 타이틀 히어로 카드 (t: 0.3s ~ 0.9s)
  const cardP = clamp((t - 0.3) / 0.6, 0, 1);
  if (cardP > 0) {
    const easeCard = easeOutBack(cardP);
    const cardX = 140;
    const cardY = 200;
    const cardW = 1640;
    const cardH = 500;

    ctx.save();
    ctx.translate(cardX, cardY + (1 - clamp(cardP * 1.2, 0, 1)) * 40);
    ctx.globalAlpha = clamp(cardP * 1.5, 0, 1);

    // 다크 메인 컨테이너
    ctx.fillStyle = '#0E0E10';
    ctx.beginPath();
    ctx.roundRect(0, 0, cardW, cardH, 24);
    ctx.fill();

    // 카드 내부 라임 액센트 데코 라인
    ctx.strokeStyle = '#D7FF3A';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(50, 60);
    ctx.lineTo(50, cardH - 60);
    ctx.stroke();

    // 대헤드라인 애니메이션 (t: 0.5s ~ 1.0s)
    const textP = clamp((t - 0.5) / 0.5, 0, 1);
    const textEase = easeOutExpo(textP);

    ctx.save();
    ctx.translate(90, 80);

    // 보조 레이블
    ctx.fillStyle = '#8A8A90';
    ctx.font = '500 36px "GmarketSansMedium", "Pretendard", sans-serif';
    ctx.fillText('CAMPUS VISIT & SPECIAL SESSION', 0, 40);

    // 메인 헤드라인
    ctx.fillStyle = '#FAFAF8';
    ctx.font = 'bold 74px "GmarketSansBold", "Pretendard", sans-serif';
    ctx.fillText('구글 스타트업 캠퍼스', 0, 140);

    // 라임 하이라이트 박스 (키워드 강조)
    const hlW = 680 * textEase;
    if (hlW > 0) {
      ctx.fillStyle = '#D7FF3A';
      ctx.fillRect(0, 160, hlW, 8);
    }

    // 서브헤드라인: 구글 딥마인드와 어텐션
    ctx.fillStyle = '#D7FF3A';
    ctx.font = 'bold 58px "GmarketSansBold", "Pretendard", sans-serif';
    ctx.fillText('Google DeepMind × 어텐션(Attention)', 0, 246);

    // 상세 설명 바디 텍스트
    ctx.fillStyle = 'rgba(250, 250, 248, 0.75)';
    ctx.font = '500 36px "Pretendard", sans-serif';
    ctx.fillText('글로벌 프론티어 AI 연구진 및 혁신 스타트업이 모이는 특별 행사 현장 취재', 0, 320);

    ctx.restore();
    ctx.restore();
  }

  // 5. 하단 3단 스태거 키워드 뱃지 카드들 (t: 0.8s ~ 1.5s)
  const items = [
    { num: '01', title: '구글 스타트업 캠퍼스', desc: '서울 삼성 테크 허브' },
    { num: '02', title: 'Google DeepMind', desc: '최신 파운데이션 모델 공유' },
    { num: '03', title: '어텐션(Attention)', desc: 'AI 혁신 기업 특별 세션' }
  ];

  const colW = (1640 - 48) / 3;
  const startY = 730;

  items.forEach((item, idx) => {
    const itemDelay = 0.8 + idx * 0.15;
    const itemP = clamp((t - itemDelay) / 0.5, 0, 1);
    if (itemP <= 0) return;

    const easeItem = easeOutExpo(itemP);
    const itemX = 140 + idx * (colW + 24);
    const itemY = startY + (1 - easeItem) * 30;

    ctx.save();
    ctx.translate(itemX, itemY);
    ctx.globalAlpha = easeItem;

    // 화이트 보더 카드
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(0, 0, colW, 160, 16);
    ctx.fill();

    ctx.strokeStyle = '#0E0E10';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 넘버 라임 배지
    ctx.fillStyle = '#D7FF3A';
    ctx.beginPath();
    ctx.roundRect(24, 24, 52, 38, 6);
    ctx.fill();
    ctx.strokeStyle = '#0E0E10';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#0E0E10';
    ctx.font = 'bold 34px "GmarketSansBold", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.num, 33, 43);

    // 카드 타이틀
    ctx.fillStyle = '#0E0E10';
    ctx.font = 'bold 36px "GmarketSansBold", "Pretendard", sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(item.title, 90, 52);

    // 카드 디스크립션
    ctx.fillStyle = '#8A8A90';
    ctx.font = '500 34px "Pretendard", sans-serif';
    ctx.fillText(item.desc, 24, 118);

    ctx.restore();
  });

  // 6. 하단 안전 자막 바 (t: 0.4s ~ 끝)
  const capP = clamp((t - 0.4) / 0.4, 0, 1);
  if (capP > 0) {
    const easeCap = easeOutExpo(capP);
    ctx.save();
    ctx.translate(w / 2, 984 - (1 - easeCap) * 15);
    ctx.globalAlpha = easeCap;

    const captionText = (scene && scene.caption) || '구글 스타트업 캠퍼스 현장 방문';
    ctx.font = 'bold 38px "GmarketSansBold", "Pretendard", sans-serif';
    const textMetrics = ctx.measureText(captionText);
    const boxW = textMetrics.width + 80;
    const boxH = 64;

    ctx.fillStyle = '#0E0E10';
    ctx.beginPath();
    ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, 32);
    ctx.fill();

    // 라임 테두리 하이라이트
    ctx.strokeStyle = '#D7FF3A';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = '#FAFAF8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(captionText, 0, 0);

    ctx.restore();
  }

  // kit 헬퍼가 제공된 경우 테마 및 캡션 동기화 보강
  if (kit && typeof kit.setTheme === 'function') {
    // kit.setTheme removed
  }

  ctx.restore();
}