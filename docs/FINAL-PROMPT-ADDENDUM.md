# FINAL-PROMPT 추가분 — Codex 독립 QA 결과(정확한 원인 위치)

```text
[추가 지시 — Codex 독립 QA 결과] FINAL-PROMPT에 아래 원인과 위치를 반영해. 전체 리포트는
C:\Users\letgo\Documents\youtube-ai-studio-review\REVIEW.md, 증거 파일은 같은 폴더의 shots/에 있다. 우선순위는 FINAL-PROMPT의 P0를 그대로 따른다.

[P0-2 길이·원본 — 원인 확정]
- 4초 버그의 원인: web/src/utils/demoSampleVideo.ts가 steps=120 × setTimeout(33)으로 전체 계획을 120단계에 압축한다.
  원본 영상 인자를 받지 않고(:117에서 null 전달), KEEP 구간에 업로드 영상 대신 AI쭌 아바타를 그린다.
  오디오는 원본이 아니라 장면마다 바뀌는 oscillator 톤(:48)이다.
  → 이 "데모 녹화기"를 실제 내보내기에 쓰지 마. 실제 업로드 영상을 <video>로 재생하면서 requestAnimationFrame으로 실시간 합성하고,
    원본 오디오(MediaElementSource)를 녹화하는 진짜 exporter로 교체해. 원본 길이를 16초로 고정한 값도 제거해.
- 프리뷰에만 있는 모션 장면 자막(CanvasPreviewPlayer.tsx:226 부근)을 내보내기에도 똑같이 적용해. 프리뷰와 다운로드 결과가 같아야 한다.
- 가능하면 오디오 코덱을 AAC(mp4a)로 해(현재는 Opus). 안 되면 그대로 두고 로그에 기록해.

[P0-1 정직성 — 수정 위치]
- server/argonClient.ts:192 로그의 model이 primaryModel로 기록된다. usedModel로 바꿔.
- server/routes.ts verify(:705 부근)가 detail을 일반 성공 문장으로 덮어써 실제 모델명을 잃는다. 모든 모델이 실패하면
  이미지 base64 길이 > 32만 보고 통과시키는 경로(:721~744)가 있다. 이건 "구조 검사"로 따로 표시하고 "시각 검증 통과"라고 쓰지 마.
- web AiCreateView.tsx:372~390: verify가 실패하면 catch에서 모든 프레임을 ok:true / passed:true로 만들고, 소요 시간에 380ms를 더한다. 삭제해.
  verify 결과가 passed:false여도 최종 단계가 무조건 '모든 검증 통과 완료'로 끝난다(:313 부근). 실제 결과를 표시해.
- render/codeLoop.ts가 template-fallback 응답도 실행에 성공하면 source를 argon-code로 바꿔 쓴다. 최초 출처를 보존해.
- ArgonDirectorPanel 로그 행에 실제 model을 표시해. StudioHeader의 초록 점은 /api/health(서버 응답 가능) 기준이니
  "서버 연결됨"으로만 표시하고 모델 가동처럼 보이게 하지 마.
- 데모 엔딩 영상에 박힌 "Verified by Gemini 4 Argon"(canvasPreview.ts DEFAULT_ENDING_CODE)을 지워. 검증 문구는 영상이 아니라 UI에만 둔다.
- AiCreateView는 처음부터 MOCK plan, verify, 로그 5건을 'ready/완료' 상태로 보여준다(:123~128). 첫 진입은 빈 업로드 화면이어야 한다.
  실제 업로드를 시작하면 mock 로그를 비워. 데모 버튼은 고정 시간의 가짜 '실시간' 로그 대신 "샘플 데이터" 표시를 크게 해.

[P0-3 UI — 추가 항목]
- 390px에서 문서 폭 541px(가로 넘침 151px), 본문 135px로 사용이 불가능하다. 1024px 이하에서는 내비를 자동으로 아이콘 모드로,
  600px 이하에서는 서랍 메뉴로 바꿔. 검사 기준: scrollWidth <= innerWidth.
- 대시보드 채널 수치는 정적 예시니까 카드 근처에 작은 회색 글씨로 "예시 채널 데이터"를 표시해.
  내비의 분석·커뮤니티 등은 대시보드로 연결하지 말고 "데모에서는 지원하지 않음" 토스트를 띄워.
- Tailwind font-sans가 Roboto를 덮어쓰고 있다. UI 폰트를 Roboto / Noto Sans KR로 실제 적용해(computed style로 확인).
- 디자인 비교 기준은 Codex가 확보한 실제 Studio 캡처
  C:\Users\letgo\Documents\youtube-ai-studio-review\shots\youtube-studio-live-reference.png 로 해.
  studio-shell.html은 단독으로 열면 스타일이 복원되지 않아서 수치(CSS 값) 참고용으로만 쓴다.

[P0-4 영상 — 추가 항목]
- render/codeLoop.ts:63은 코드 생성·검사를 960×540으로 요청하는데, 프리뷰와 내보내기는 1920×1080을 쓴다.
  고정 px 글꼴이 그대로라 출력 글자가 절반 크기가 된다(본문 14.7px, 장식 10.7px까지 내려감).
  생성·검사·출력을 하나의 기준 해상도(1920×1080 논리 좌표, 출력 시 스케일)로 통일해.
- 엔딩 배지 텍스트가 배지 밖으로 넘친다(고정 배지 폭 + fillText). kit가 measureText로 폭을 계산하게 해.
- 장면당 최소 시간: 개념 한 스텝 2~4초, 엔딩은 최소 2.5초. 0.5~0.8초짜리 장면은 금지.
- "핵심 배경 설명이 누락되어 있습니다" 같은 제작 진단 문구가 시청자용 장면에 들어가지 않게 해. 장면 script는 시청자에게 하는 설명이어야 한다.
- 구독 요청 엔딩은 실제 콘텐츠 장면이 하나 이상 있을 때만 넣어.

[재검수 기준 — P0 배포 후 1회]
출력 길이가 장면 합계 ±0.3초 / KEEP 구간에 업로드 영상 픽셀과 원본 음성 / 프리뷰와 다운로드 자막 일치 /
verify 503 주입 시 성공 배지 없음 / 390px에서 가로 넘침 0 / 최소 글자 34px(1080p 기준) / 로그·배지에 실제 응답 모델.
```
