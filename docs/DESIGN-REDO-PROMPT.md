# AGY 디자인 재작업 지시 (13:00~)

```text
[디자인 재작업] 기능은 동작하지만 화면과 결과 영상 품질이 시연 수준이 아니다. 아래 순서로 고친다.
새 기능 추가는 하지 않는다. 14:30 기능 동결은 그대로 유지하고, 각 단계가 끝날 때마다 커밋한다.

━━ 0. 정직성 (5분, 먼저) ━━
VERIFY-REPORT A1을 보면 gemini-4-argon이 이 키에서 429(limit: 0)로 실패하고, 실제 결과는 전부 gemini-3-flash-preview / 3.5-flash가 만들었다.
- 이 상태를 PASS로 적지 마. VERIFY-REPORT A1을 "FAIL — Argon 쿼터 없음, 폴백 모델로 동작"으로 고쳐.
- 모든 로그, 배지, 헤더에 실제로 응답한 모델명을 표시해. 헤더의 "gemini-4-argon" 알약은 실제 응답 모델로 바꿔.
- Argon 쿼터 문제는 사용자가 행사 측에 키·프로젝트를 받아서 해결한다. 키가 바뀌면 env만 갱신하면 되게 해 둬.

━━ 1. 웹 UI — "제미나이 풍" 걷어내고 YouTube Studio 그대로 ━━
제거: 보라·파랑 그라데이션, 글로우·그림자 번짐, ✨ 이모지, 알약 배지 남발,
"GEMINI 4 ARGON · AUTONOMOUS VERIFICATION LOOP" 같은 영어 대문자 라벨, 메인 화면의 기술 용어
(신뢰도 < 0.7, Canvas 2D, Worker 샌드박스, /api/...). 기술 증거는 접을 수 있는 "AI 작업 기록" 패널 안으로만 옮긴다.
따를 것: reference/studio/studio-shell.html의 실제 CSS 값(배경, 카드, 테두리, 글자색, Roboto/YouTube Sans, 14px 본문, 간격, 둥근 모서리).
  YouTube Studio에는 그라데이션이 없다. 평평한 다크 카드, 얇은 테두리, 파란 링크(#3ea6ff), 흰 텍스트 버튼이 전부다.
- 왼쪽 내비 "AI 제작"은 다른 메뉴와 똑같은 아이콘+한 줄 라벨로 만들고, 좁은 폭에서 글자가 세로로 쌓이지 않게 고쳐. NEW 표시는 Studio의 작은 회색 텍스트 배지로.
- 대시보드 프로모 카드는 Studio 기본 카드 하나로 만든다: 제목 한 줄 "촬영만 하면 편집은 AI가", 설명 한 줄, 파란 텍스트 버튼 [AI로 편집하기].
- AI 제작 화면은 YouTube Studio의 "동영상 업로드" 대화상자를 그대로 본떠라:
  상단 스텝퍼(업로드 → AI 편집 → 검토 → 내보내기), 왼쪽 큰 미리보기 플레이어, 오른쪽 세부 정보 패널,
  하단 [뒤로] [다음] 버튼, 진행률 막대와 "처리 중… 약 40초 남음" 같은 Studio식 진행 문구.
- 문구는 초보자 한국어로 바꿔: "NG 컷 2곳을 찾았어요", "빠진 설명 1곳에 장면을 만들었어요", "AI가 화면을 다시 확인했어요 ✓".
- 1440x900과 1280x800에서 가로 넘침(프로모 카드 오른쪽 잘림)이 없게 해.
도구: frontend-design 스킬. 완료 후 Aside(실패하면 playwright-windows)로 실제 Studio 화면과 나란히 스크린샷을 찍어 비교해.

━━ 2. 결과 영상 — 디자인 규칙을 "코드로 강제" ━━
지금 결과 영상의 문제: 출력 4초(입력 12초), 왼쪽 위에 몰린 작은 글자, 화면 대부분이 빈 공간, 3초 넘게 정지,
라임 하이라이트가 단어 중간에서 잘림, "ORIGINAL KEEP · 0.7s" 같은 디버그 텍스트가 영상에 박혀 있음.
해결 원칙: Argon이 fillText를 마음대로 쓰게 두지 말고, 규칙이 박힌 그리기 키트를 Worker에 넣어 Argon은 키트를 호출만 하게 한다.

2-1. 폰트: C:\Users\letgo\.claude\skills\aijjun-video-edit\kit_v2\fonts의 Pretendard(Regular/SemiBold/Bold/ExtraBold/Black)와
     JetBrains Mono(500/700)를 web/public/fonts/로 복사(둘 다 OFL). Worker에서 FontFace로 로드(self.fonts.add)하고, 로드가 끝난 뒤 렌더를 시작해.
2-2. 토큰(aijjun-video-edit reference/STYLE_V2.md 기준, 1920x1080 기준이며 해상도에 비례 스케일):
     바탕 #FAFAF8, 먹 #0E0E10, 회색 #8A8A90, 강조는 라임 #D7FF3A 하나뿐, 다크 #0B0B0C.
     본문 Pretendard 600~900, 자간 -0.03~-0.06em. 라벨은 JetBrains Mono 대문자, 자간 +0.14em, 22~26px.
     슬램 문장 96~140px w800, 자간 -0.045em, 행간 1.16. 풀블리드 큰 글자 160~220px w900, 자간 -0.06em, 행간 1.02.
     카드: 흰색, radius 26, 그림자 0 40px 90px rgba(14,14,16,.13). 안전 여백: 좌우 120px, 상하 96px. 기본은 가운데 정렬.
     자막: Pretendard 600, 38px, 하단 52px, 최대 폭 1200px. 얼굴 위에서는 흰 글자+그림자, 밝은 배경 위에서는 먹색.
     라임 하이라이트는 글자 아래 40% 높이로, 단어 경계를 정확히 측정(measureText)해서 그려.
2-3. 키트 API(Worker 전역 kit): kit.bg(theme), kit.slam(words[], t, opts) — 단어마다 0.12s 간격으로 박히는 키네틱,
     kit.full(text, t, theme:"dark"|"lime"), kit.card(x,y,w,h), kit.chip(label, text), kit.numbered(items[], t), kit.chat(messages[], t),
     kit.arrow/box/flow(다이어그램), kit.caption(text), kit.flash(t). 모든 텍스트는 키트가 자동 줄바꿈(한 줄 15자 안팎, 최대 3줄, word-break keep-all)과
     최소 크기를 보장한다. 영역을 넘치면 크기를 줄이고, 그래도 넘치면 문장을 자른다.
2-4. scene-code 프롬프트: "kit 함수만으로 장면을 구성하고, 다이어그램이 필요할 때만 ctx를 직접 쓴다"로 바꿔.
     STYLE_V2의 화면 규칙을 넣어: 한 화면에 한 생각, 1.5~3초마다 변화, 4초 넘는 정지 금지, 전환은 하드 컷 + 흰 플래시, 같은 장면 유형 연속 금지.
     장면 유형은 에토스(chip) → 파토스(chat/slam) → 로고스(numbered/다이어그램) → 결론(full) 흐름에서 고르게 해.
2-5. 프로그램 검사(verify 전에 Worker에서): 가장 작은 글자가 해상도 기준 34px 이상인지, 텍스트 박스가 안전 여백 안에 있는지,
     화면 면적 대비 콘텐츠 비율이 25% 이상인지, 0.5초 간격 프레임 차이로 4초 넘는 정지가 없는지 확인. 실패하면 fix-code에 사유를 넘겨.
2-6. 디버그 오버레이("ORIGINAL KEEP …", 시간 표시)는 미리보기에서만 보이고 내보내기에는 절대 들어가지 않게 해.
2-7. 길이: 원본 keep 구간은 발화가 있는 부분을 최소 70% 이상 남겨. 모션 장면은 장면당 3~6초.
     출력 길이 ≈ keep 합계 + 모션 장면 합계가 되는지 검증하고 로그에 남겨.

━━ 3. 확인 ━━
- 데모 입력은 테스트 패턴이 아니라 사람이 말하는 실제 영상이어야 한다. 사용자가 docs/demo/real-take.mp4를 넣으면 그걸로 E2E 1회를 돌려.
  아직 없으면 기존 샘플로 1회 돌리고, 결과 영상을 1초 간격으로 캡처해 docs/demo/frames/에 저장해.
- 재배포한 뒤 3줄로 보고해: 실제 응답 모델, 출력 길이와 오디오 유무, 규칙 검사 통과율.
- 14:30이 되면 멈추고 docs/VERIFY-PROMPT.md를 다시 실행해.
```
