# AGY 다음 지시 (13:00, 머지 직후) — Claude 레포 리뷰 + Codex 점검 결과 반영

```text
지금 main에 머지된 상태를 Claude가 읽고 리뷰했고, Codex의 스킬 점검 보고서
(C:\Users\letgo\Documents\youtube-ai-studio-preflight-20261016\REPORT.md, AGY_HANDOFF.md)도 반영했다.
먼저 현재 미커밋 변경(argonClient, routes, codeLoop, sandboxWorker, demoSampleVideo)을 정리해서 커밋하고, 아래를 순서대로 진행해.
13:40 규칙과 14:30 기능 동결은 그대로 유지한다.

[P0-1 정직성 — 데모 신뢰도 문제, 가장 먼저]
리뷰에서 심각한 문제 2개를 발견했다. 심사에서 걸리면 치명적이다.
a) web/src/components/AiCreateView.tsx: /api/plan이 실패하면 MOCK_SCENE_PLAN으로 바꿔치기하면서
   로그에는 status "ok", model "gemini-4-argon", "분석 완료"로 기록한다. 실제로는 Argon이 분석하지 않은 가짜 결과다.
   → 실패하면 status "error"와 실제 오류를 기록하고, 화면에 "DEMO DATA(샘플)" 배지를 크게 표시해.
     샘플 모드는 "Try with demo plan" 버튼으로만 들어가게 하고, 실제 업로드 흐름에서 자동으로 대체하지 마.
     scene-code와 verify 단계의 mock 대체도 같은 원칙으로 점검해.
b) server/argonClient.ts: ARGON_MODEL이 실패하면 gemini-3.5-flash 등으로 조용히 넘어간다.
   → 폴백은 유지해도 되지만, 응답과 모델 로그에 "실제 응답한 모델명"을 넣고, UI 배지에도 표시해
     (예: "argon" / "fallback: gemini-3.5-flash"). Argon이 아닌 결과를 Argon 결과라고 표시하지 마.
   → 지금 배포 서버에서 gemini-4-argon 실제 호출이 성공하는지 1회 확인하고 결과를 보고해.

[P0-2 render — 원본 음성]
compositor.ts의 내보내기에 오디오가 전혀 없다(AudioContext는 demoSampleVideo에만 있음). 지금 나오는 완성 영상은 무음이다.
- 원본 <video> → MediaElementAudioSourceNode → MediaStreamAudioDestinationNode → 캔버스 captureStream과 트랙을 합쳐 MediaRecorder로 녹화.
- keep 구간을 건너뛸 때 오디오도 같이 건너뛰고, 모션 장면 동안에는 원본 오디오를 음소거.
- AudioContext는 사용자 클릭 시 resume. 결과 파일에 오디오 트랙이 있는지 검증하고 로그에 남겨.

[P0-3 ai-api — 편집 노하우 플레이북 (Codex 권장 스킬 사용)]
`aijjun-video-edit`와 `aijjun-concept-motion` 스킬을 로드해서 아래 내용만 뽑아 server/prompts/playbook.md(2페이지 이내)로 만들어:
- 컷 판단: NG, "다시", 박수, 실패·중복 테이크, 대기·무음, 컷 경계 규칙(단어 경계에서 자르기, 앞뒤 여유)
- 장면 설계: 에토스·파토스·로고스, 훅 → 과정·근거 → 결과
- v2 모션 문법: 한 스텝에 한 동작, 단어 단위 키네틱 슬램, 풀블리드 펀치 프레임, 재현 UI(채팅창·문서·목록)
- 효과음·BGM 타이밍 규칙과 덕킹 규칙
이 플레이북을 plan, scene-code, verify 시스템 프롬프트에 넣고, scene-code 예시 draw() 하나를 이 문법으로 다시 써.
Codex 주의사항: aijjun-video-edit의 AI쭌 브랜드 프로필, 프로필 쓰기, "합성 음성 금지" 규칙은 이 제품에 적용하지 않는다.
setup_check.py와 new_project.py는 실행하지 마(설치·덮어쓰기 부작용 있음). 규칙은 읽기만 해서 옮긴다.

[P1 render + ai-api — 효과음·BGM]
- shared/contract.ts의 ScenePlan에 sfx: {atSec:number, type:"whoosh"|"pop"|"click"|"impact"|"rise"}[]와 bgmMood:string 추가(총괄이 수정).
- plan 프롬프트가 플레이북 타이밍 규칙에 따라 sfx를 정하게 해.
- 효과음과 BGM은 브라우저 WebAudio로 직접 합성해(오실레이터·노이즈 기반). 외부 음원을 쓰지 않으니 라이선스 문제가 없다.
  aijjun-video-studio의 SFX·BGM 합성 아이디어를 참고하고, ASSETS.md에 "모든 오디오는 런타임 합성"이라고 기록해.
- BGM은 -24dB 정도로 깔고, 말소리나 내레이션 구간에서는 자동으로 볼륨을 낮춰(덕킹).

[P1 ai-api + render — AI 내레이션 (선택 기능)]
- gemini-api-dev 스킬로 현재 Gemini TTS API와 모델 ID를 확인한 뒤 /api/tts를 추가해. 모델 ID는 env TTS_MODEL로 관리.
- Director 패널에 "AI 내레이션" 토글을 둬(기본 ON). motion·ending 장면 script를 음성으로 만들어 장면 시작에 맞춰 재생·믹싱.
- TTS가 실패하거나 시간이 부족하면 자막만으로 진행(내보내기가 깨지면 안 됨). 실패는 로그에 그대로 남겨.

[P2 — 시간 남으면]
- 이미지 에셋은 외부에서 수집하지 말고 Argon이 draw() 안에서 벡터 일러스트(아이콘, 도형, 다이어그램)를 그리게 해.
- 내보내기 기본 720p, 1080p 옵션. 녹화 중 FPS가 24 아래로 떨어지면 경고하고, 탭이 숨겨지면 일시정지 후 안내.

[진행 방식]
- P0-1, P0-2, P0-3를 끝내면 바로 재배포하고, 배포 URL에서 실제 영상으로 E2E 1회를 돌려 결과를 보고해.
  확인 항목: 실제 응답 모델명, argon-code 장면 개수, 결과 영상의 오디오 유무.
- 그다음 P1 진행. 14:30이 되면 하던 걸 멈추고 docs/VERIFY-PROMPT.md를 실행해.
- 머지 전에 REA로 변경 범위와 shared/contract.ts 위반 여부를 점검해. 브라우저 확인은 Aside를 쓰고, 안 되면 playwright-windows.
```
