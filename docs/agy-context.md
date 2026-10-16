# AGY 컨텍스트 브리핑 — 지금까지의 기획 대화 요약 (2026-10-16)

> 이 문서는 사용자가 GPT, Claude와 진행한 기획 대화를 압축한 것이다. 아래 내용은 **이미 결정된 사항**이니 다시 논의하지 말고 그대로 따른다.
> 바뀔 수 있는 건 "현장 확인 필요" 항목과 실제 실행 중에 생긴 오류뿐이다.

## 1. 대회
- Google DeepMind AI Hackathon, 서울, 개인전. **개발 11:20~15:20 KST**. 사전 제작 코드 금지(오픈소스와 스타터 템플릿은 허용).
- 필수: Google AI 도구 사용(**Gemini 4 Argon** 중심), **Google Cloud 배포**, 실제 입력으로 동작해야 함.
- 제출: 영어 Project Description, Public GitHub, Demo Video 링크.
- 심사: ① Working Live Demo(Argon과 **검증 루프**를 잘 썼는가) ② Problem & Impact ③ Originality(Argon의 멀티모달·추론·코딩 능력을 의미 있게 썼는가) ④ Clarity. 3분 시연이 기준.
- 출품 불가: 단순 챗봇, 검증·멀티모달 없는 정적 페이지, 재출품.

## 2. 제품 (확정)
- **이름:** YouTube AI Studio (앱 화면 표기는 "AI Studio for Creators", 비공식 프로토타입 표시). 이전 가칭은 CONTINUE.
- **슬로건:** Just Record. AI Does the Rest. / From First Recording to First Upload.
- **트랙:** 엔터테인먼트.
- **사용자:** 편집, 대본, 모션그래픽 제작 지식이 없어 첫 영상을 올리지 못하는 예비 크리에이터.
- **핵심 가치:** 단순 자동 편집이 아니다. 촬영본을 올리면 ① NG·무음·반복 컷 ② **빠진 설명을 찾아 대본 보완** ③ **설명용 모션그래픽 장면을 Argon이 직접 코드로 만들고 렌더** ④ 검증 ⑤ 완성 영상. AI 도구를 써도 편집 기법을 알아야 하는 진입장벽을 없앤다.
- **WOW 한 가지:** "찍지 않은 설명 장면이 생겼다."
- **경쟁 사례와의 차별점:** ReelDNA(기획안만 생성), Omni Studio와 Director's Chair(아이디어 → 영상). 우리는 **이미 찍은 영상의 빈 곳을 찾아 이어 붙인다.**
- **MVP 범위:** 10~20초 원본 1개 → 분석·계획 → 모션 장면 1~3개와 엔딩 → 완성 영상 미리보기·다운로드 → 장면 수정 요청(revise).
- **제외:** YouTube OAuth, 실제 채널 데이터, 목소리 복제, 외부 자료 자동 수집, 프리미어급 타임라인, DB, 로그인.

## 3. 반드시 지킬 설계 원칙
1. **Argon이 핵심 작업을 한다.** 대본만 쓰는 게 아니라 ① 영상을 직접 보고(멀티모달) ScenePlan JSON을 만들고 ② 모션 장면 코드를 작성하고 ③ 오류가 나면 고치고 ④ 렌더 결과 프레임을 보고 검증한다.
2. **검증 루프를 화면에 보여준다.** 장면마다 `source(argon-code | template-fallback)`, `attempts`, `verified` 배지와 모델 호출 로그를 표시한다.
3. **안전:** Argon이 쓴 코드는 격리된 환경(Web Worker + OffscreenCanvas, fetch·XHR·WebSocket·importScripts 제거, 시간 제한)에서만 실행한다. 서버에서 eval하지 않는다. 코드 수정은 최대 2회, 그래도 실패하면 템플릿으로 폴백해서 내보내기가 절대 깨지지 않게 한다.
4. confidence가 0.7 미만인 컷은 자동으로 삭제하지 않고 "제안"으로만 표시한다. 확실하지 않은 사실은 `uncertainFacts`로 보여준다.
5. **UI:** 실제 YouTube Studio 채널 대시보드 디자인을 **그대로 클론**하고(해커톤 시연 전용), 왼쪽 내비에 **✨ AI 제작** 메뉴와 프로모 카드를 추가한다. 사용자 단계는 업로드 → AI 제작 → 확인 → 다운로드 4개뿐.
   클론 원본은 `reference/studio/studio-shell.html`(스크립트, 세션 값, 타인 닉네임을 제거한 사본)이다. 방법은 `reference/studio/AGY-clone-prompt.md`를 따른다.
   사용자의 Downloads에 있는 원본 HTML과 zip은 레포에 넣지 않는다(세션 값이 들어 있음).
6. 모델 ID는 상수 또는 env `ARGON_MODEL` 하나로 관리한다(가정값 `gemini-4-argon`, 현장 공지에 따라 변경). API 키는 서버에서만 다룬다.

## 4. 아키텍처 (시간을 고려해 확정)
- **브라우저 렌더 + 얇은 Node 서버 + Cloud Run 단일 서비스.**
  - 브라우저: React+TS+Vite. 업로드, Canvas 합성기(원본 keep 구간 + 모션 장면 + 자막), Web Worker 샌드박스, MediaRecorder(mp4 우선, 안 되면 webm), 키프레임 캡처.
  - 서버: Express + `@google/genai`. `/api/plan`, `/api/scene-code`, `/api/fix-code`, `/api/verify`, `/api/revise`, `/api/health`. 키를 보호하는 프록시 역할만 하고, 빌드된 정적 파일도 같이 서빙한다.
  - 배포: `gcloud run deploy --source .` (FFmpeg와 Chromium이 필요 없어 Dockerfile 없이 빌드팩으로 가능).
- 서버에서 FFmpeg로 렌더하는 방식(이전 계획)은 **폴백 옵션으로만** 남긴다. Cloud Run에서 Chromium·FFmpeg 의존성 때문에 막힐 위험이 커서 기본값에서 뺐다.
- 데이터 타입:
```ts
type ScenePlan = { summary; language; transcript:{start,end,text}[]; keep:{start,end}[];
  cuts:{start,end,reason:"ng"|"silence"|"repeat"|"offtopic",confidence}[]; gaps:{atSec,missing}[];
  scenes:{id,kind:"original"|"motion"|"ending",durationSec,script,caption,visualIdea,sourceRange?}[]; uncertainFacts:string[] };
type SceneCode = { sceneId; code; attempts; source:"argon-code"|"template-fallback"; lastError? };
type VerifyReport = { passed; checks:{sceneId,ok,source,attempts,issue?}[]; retried };
```
- 모션 코드 형식: `function draw(ctx, t, w, h, scene)`의 함수 본문. Canvas 2D와 Math만 사용, 결정적(같은 t면 같은 결과)이어야 함. 글자는 1080p 기준 48px 이상. 스타일은 흰 여백, 먹색 텍스트, 라임(#C6FF00) 포인트 하나, 단어 단위 키네틱 등장.

## 5. 병렬 작업 분담 (git worktree)
- `main`(총괄): 골격, `shared/contract.ts`, package.json, lockfile, 배포, 머지. 공통 파일은 총괄만 수정한다.
- `feat/ui`: 스튜디오 셸, AI Create 화면, Director 패널, 진행 상태 표시. 처음에는 mock ScenePlan으로 개발한다.
- `feat/ai-api`: Express 라우트와 Argon 프롬프트(plan, scene-code, fix-code, verify, revise), 응답 스키마 검증.
- `feat/render`: Worker 샌드박스, 코드 검증 루프(테스트 프레임, 빈 화면 검사), 템플릿 폴백, Canvas 합성기, MediaRecorder 내보내기, 키프레임 추출.

## 6. 일정 (KST)
| 시간 | 할 일 |
|---|---|
| 지금 | 골격과 계약을 main에 커밋 → worktree 3개 생성 → **health만 응답하는 상태로 Cloud Run 첫 배포** |
| ~13:10 | 3개 브랜치 병렬 개발. 12:30 중간 점검(코드 생성 성공률, 합성기 동작) |
| 13:10~13:40 | ai-api → render → ui 순서로 머지, 실제 영상으로 로컬 E2E |
| 13:40 | 클라우드 E2E. **이때 영상이 안 나오면 revise와 시각 검증을 빼고 핵심 흐름만 살린다** |
| 14:30 | **기능 동결.** 이후 테스트, README, 데모 녹화 |
| ~15:10 | GitHub Public 전환, 비밀값 스캔, 제출 |

## 7. 사용할 도구와 스킬
`gemini-api-dev`, `argon-verification-loop`, `hackathon-scope-guard`, `hackathon-demo-submission`, (모션 스타일 참고용) `aijjun-concept-motion`, `aijjun-video-edit`. 브라우저 테스트는 Aside MCP를 쓰고, 안 되면 `/browser`나 Playwright. 코드·설정 분석은 REA.

## 8. 현장 확인 필요 (추측 금지)
Argon의 실제 모델 ID와 접근 권한, TTS 가능 여부, 행사 GCP 프로젝트의 권한·리전, 제출 마감 시각, Autonomous Agents 금지 규칙의 적용 범위.
