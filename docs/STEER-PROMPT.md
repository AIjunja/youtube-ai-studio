```text
[스티어링] 지금 진행 중인 검증(task-275, 3회 연속 E2E)은 중단해. 최종 검증은 14:30에 docs/VERIFY-PROMPT.md로 다시 한다.

0) 중단 보고 (3줄)
- B1~B8 중 지금까지 통과·실패 항목
- B4: 결과 영상에 오디오 트랙이 있는지
- 실제로 응답한 모델명(usedModel)과 argon-code로 성공한 장면 개수
진행 중인 Cloud Run 배포가 있으면 그것만 끝까지 기다리고 URL과 revision을 알려줘. 미커밋 변경이 있으면 먼저 커밋해.
보고한 뒤 승인을 기다리지 말고 아래를 순서대로 진행해. 13:40 규칙과 14:30 기능 동결은 그대로 유지한다.

[P0-1 정직성 — 가장 먼저]
a) AiCreateView.tsx: /api/plan, scene-code, verify가 실패했을 때 mock 데이터로 몰래 대체하면서 status "ok"나 "Argon 분석 완료"로 기록하는 경로를 모두 없애.
   실패는 status "error"와 실제 오류로 기록해. 샘플은 "Try with demo plan" 버튼으로만 들어가고, 그때는 화면에 "DEMO DATA" 배지를 크게 표시해.
b) argonClient.ts의 usedModel을 응답, 모델 로그, 장면 배지까지 전달해(예: "argon" / "fallback: gemini-3.5-flash").
   Argon이 아닌 모델의 결과를 Argon 결과라고 표시하지 마. 배포 서버에서 gemini-4-argon 실제 호출이 성공하는지 1회 확인해서 보고해.

[P0-2 원본 음성]
web/src/render/compositor.ts의 내보내기에 원본 오디오를 넣어(지금은 demoSampleVideo에만 오디오 처리가 있음).
<video> → MediaElementAudioSourceNode → MediaStreamAudioDestinationNode → 캔버스 captureStream과 트랙을 합쳐 MediaRecorder로 녹화.
컷 구간은 오디오도 같이 건너뛰고, 모션 장면 동안에는 원본 오디오를 음소거. AudioContext는 사용자 클릭 때 resume.
결과 파일에 오디오 트랙이 있는지 검증해서 로그에 남겨.

[P0-3 편집 노하우 플레이북]
aijjun-video-edit와 aijjun-concept-motion 스킬을 로드해서 아래만 뽑아 server/prompts/playbook.md(2페이지 이내)로 정리해:
- 컷 판단: NG, "다시", 박수, 실패·중복 테이크, 대기·무음, 단어 경계에서 자르기와 앞뒤 여유
- 장면 설계: 에토스·파토스·로고스, 훅 → 과정·근거 → 결과
- 모션 문법: 한 스텝에 한 동작, 단어 단위 키네틱 슬램, 풀블리드 펀치, 재현 UI(채팅창·문서·목록)
- 효과음·BGM 타이밍과 덕킹 규칙
이 플레이북을 plan, scene-code, verify 시스템 프롬프트에 넣고, scene-code 예시 draw() 하나를 이 문법으로 다시 써.
주의: AI쭌 브랜드 프로필, 프로필 쓰기, "합성 음성 금지" 규칙은 이 제품에 적용하지 않는다.
setup_check.py, new_project.py 같은 스크립트는 실행하지 말고 읽기만 해.

→ P0를 끝내면 재배포하고, 배포 URL에서 실제 영상으로 E2E를 1회만 돌려 3줄로 보고해(usedModel, argon-code 장면 수, 오디오 유무).

[P1 효과음·BGM]
shared/contract.ts의 ScenePlan에 sfx:{atSec,type:"whoosh"|"pop"|"click"|"impact"|"rise"}[]와 bgmMood:string 추가.
plan 프롬프트가 플레이북 타이밍 규칙으로 sfx를 정하게 해. 효과음과 BGM은 브라우저 WebAudio로 직접 합성해(외부 음원 없음 → 라이선스 문제 없음).
BGM은 -24dB 정도로 깔고 말소리·내레이션 구간에서는 자동으로 볼륨을 낮춰(덕킹). ASSETS.md에 "모든 오디오는 런타임 합성"이라고 기록해.

[P1 AI 내레이션 (선택 기능)]
gemini-api-dev 스킬로 현재 Gemini TTS API와 모델 ID를 확인하고 /api/tts를 추가해(env TTS_MODEL).
Director 패널에 "AI 내레이션" 토글을 둬(기본 ON). motion·ending 장면 script를 음성으로 만들어 장면 시작에 맞춰 믹싱해.
실패하면 자막만으로 진행하고, 실패는 로그에 그대로 남겨. 내보내기가 깨지면 안 된다.

[P2 시간 남으면]
draw() 안에서 벡터 일러스트(아이콘, 도형, 다이어그램)를 그리게 해. 내보내기 기본 720p(1080p 옵션).
FPS가 24 아래로 떨어지면 경고하고, 탭이 숨겨지면 녹화를 일시정지하고 안내.

[진행 규칙]
- 이 스레드 하나에서만 수정하고 배포한다. 머지 전에 REA로 변경 범위와 shared/contract.ts 위반 여부를 점검해.
- 브라우저 확인은 Aside를 쓰고, 안 되면 playwright-windows를 써.
- 반복 E2E는 하지 마(1회만). 14:30이 되면 하던 걸 멈추고 docs/VERIFY-PROMPT.md를 실행해.
```
