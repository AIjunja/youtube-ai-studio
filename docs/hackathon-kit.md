# YouTube AI Studio — 해커톤 최종 정리본 (2026-10-16)

> Google DeepMind AI Hackathon · 개인전 · 개발 11:20~15:20 KST
> 끊긴 GPT 대화를 정리하고, 중간에 잘린 AGY ①의 6번 이후, AGY ②, 타임테이블, 피칭 내용을 이어서 완성한 버전임.

---

## 0. 한 장 요약

### 대회 핵심 요구사항
| 항목 | 내용 |
|---|---|
| 개발 | 11:20~15:20 (4시간), 사전 제작 코드 금지, 오픈소스와 스타터 템플릿은 사용 가능 |
| 기술 | Google AI 도구(AI Studio, Antigravity 등) 필수, **Gemini 4 Argon** 중심 |
| 배포 | **Google Cloud**에 서비스로 배포, 실제 입력을 넣으면 작동해야 함 |
| 제출 | ① 영어 Project Description ② Public GitHub ③ Demo Video 링크 |
| 심사 | Working Live Demo / Problem & Impact / Originality(Argon 활용) / Clarity |
| 출품 불가 | 재출품, 단순 PDF·Q&A 챗봇, 정적 페이지, 사람 검토 없는 의료·금융 자문 |

### 확정된 제품
- **이름:** YouTube AI Studio (이전 가칭: CONTINUE)
- **슬로건:** *Just Record. AI Does the Rest.* / *From First Recording to First Upload.*
- **트랙:** 01 엔터테인먼트
- **문제:** 편집 진입장벽(컷 편집, 대본, 모션그래픽 제작 지식) 때문에 유튜브를 시작하지 못하는 예비 크리에이터가 많음. AI 편집 도구가 있어도 Claude Code, Codex, AGY에 잘 짜인 모션그래픽·편집 기법을 직접 넣어줘야 결과가 나옴.
- **해결:** 촬영본을 올리기만 하면 **자동 컷 편집 → 부족한 설명 대본 보완 → 모션그래픽·설명 장면 자체 제작 → 완성 MP4**까지 진행함.
- **차별점:** 아이디어로 영상을 만드는 서비스(Omni Studio, Director's Chair)나 기획안만 주는 서비스(ReelDNA)와 달리, **이미 찍은 영상에서 빠진 설명을 찾아내 실제 장면으로 만들어 붙임.**
- **오늘 MVP:** 10~20초 원본 1개 → Argon 분석·계획 → 설명 장면 생성 → 완성 MP4 미리보기·다운로드.

### 확정된 설계 결정
| 결정 | 내용 |
|---|---|
| UI | YouTube Studio 저장본은 **디자인 레퍼런스로만** 사용. 원본 HTML, 스크립트, 세션·인증 값은 복사·커밋·배포 금지. 왼쪽 내비게이션에 **AI 제작** 메뉴를 추가한 독립 React 앱으로 구현하고, "비공식 해커톤 프로토타입" 표시를 넣음 |
| 형태 | **웹앱** (데스크톱 앱 X). React 웹 + Node 서버를 Cloud Run 하나에 배포하고, 심사위원이 URL로 직접 실행 |
| 생성 방식 (하이브리드) | Argon이 ① 장면 계획(JSON)을 만들고 ② 모션 장면마다 **애니메이션 코드를 직접 작성**함. 이 코드는 **샌드박스(헤드리스 브라우저, 네트워크·파일 접근 차단, 시간 제한)**에서만 렌더함. 실패하면 **검증된 템플릿으로 폴백**. "템플릿 고르기"만 하면 Originality 점수가 깎이고, 코드를 무제한 실행하면 위험해서 둘을 섞음 |
| 검증 루프 | 1단계 코드 검사(lint·렌더 성공 여부) → 실패 시 오류 로그를 Argon에 주고 수정 (최대 2회) → 2단계 렌더된 프레임을 Argon이 계획과 대조 → 불합격 장면만 재생성 1회. UI에 시도 횟수와 결과를 그대로 보여줌 (심사 기준 "검증 루프"에 대응) |
| 스택 | React+TS+Vite / Node+Express / `@google/genai` / Remotion 또는 HyperFrames + FFmpeg / Cloud Run 단일 서비스 |
| DB | **P0에서 제외.** 상태는 FE가 들고 있고 렌더는 동기식으로 처리. 필요해지면 그때 Cloud Storage 추가 |
| 브랜치 | `main`(총괄·공통·통합·배포) / `feat/ui` / `feat/ai-api` / `feat/render` |
| 도구 역할 | **Codex** = 환경 점검·기존 스킬 이전, **AGY** = 개발 총괄·병렬 개발·배포, **REA** = 로컬 코드·설정 분석, **Aside MCP** = 브라우저 조사·웹앱 테스트 (실패 시 AGY `/browser` 또는 Playwright) |

### ⚠ 현장에서 반드시 확인할 것
1. Argon의 **실제 모델 ID와 접근 권한** (`gemini-4-argon`은 가정값), TTS 접근 여부
2. 임시 GCP 계정 가이드에 있는 **"Autonomous Agents 사용 금지"** 문구가 AGY Subagent 병렬 개발에도 적용되는지 (규칙 설명 시간 11:00~11:20에 질문)
3. 제출 경로와 **정확한 마감 시각**
4. 행사 계정(@gcplab.me)의 Cloud Run, Cloud Build, Artifact Registry 권한, 리전, 할당량
5. 데모용 원본 영상 촬영 시점 (안전하게 11:20 이후 촬영 권장)

### 이 PC에서 이미 확인된 관련 스킬 (Codex ①이 우선 점검할 대상)
`aijjun-video-edit`, `aijjun-video-studio`, `aijjun-video-shorts`, `aijjun-concept-motion`, `hyperframes`, `hyperframes-cli`, `hyperframes-registry`, `gsap`, `remotion-to-hyperframes`, `argon-verification-loop`, `hackathon-scope-guard`, `hackathon-demo-submission`, `gemini-skills:gemini-api-dev`

> 렌더 엔진(Remotion과 HyperFrames 중 무엇을 쓸지)은 기존 `aijjun-video-edit`의 v2kit이 실제로 쓰는 엔진을 Codex ① 보고서에서 확인한 뒤 11:20에 하나로 확정함. 둘 다 쓰지 않음.
> **단, Argon이 작성한 코드를 렌더할 때는 HTML+GSAP 방식(HyperFrames)이 더 안전함.** 브라우저 페이지 안에서만 실행돼서 서버(Node)에 접근할 수 없음. Remotion TSX는 서버에서 번들링하는 과정이 있어서 격리하기가 더 까다로움. 두 엔진이 비슷하면 HyperFrames 쪽을 고르는 걸 추천.

---

## 1. 전체 타임테이블 (KST)

| 시간 | 단계 | 할 일 | 산출물 |
|---|---|---|---|
| ~10:00 | 사전 | Codex ①, ② 실행 (환경·스킬만, 앱 코드 금지) | 점검 보고서 2개 |
| 10:00~10:30 | 체크인 | 보고서의 BLOCKED 항목 해결, AGY 로그인, `/mcp` 연결 확인 | GO/NO-GO |
| 10:30~11:00 | 환영사 | Argon 데모에서 모델 ID와 기능을 메모 | 메모 |
| 11:00~11:20 | 규칙 설명 | ⚠ 확인 항목 1~5 질문, GCP 계정 수령 및 `gcloud` 로그인 | 계정 체크 |
| **11:20~11:40** | 골격 | AGY ① 실행: 레포 생성, 골격, **API 계약·타입** 작성 후 main 커밋, worktree 3개 생성 | `contract.ts`, 초기 커밋 |
| 11:40~12:00 | 조기 배포 | 골격 상태로 **Cloud Run 첫 배포** (health만 응답해도 됨). 배포 장애는 이 시점에 발견해야 함 | 공개 URL |
| 11:40~13:10 | 병렬 개발 | UI / AI-API / RENDER 에이전트가 동시에 작업. 총괄은 머지 대기, 점심은 이때 | 3개 브랜치 |
| 12:30 | 중간 점검 | 각 브랜치 단독 동작 확인. ① Argon 코드 생성 경로의 성공률 확인 (낮으면 템플릿 위주로 전환) ② RENDER가 Cloud Run에서 안 되면 **FFmpeg 폴백** 결정 | 결정 |
| 13:10~13:40 | 머지 1차 | `feat/ai-api` → `feat/render` → `feat/ui` 순으로 머지, 로컬 E2E (실제 영상으로) | 동작하는 main |
| 13:40~14:10 | 배포 2차 | 실제 렌더 포함 Cloud Run 배포, 클라우드에서 실제 영상 E2E | 배포 URL에서 MP4 생성 |
| 14:10~14:30 | 검증 루프·폴리시 | Argon 프레임 검증, 재시도, revise 기능, UI 다듬기 | |
| **14:30** | **기능 동결** | 이후로는 버그 수정만 | |
| 14:30~14:55 | AGY ② | 배포본 테스트, 데모 영상 녹화, README, 영어 설명 작성 | 영상, 문서 |
| 14:55~15:10 | 제출 | GitHub Public 전환, 비밀값 스캔, 영상 업로드, 폼 제출 | 제출 완료 |
| 15:10~15:20 | 버퍼 | 마감 확인, 백업 영상과 스크린샷 확보 | |
| 15:20~16:30 | 심사 | 3분 라이브 데모 (백업 영상 준비) | |
| 16:00~16:30 | Top 4 발표 | 피칭 스크립트(6장) 사용 | |

**규칙:** 13:40까지 클라우드에서 MP4가 하나도 안 나오면 기능을 줄임 (검증 루프와 revise를 빼고 업로드 → 계획 → 렌더 → 다운로드만 남김).

---

## 2. CODEX ① — 기존 영상 자동화 스킬 조사 및 AGY 이전

```text
ROLE: Codex — YouTube AI Studio 사전 환경 점검 총괄
현재 날짜는 2026-10-16이며 Google DeepMind AI Hackathon 참가 준비 중이다.

[절대 조건]
실제 개발 시작은 11:20 KST. 그 전에는 환경 설치, 기존 자산 조사, 재사용 가능한 스킬 연결, 참고자료 정리만 한다.
신규 출품 앱의 코드, UI 컴포넌트, 서버, 렌더러, 데모를 미리 구현하지 마라.

[목표]
이 Windows PC에서 Codex와 Claude Code로 해왔던 영상 편집, 모션그래픽, 자료 수집, 브라우저 자동화, 디자인 작업의
실제 파일과 스킬을 조사하고, Antigravity CLI(agy)에서 바로 쓸 수 있게 연결하라.
제품: YouTube AI Studio. 사용자가 10~20초 원본 영상을 올리면 Gemini 4 Argon이 맥락을 이해해서
자동 컷 편집, 부족한 설명 대본 보완, 모션그래픽·설명 장면 제작, 최종 MP4 출력을 한다.

[A. 기존 작업 조사]
- Codex: ~/.codex, AGENTS.md, 최근 세션·프로젝트·스킬
- Claude Code: ~/.claude (skills, CLAUDE.md, MCP, hooks, 최근 작업)
- 공통: .agents/skills, SKILL.md, 프로젝트별 자동화 스크립트
- 우선 확인할 스킬 이름: aijjun-video-edit, aijjun-video-studio, aijjun-video-shorts, aijjun-concept-motion,
  hyperframes, hyperframes-cli, hyperframes-registry, gsap, remotion-to-hyperframes,
  argon-verification-loop, hackathon-scope-guard, hackathon-demo-submission, gemini-api-dev
- 키워드: v2kit, Remotion, FFmpeg, captions, sound-effects, BGM, asset, motion
- 최근 30, 60, 90일 동안 실제로 쓴 흔적과 실제로 완성된 MP4 결과물
- 파일이 있다는 것과 실제로 쓰였다는 것을 구분하라. 경로, 실행 기록, 산출물을 근거로 판단한다.
- 특히 aijjun-video-edit의 v2kit이 Remotion 기반인지 HyperFrames 기반인지 확정해서 보고하라.

[B. 영상 제작 역량 감사] 각각 READY / PARTIAL / MISSING / BLOCKED로 판정
1. 자동 컷 편집: NG, 중복 발화, 무음·대기, 맥락에 맞지 않는 구간 탐지
2. 음성 전사와 단어 단위 타임스탬프
3. 모션그래픽, 자막, 전환 (Remotion 또는 HyperFrames)
4. FFmpeg/FFprobe 컷, 합성, 인코딩, 검사
5. 효과음, BGM, 이미지·아이콘 에셋 조사와 라이선스 확인
6. 원본 촬영분과 새 설명 장면의 연속성 (톤, 해상도, 자막 스타일)
7. 렌더 결과 자동 QA와 재시도
8. 웹 UI 디자인, 반응형 테스트
9. Cloud Run 배포 관련 스킬
불완전한 스킬이라도 무작정 다시 쓰지 말고 재사용 가능한 부분을 추출하라.

[C. AGY 설치·스킬 이전]
1. agy --version, agy plugin list --json
2. 설치가 안 돼 있으면 Google 공식 문서대로 설치한다
3. 공식 Gemini Skills(gemini-api-dev)가 있는지 확인. 없으면 https://github.com/google-gemini/gemini-skills 에서 설치
4. 공식 Remotion Skills(https://github.com/remotion-dev/skills)는 v2kit이 Remotion 기반일 때만 설치한다:
   remotion-best-practices, remotion-render, remotion-captions, remotion-multimedia
5. 검증된 커스텀 영상 스킬을 AGY가 인식하는 .agents/skills/ 또는 글로벌 위치로 복사·링크한다
6. 각 스킬의 frontmatter, 스크립트 경로, 의존성, 위험한 셸 명령, 외부 전송 동작을 검사한다
7. Codex·Claude 원본 설정은 보존한다
8. AGY에서 실제로 스킬이 발견되는지 확인한다. 복사만 했다고 성공으로 판정하지 마라.

[D. REA · Aside MCP]
- REA: rea-agents 설치와 MCP 등록 상태 확인. doctor를 먼저 돌리고, 설정 변경은 dry-run으로 검토한 뒤
  npx rea-agents@latest setup의 antigravity 클라이언트 연동을 적용한다.
- Aside: Aside Browser/CLI/MCP 서버가 실제로 실행되는지, Windows에서 호환되는지 확인하고, AGY /mcp에서 도구 노출 여부를 확인한다.
- 연결에 실패하면 원인을 기록하고 AGY 내장 /browser 또는 Playwright를 대체 수단으로 준비한다. 15분 이상 붙잡지 마라.

[E. 금지]
- 출처 불명 GitHub 스킬이나 npm 패키지를 검토 없이 설치하지 않는다
- 기존 레포를 삭제하거나 덮어쓰지 않는다
- YouTube Studio 저장본의 인증·세션 데이터를 재사용하지 않는다
- 토큰이나 API 키 파일을 커밋하지 않는다
- Hopper, Ghidra 같은 불필요한 도구는 설치하지 않는다
- 11:20 이전에 출품작을 구현하지 않는다

[F. 결과] 콘솔 표 + 개인 준비 폴더에 Markdown 보고서 (hackathon-prep/codex-1-skills-report.md)
1. 기능별 READY/PARTIAL/MISSING/BLOCKED
2. 스킬명, 원본 경로, AGY 연결 경로
3. 설치·업데이트한 항목과 버전
4. REA, Aside MCP 연결 상태와 테스트 결과
5. AGY 권장 스킬 5~8개 (최소 조합)
6. 불필요하거나 충돌하는 스킬
7. 해커톤 전 차단 요인
8. 렌더 엔진 확정안 (Remotion 또는 HyperFrames, 근거 포함)
9. AGY 개발 프롬프트에 붙여 넣을 "기술 인수인계 요약" (20줄 이내)
```

---

## 3. CODEX ② — 배포·인프라 환경 점검

```text
ROLE: Codex — 해커톤 인프라·배포 사전 점검
2026-10-16 Google DeepMind AI Hackathon용 Windows + VS Code 환경을 점검한다.
11:20 KST 이전에는 설치, 인증 상태, 도구 검증, 배포 계획 문서만 작성한다. 샘플 앱 작성이나 제출용 배포는 금지한다.

[1. 로컬 도구 검증] 실제 명령을 실행해 버전을 기록
Windows/PowerShell 버전, code, agy, git, gh(+ gh auth status), node/npm/npx (Node 20 이상),
gcloud, ffmpeg, ffprobe, (기존 스킬이 요구하면) Python·Playwright, Docker(필수 아님),
Antigravity VS Code 확장 설치·로그인 상태, AGY의 Skills/Subagents/MCP 사용 가능 여부.
버전이 낮으면 기존 프로젝트를 망가뜨리지 않는 방식으로 업데이트한다.

[2. Cloud Run 배포 설계] 공식 문서를 근거로 검토
- Node 서버 하나가 Vite 빌드 결과와 /api를 같이 서빙하는 단일 서비스, PORT 환경변수 사용
- Gemini API는 서버에서만 호출 (브라우저에 키 노출 금지)
- FFmpeg, FFprobe, 렌더 엔진(Remotion 또는 HyperFrames)과 Chromium 런타임 의존성 → Dockerfile 배포 권장
- 권장 시작값: --memory 4Gi --cpu 4 --timeout 900 --concurrency 1 --max-instances 3 (근거 검토)
- 임시 파일은 /tmp(메모리 차감)에 두고 요청이 끝나면 정리
- MP4 응답 헤더 (Content-Type: video/mp4, Content-Disposition), 업로드 크기 제한 (Cloud Run 요청 32MB 한도 확인)
- 비밀값은 Secret Manager 또는 --set-env-vars로 관리 (값은 출력 금지)
- 로컬과 Cloud Run의 build/start 명령을 동일하게 맞춘다
- DB와 Cloud Storage는 P0에서 제외 (필요성이 확인될 때만 추가)

[3. 행사 GCP 계정 체크리스트] (계정 수령 전에는 추측 금지)
활성 계정, Project ID, Cloud Run·Cloud Build·Artifact Registry 권한, 리전,
Gemini 4 Argon 접근·실제 모델 ID, Gemini TTS 접근, 할당량, 외부 공개 URL 허용(allUsers invoker) 여부.
권한이 부족하면 오류와 대안을 제시하고, 개인 계정으로 몰래 전환하지 않는다.

[4. GitHub·병렬 개발 준비]
- 새 public 레포 생성 권한 확인 (생성은 11:20 이후)
- 브랜치: main(총괄) / feat/ui / feat/ai-api / feat/render
- git worktree 방식과 AGY Subagent 브랜치 모드를 비교해서 하나만 선택해 권장한다
- package.json, lockfile, Dockerfile, tsconfig, shared/contract.ts는 main 담당만 수정한다
- .gitignore에 .env*, *.key, credentials*.json, reference/ 를 미리 넣을 템플릿 문구를 준비한다

[5. 보안]
"채널 대시보드 - YouTube Studio.html"과 "_files.zip"은 디자인 레퍼런스이며 계정·세션 데이터와 내부 스크립트가 들어 있을 수 있다.
레포 바깥 경로에 두고, 커밋하거나 정적 파일로 배포하지 않는다.

[6. 결과] 보고서: hackathon-prep/codex-2-infra-report.md
- 도구별 상태·버전
- 배포 장애 요소와 해결 여부
- 권장 gcloud run deploy 명령 형태
- 필요한 환경변수 이름 목록 (값 출력 금지): GEMINI_API_KEY, ARGON_MODEL_ID, PORT 등
- 병렬 브랜치 운영 지침
- 계정 수령 후 확인할 것
- AGY에 붙여 넣을 "인프라 인수인계 요약" (15줄 이내)
- GO / NO-GO (실제 배포에 성공하기 전에는 DEPLOYED라고 쓰지 마라)
```

---

## 4. AGY ① — 개발 총괄 + 병렬 개발 (⚠ 11:20 이후 실행)

### 4-1. 메인 오케스트레이터 프롬프트

```text
ROLE: AGY Lead Engineer — YouTube AI Studio
너는 2026-10-16 Google DeepMind AI Hackathon에 개인으로 참가한 개발자의 총괄 에이전트다.
개발 허용 시간은 11:20~15:20 KST. 그 전이면 구현하지 말고 준비 상태만 보고하라.
목표: Gemini 4 Argon을 실제 런타임에서 사용하는 웹앱을 Google Cloud Run에 배포한다.

[참고 입력] 아래 두 보고서를 먼저 읽고 기술 인수인계 요약을 반영하라.
- hackathon-prep/codex-1-skills-report.md
- hackathon-prep/codex-2-infra-report.md
사용 스킬: gemini-api-dev, (확정된 렌더 엔진 스킬), aijjun-video-edit의 컷 편집·자막 로직,
aijjun-concept-motion의 개념 모션 패턴, argon-verification-loop, hackathon-scope-guard.
REA는 코드·설정 분석에, Aside MCP는 브라우저 테스트에 적극 활용한다 (실패하면 /browser 또는 Playwright).

[1. 제품]
이름: YouTube AI Studio / 슬로건: Just Record. AI Does the Rest.
사용자: 편집, 대본, 모션그래픽 제작 지식이 없어 첫 영상을 올리지 못하는 예비 크리에이터.
흐름: 10~20초 영상 업로드 → Argon이 대사·주제·장면 맥락 분석 → NG·무음·반복·불필요 구간 탐지
→ 부족한 설명 발견과 대본 보완 → 설명용 모션그래픽 장면 구성 → 원본 + 컷 편집 + 신규 장면을 합친 MP4
→ 미리보기, 장면 수정 요청, 다운로드.
사용자에게 보이는 단계는 "업로드 → AI 제작 → 확인 → 다운로드" 4개뿐이어야 한다.

[2. UI]
YouTube Studio 저장본(레포 밖 reference 경로)은 읽기 전용 레이아웃 참고용이다. HTML, JS, 인증 값은 복사하지 않는다.
다크 테마 / 상단: 서비스명, 검색, 도움말, 만들기 / 왼쪽 내비: 대시보드, 콘텐츠, ★AI 제작(강조), 분석, 설정
AI 제작 화면: 상단(제목, 새 프로젝트, 다운로드) / 업로드 영역 / 중앙 플레이어(원본 ↔ 완성본)
/ 오른쪽 "Argon 감독" 패널(영상 핵심, 편집 제안, 부족한 설명, 생성할 장면, 처리·검증 상태)
/ 하단 단순 타임라인(원본 | AI 모션그래픽 | 엔딩). 하단에 "Unofficial hackathon prototype" 표시.
대시보드, 콘텐츠, 분석 메뉴는 정적 껍데기만 만든다. 시간은 AI 제작 화면에 쓴다.

[3. 스택] React+TS+Vite / Node+Express / @google/genai (모델 ID는 env ARGON_MODEL_ID) /
확정된 렌더 엔진 + FFmpeg/FFprobe / Cloud Run (Dockerfile). TTS는 접근 권한이 있을 때만 추가한다.
DB, 로그인, 결제, 사용자 관리는 만들지 않는다. 스택은 실제 오류가 날 때만 바꾼다.

[4. 생성·검증 방식 — 하이브리드]
Argon을 대본 생성기로만 쓰지 마라. 핵심 증거는 "Argon이 영상 내용에 맞는 모션그래픽 코드를 직접 쓰고, 실행하고, 고친다"는 것이다.
- 1단계 계획: Argon이 업로드된 영상 자체(멀티모달)를 보고 ScenePlan JSON을 만든다. Zod로 검증하고, 실패하면 1회 재요청한다.
- 2단계 장면 코드: kind="motion"인 장면마다 Argon이 단일 HTML+GSAP 컴포지션(또는 확정한 엔진의 단일 컴포넌트)을 작성한다.
  허용 범위: 고정 해상도와 길이, 인라인 SVG/CSS/GSAP만 사용, 외부 URL·fetch·import·파일 접근 금지.
- 3단계 샌드박스 렌더: 헤드리스 Chromium에서 네트워크 차단, 장면당 60초 제한으로 렌더한다. 서버 프로세스에서 코드를 eval하지 않는다.
- 4단계 코드 검증 루프: 정적 검사(금지 API 스캔 + lint) → 렌더 → 실패하면 오류 로그를 Argon에 주고 수정 요청 (최대 2회)
  → 그래도 실패하면 해당 장면은 검증된 템플릿(title, bullets, diagram, compare, kinetic, ending)으로 폴백한다.
- 5단계 시각 검증: 렌더 후 장면마다 키프레임을 추출 → Argon이 계획과 대조(자막 가독성, 대본 일치, 잘림·겹침, 원본과의 연속성)
  → fail 장면만 재생성 1회.
- 장면마다 source(argon-code | template-fallback), 시도 횟수, 검증 결과를 UI에 그대로 보여준다. 이 화면이 데모의 핵심 증거다.
- 삭제 구간은 confidence가 0.7 미만이면 자동으로 지우지 않고 UI에 "제안"으로만 표시한다.
- 렌더 성공은 내용이 정확하다는 뜻이 아니다. 확실하지 않은 사실은 uncertainFacts로 사용자에게 보여준다.

[5. API 계약] main에서 shared/contract.ts로 먼저 확정하고 커밋한다. 모든 브랜치가 이 계약을 그대로 쓴다.
GET  /api/health  → { ok, model, renderer }
POST /api/plan    multipart(video) → ScenePlan
POST /api/render  multipart(video, plan JSON) → video/mp4 (동기 처리) + 헤더 X-Verify: base64(VerifyReport)
POST /api/revise  { plan, sceneId, instruction } → ScenePlan
오류 형식: { error: { code, message, retryable } }

ScenePlan = {
  summary: string, language: "ko"|"en",
  keep: {start:number,end:number}[],
  cuts: {start,end,reason:"ng"|"silence"|"repeat"|"offtopic",confidence:number}[],
  gaps: {atSec:number, missing:string}[],
  scenes: {id, kind:"original"|"motion"|"ending", durationSec, script, caption,
           template:"title"|"bullets"|"diagram"|"compare"|"kinetic"|"ending", visuals:string[]}[],
  uncertainFacts: string[]
}
SceneCode = { sceneId, code:string, attempts:number, source:"argon-code"|"template-fallback", lastError?:string }
VerifyReport = { passed:boolean, checks:{sceneId, ok, source, attempts, issue?}[], retried:boolean }

[6. 병렬 운영]
1) 11:20~11:40 총괄이 직접: 레포 생성(public 전환은 제출 직전), 모노레포 골격(web/, server/, shared/),
   package.json, tsconfig, Dockerfile, .gitignore(.env*, *.key, credentials*.json, reference/), contract.ts,
   목(mock) ScenePlan 픽스처 → main 커밋 → worktree 3개 생성(feat/ui, feat/ai-api, feat/render).
2) 11:40 골격 상태로 Cloud Run 첫 배포(health만 응답). 실패하면 이게 최우선 과제다.
3) 서브에이전트 3개를 아래 4-2의 브랜치별 프롬프트로 동시에 실행한다.
4) 공통 파일(package.json, lockfile, Dockerfile, tsconfig, shared/*)은 총괄만 수정한다.
   서브에이전트가 의존성이 필요하면 총괄에게 요청하고, 총괄이 main에 추가한 뒤 각 브랜치에서 rebase한다.
5) 각 서브에이전트는 30분마다 진행 상황을 3줄로 보고한다(완료/막힘/다음 할 일).

[7. 머지·통합]
13:10에 ai-api → render → ui 순으로 머지한다. 머지할 때마다 typecheck, build, 실제 영상 1개로 E2E를 돌린다.
충돌은 계약 기준으로 해결한다(계약이 우선).

[8. 배포] gcloud run deploy (Dockerfile, --memory 4Gi --cpu 4 --timeout 900 --concurrency 1, 비밀값은 env/Secret).
배포 URL에서 실제 영상으로 plan → render → 다운로드까지 확인해야 DEPLOYED로 보고한다.

[9. 범위 관리]
P0: 업로드 → plan → render → 미리보기·다운로드 (클라우드에서 동작)
P1: 검증 루프 표시, revise, 자막·BGM
P2: TTS 내레이션, 효과음, 대시보드 장식
13:40까지 클라우드 MP4가 나오지 않으면 P1과 P2를 즉시 중단하고 P0만 살린다. 14:30에 기능을 동결한다.

[10. 완료 기준]
배포 URL / 실제 영상 E2E 통과 / README 초안 / 비밀값 0건 / 알려진 이슈 목록을 보고하라.
```

### 4-2. 브랜치별 서브에이전트 프롬프트

**feat/ui**
```text
ROLE: UI Engineer (feat/ui worktree). shared/contract.ts를 수정하지 마라.
- YouTube Studio 스타일 다크 셸: 상단바, 왼쪽 내비(★AI 제작 강조), 정적 대시보드 껍데기
- AI 제작 화면: 업로드(드래그, 20초·32MB 검증), 중앙 플레이어(원본 ↔ 완성본 토글),
  오른쪽 Argon 감독 패널(summary, cuts 제안 토글, gaps, scenes 카드, 검증 상태 배지),
  하단 타임라인(장면 블록 색 구분), 장면 카드의 "이 장면 수정" 입력 → /api/revise
- 진행 상태 표시: 분석 중 → 계획 완료 → 렌더 중 → 검증 → 완료 (렌더는 1~3분 걸릴 수 있으니 진행 문구 필요)
- 처음에는 mock ScenePlan 픽스처로 개발하고, 머지 후 실제 API에 연결한다. 원본 File과 plan은 상태로 들고 있는다.
- "Unofficial hackathon prototype — not affiliated with YouTube" 표시
- Aside MCP 또는 /browser로 1440px와 390px 화면을 확인하고 스크린샷을 남긴다.
완료 기준: mock으로 전체 흐름 클릭 가능, build 통과.
```

**feat/ai-api**
```text
ROLE: AI/API Engineer (feat/ai-api worktree). shared/contract.ts를 수정하지 마라.
- Express 라우트: /api/health, /api/plan, /api/revise (multer 업로드, /tmp 저장 후 정리)
- @google/genai로 Argon 호출: 영상 파일을 업로드(Files API 또는 inline)한 뒤 구조화 출력(responseSchema)으로 ScenePlan 생성
- 프롬프트 원칙: 사용자가 실제로 한 말을 보존하고, 부족한 설명은 1~3개 장면으로 보완하고,
  확실하지 않은 사실은 uncertainFacts에 넣고, 장면마다 template 하나를 고르고, 각 장면은 3~6초로 한다
- Zod 검증에 실패하면 오류 메시지를 넣어 1회 재요청한다
- generateSceneCode(scene, plan) / fixSceneCode(scene, code, errorLog) 함수: 장면 코드 작성과 수정.
  시스템 프롬프트에 허용·금지 규칙(외부 URL, fetch, import 금지, 고정 해상도와 길이)과 좋은 예시 1개를 넣는다.
  예시 스타일은 aijjun-concept-motion과 v2 톤(흰 여백·먹색·라임)을 참고한다.
- verify(frames[], plan) 함수: 키프레임 이미지와 계획을 Argon에 보내 VerifyReport를 받는다 (render 브랜치가 호출)
- 컷 판단 시 aijjun-video-edit의 NG·"다시"·무음 판단 규칙을 참고한다
- 실제 영상 2개로 plan 결과 JSON을 fixtures/에 저장한다 (UI와 RENDER가 사용)
완료 기준: curl로 실제 영상 → 유효한 ScenePlan, 키는 서버 env에서만 읽음.
```

**feat/render**
```text
ROLE: Media/Render Engineer (feat/render worktree). shared/contract.ts를 수정하지 마라.
- 렌더 엔진은 Codex ① 보고서에서 확정한 하나만 쓴다 (Remotion 또는 HyperFrames).
- 샌드박스 장면 렌더러: Argon이 쓴 HTML+GSAP 코드 → 정적 검사(fetch, XMLHttpRequest, import, 외부 URL, eval 스캔)
  → 헤드리스 Chromium(네트워크 차단, 60초 제한)에서 프레임 캡처 → MP4. 실패하면 오류 로그를 반환한다.
- 코드 루프: render 실패 → ai-api의 fixSceneCode 호출 → 재렌더 (최대 2회) → 그래도 실패하면 템플릿 폴백
- 폴백 템플릿 6개: title, bullets, diagram, compare, kinetic, ending (aijjun-concept-motion과 v2 톤 참고, 1080x1920 또는 1920x1080 중 원본에 맞춤)
- 파이프라인: ffprobe로 원본 해상도·fps 확인 → keep 구간 컷(FFmpeg) → motion 장면 렌더(코드 루프) → 자막 → concat → H.264/AAC MP4
- 렌더 후 장면마다 키프레임을 추출하고 ai-api의 verify 호출 → fail 장면만 재생성 1회
- /api/render 라우트 (동기 처리, 임시 파일 정리, 요청 하나당 렌더 1개)
- 폴백: 렌더 엔진이 Cloud Run에서 실패하면 FFmpeg drawtext와 색 배경으로 만든 단순 모션 장면으로 대체 (12:30에 판단)
- BGM과 효과음은 라이선스가 확인된 로컬 에셋만 쓰고 출처를 ASSETS.md에 기록한다
완료 기준: fixtures/의 plan과 실제 영상으로 로컬에서 MP4 생성, Docker 이미지 안에서도 렌더 성공.
```

---

## 5. AGY ② — 배포 전 테스트, 시연 영상, 제출·발표 문서 (14:30 이후)

```text
ROLE: AGY Release & Pitch Lead — YouTube AI Studio
기능 동결(14:30) 이후에 실행한다. 새 기능 추가는 금지하고, 버그 수정만 허용한다.

[1. 배포본 테스트] 배포 URL 기준. 결과는 docs/TEST_REPORT.md에 기록
- /api/health 응답, 모델 ID 확인
- 실제 원본 영상 2개(한국어 1개, 다른 주제 1개)로 업로드 → plan → render → 재생 → 다운로드
- 검증 루프 동작(VerifyReport 표시), revise 1회
- 잘못된 입력: 25초 영상, 비디오가 아닌 파일, 빈 요청 → 친절한 오류 메시지
- Aside MCP(또는 /browser, Playwright)로 데스크톱·모바일 화면 확인과 스크린샷
- 처리 시간(분석, 렌더) 측정
- 비밀값 스캔: git log 전체에서 키, 토큰, YouTube 레퍼런스 파일 흔적 0건 확인 (argon-verification-loop 기준으로 모델 결과, 프로그램 검사, 실제 산출물을 구분해 기록)

[2. 데모 영상] (hackathon-demo-submission 스킬 사용) 3분 이내, 영어 자막 또는 내레이션
0:00-0:20 문제: 편집 장벽 때문에 시작하지 못하는 사람들
0:20-0:35 원본 촬영본 재생 (NG, 무음, 설명 부족이 있는 날것 상태)
0:35-1:30 실제 배포 URL에서 업로드 → Argon 감독 패널(컷 제안, 빠진 설명, 장면 계획)
1:30-2:15 렌더된 완성본 재생 (원본 + AI 모션그래픽 설명 장면 + 엔딩), 검증 결과 배지
2:15-2:35 장면 하나 revise ("make this simpler") → 재렌더
2:35-3:00 Argon 활용 방식(멀티모달 이해, 계획, 검증 루프)과 앞으로의 계획
녹화 전에 완성본 MP4를 따로 백업해 둔다 (라이브 실패 대비).

[3. README.md (영어)]
한 줄 소개, 문제, 해결, 데모 링크와 배포 URL, 아키텍처 다이어그램(mermaid),
Argon 활용 지점(plan, verify, revise), 실행 방법(로컬, Cloud Run), 환경변수 이름,
제한 사항, 라이선스와 에셋 출처, "Unofficial — not affiliated with YouTube/Google".

[4. Project Description (영어, 제출용)] 아래 구조로 150~250단어
- Inspiration: 수많은 사람이 편집 장벽 때문에 첫 영상을 올리지 못한다
- What it does: Just Record. AI Does the Rest.
- How we built it: Gemini 4 Argon의 멀티모달 이해 → 구조화된 장면 계획 → 템플릿 렌더 → Argon 프레임 검증 루프, Cloud Run
- Challenges / What's next: 롱폼 지원, 채널 스타일 학습, YouTube 업로드 연동
"유입률 증가" 같은 효과는 검증된 수치처럼 쓰지 말고 기대 효과로 표현한다.

[5. 발표 자료] docs/PITCH.md — 아래 6장의 3분 스크립트를 영어와 한국어로 작성

[6. 제출 체크리스트]
배포 URL 공개 접근 / GitHub public 전환 / 데모 영상 공개 링크 / Description 붙여넣기 / 마감 시각 전 제출 / 백업 영상·스크린샷
```

---

## 6. 3분 피칭 뼈대 (Top 4 대비)

| 시간 | 내용 |
|---|---|
| 0:00~0:20 | **Hook.** "유튜브를 시작하고 싶은데 편집 때문에 포기한 사람, 손 들어보세요." 영상 제작에서 가장 높은 벽은 촬영이 아니라 편집이라는 점 |
| 0:20~0:40 | **Problem.** AI 편집 도구가 있어도 결국 편집과 모션그래픽 기법을 알아야 쓸 수 있음. 초보자에게는 여전히 벽임 |
| 0:40~2:10 | **Live Demo.** 날것 촬영본 업로드 → Argon이 NG를 자르고 빠진 설명을 찾아냄 → 직접 찍지 않은 설명 장면이 생성됨 → 검증 통과 → 다운로드 |
| 2:10~2:35 | **Why Argon.** 영상을 보고 이해(멀티모달) → 무엇이 빠졌는지 추론 → **모션그래픽 코드를 직접 작성** → 렌더 오류를 스스로 수정 → 결과 프레임을 다시 보고 검증. 화면의 "attempts 2 → passed" 배지를 짚으면서 설명 |
| 2:35~3:00 | **Impact & Next.** *From First Recording to First Upload.* 다음 단계: 롱폼, 채널 스타일 학습, 바로 업로드 |

**WOW 포인트는 하나만 남김:** "찍지 않은 설명 장면이 생겼다."

---

## 7. 부록 — 아이디어가 여기까지 온 과정

### 7-1. 브레인스토밍 후보 18개 (전부 기획 단계, 구현 없음)
| 트랙 | 후보 |
|---|---|
| ① 엔터테인먼트 | **1. CONTINUE (→ YouTube AI Studio)** · 2. Adaptive Content (보다가 막힌 부분을 맞춤 설명·실습 화면으로) · 3. Match2Sim (축구 영상 → 2D 전술 시뮬레이션) · 4. StoryCut (축구 하이라이트 스토리 편집) · 5. RuleKick (말로 규칙 정하면 플레이 가능한 축구 게임) |
| ② 하드테크 | 6. PacketTwin · 7. FailureTwin/FaultLab · 8. BuildingTwin · 9. HeatShift · 10. SpecBreaker |
| ③ 사회적 가치 | 11. SkillRescue/DoneProof · 12. SceneVoice (화면 설명을 음성해설로) · 13. AccessRepair · 14. EasyMode (+ AccessCut, SafeRouteLab) |
| ④ 오픈 이노베이션 | 15. Living Software · 16. ReplayFix · 17. AgentReplay/AgentCrash · 18. MergeProof (+ LegacyLift, TutorialRescue) |

최종 후보 4개: **CONTINUE**(가장 구체화됨) / Adaptive Content / Living Software(Argon 코딩 능력이 가장 직접 드러남) / ReplayFix

### 7-2. 결정 흐름
1. **CONTINUE 선택:** 직접 겪는 문제이고, 결과(입력 영상 → 완성 영상)가 눈에 보이고, 엔터테인먼트 트랙에 맞음.
2. **해외 사례 검토:** ReelDNA, Omni Studio, Director's Chair와 영역이 겹침 → "이미 찍은 영상에서 빠진 장면을 찾아 실제로 만든다"로 범위를 좁힘 (Missing Shot Director).
3. **이름과 문제 재정의:** YouTube AI Studio. 단순 편집기가 아니라 **편집 진입장벽 때문에 유튜브를 시작하지 못하는 사람**이 대상.
4. **형태:** 데스크톱 앱이 아니라 **웹앱 + Cloud Run**. YouTube Studio 화면은 레이아웃만 참고.
5. **사회적 가치 트랙 검토 (SceneVoice, AccessCut, EasyMode):** 가산점 근거가 없고, 당사자 검증 없이 급하게 바꾸면 오히려 약해짐 → **보류**.
6. **객관 평가로 설계 보강:** 아래 7-3 참고. Argon이 코드를 직접 쓰고 검증하는 하이브리드 방식으로 변경 (0장 표와 AGY ①의 4번에 반영).

### 7-3. 심사 적합성 평가 (GPT 기획 평가, 공식 점수 아님)
| 기준 (각 25) | 원래 기획 | 약점 | 이 문서의 대응 |
|---|---|---|---|
| Working Demo·검증 | 12 | 배포, 모델 호출, MP4 생성이 모두 미검증 | 11:40 조기 배포, 13:40 클라우드 E2E 기준선, 코드·시각 이중 검증 루프 |
| Problem & Impact | 21 | "유입률 증가"는 검증되지 않은 효과 | 기대 효과로만 표현 |
| Originality·Argon | 15 | 자동 편집기로 보일 위험, Argon이 꼭 필요한지 불명확 | Argon이 모션 코드를 작성·수정·검증하고 그 과정을 UI에 노출 |
| Clarity | 20 | 결과물 품질이 변수 | WOW 하나("찍지 않은 설명 장면")로 집중, 백업 영상 |
| **합계** | **68** | | 클라우드에서 검증 루프와 장면 수정까지 성공하면 목표 **85** |

**범위에서 뺀 것:** 외부 자료 자동 수집, 목소리 복제, 완전한 편집기 클론, YouTube OAuth, 실제 채널 분석.

---

## 8. 사용 순서 요약
1. **지금 (~11:20):** Codex ① → Codex ② → 보고서 확인 → AGY 로그인·`/mcp` 확인 → 현장 확인 항목 질문
2. **11:20:** AGY ① 메인 실행 → 골격과 계약 커밋 → 조기 배포 → 4-2 서브에이전트 3개 병렬 실행
3. **13:10:** 머지 → 13:40 클라우드 E2E (안 되면 범위 축소)
4. **14:30:** 기능 동결 → AGY ② 실행 → 15:10까지 제출
