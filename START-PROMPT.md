# AGY에 이 블록 하나만 붙여넣기

```text
너는 이 레포(YouTube AI Studio)의 총괄 엔지니어다. 지금은 Google DeepMind AI Hackathon 개발 시간이다(마감 15:20 KST, 기능 동결 14:30).

0) AGENTS.md를 읽고, 거기 나온 docs/agy-context.md, reference/studio/AGY-clone-prompt.md, docs/hackathon-kit.md를 끝까지 읽어라.
   기획은 확정됐다. 다시 논의하지 말고 실행한다.

1) 이해 확인: 아래 내용을 8줄 이내로 요약한 뒤 바로 다음 단계로 넘어가라(내 승인을 기다리지 마라).
   제품, WOW, Argon이 맡는 4가지 역할(계획/코드 작성/코드 수정/시각 검증), 아키텍처, 브랜치 분담, 13:40·14:30 규칙.

2) 나에게 딱 한 번만 묻는다: ARGON_MODEL 실제 ID, GEMINI API 키 설정 여부, GCP 프로젝트 ID와 리전.
   답을 기다리는 동안 키가 필요 없는 작업을 먼저 진행한다.

3) main 총괄 작업(직접 수행):
   - git init, 모노레포 골격(web/: React+TS+Vite+Tailwind, server/: Express+@google/genai, shared/contract.ts)
   - docs/agy-context.md 4장의 타입과 API(/api/health, /api/plan, /api/scene-code, /api/fix-code, /api/verify, /api/revise)를 그대로 계약으로 작성
   - mock ScenePlan 픽스처, .env.example(값 없이 이름만), 루트 npm 스크립트(dev, build, start)
   - reference/studio/"채널 대시보드 - YouTube Studio_files"의 이미지와 svg를 web/public/studio/로 복사
     (reference/는 .gitignore 대상이라 worktree에는 없다. 서브에이전트에게는 원본 경로를
     C:\Users\letgo\Documents\youtube-ai-studio\reference\studio 절대 경로로 알려줘라.)
   - 서버가 web/dist를 서빙하도록 하고, health만 응답하는 상태로 커밋
   - 첫 커밋 후 GitHub 레포 생성(처음엔 private)과 push, 그다음 `gcloud run deploy --source .`로 Cloud Run 첫 배포(GCP 정보를 받은 뒤)

4) git worktree 3개를 만들고 서브에이전트를 병렬로 실행:
   - feat/ui: reference/studio/AGY-clone-prompt.md의 코드블록 지시 + docs/agy-context.md의 AI Create 화면/Director 패널(배지: source·attempts·verified, 모델 호출 로그)
   - feat/ai-api: Argon 프롬프트와 라우트(plan은 영상 멀티모달 입력 + responseSchema, scene-code는 draw(ctx,t,w,h,scene) 함수 본문, fix-code, verify, revise), 스키마 검증 후 1회 재시도
   - feat/render: Web Worker+OffscreenCanvas 샌드박스(fetch/XHR/WebSocket/importScripts 제거, 프레임당 2초 제한),
     테스트 프레임과 빈 화면 검사 → 수정 최대 2회 → 템플릿 폴백, Canvas 합성기(원본 keep 구간+모션 장면+자막),
     MediaRecorder 내보내기(mp4 우선, 안 되면 webm), 장면별 키프레임 추출
   각 서브에이전트는 shared/와 package.json을 수정하지 않는다(필요하면 총괄에게 요청). 30분마다 3줄로 보고한다.

5) 13:10 머지(ai-api → render → ui) → 실제 영상으로 E2E → 재배포.
   13:40까지 배포 URL에서 영상이 안 나오면 revise와 시각 검증을 빼고 핵심 흐름만 살린다.
   14:30 기능 동결 → docs/hackathon-kit.md의 AGY ②(테스트, README, 데모 영상 콘티, 영어 Description) 실행
   → 비밀값 스캔 후 레포 Public 전환.

진행 중에는 나에게 묻지 말고 판단해서 진행하라. 단, 비밀값이 필요하거나, 배포 권한 오류가 나거나, 범위를 줄여야 할 때만 묻는다.
```
