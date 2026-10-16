# 작업 완료 후 AGY에 붙여넣을 최종 확인 프롬프트

```text
서브에이전트 작업과 머지가 끝났으면 새 기능은 추가하지 말고 아래 검증만 수행해.
각 항목을 PASS / FAIL / SKIP으로 표시하고, 근거(명령 출력, URL, 스크린샷 경로)를 붙여서 docs/VERIFY-REPORT.md에 저장한 뒤 표로 보고해.
FAIL이 나오면 고칠 수 있는 건 바로 고치고 다시 검증하되, 15분 넘게 걸리는 건 고치지 말고 나에게 물어봐.

[A. 계정·키·모델]
A1. gcloud config get-value account / project 결과와, 이 프로젝트가 행사 계정(@gcplab.me)인지 개인 계정인지
A2. 배포된 서버에서 ARGON_MODEL로 실제 generateContent 1회 호출 성공 여부와 응답 모델명
A3. git log -p 전체와 현재 파일 전체에서 API 키 값, .env, 토큰, 쿠키, YouTube 세션 문자열(XSRF, DATASYNC_ID, INNERTUBE) 검색 결과 0건
A4. reference/ 폴더와 원본 YouTube Studio HTML이 커밋되지 않았는지, 실제 구독자 이름·댓글이 mock으로 바뀌었는지

[B. 배포본 E2E — 반드시 배포 URL에서, 실제 영상으로]
B1. 배포 URL 접속 → 대시보드 클론 화면이 나오고 ✨ AI 제작 메뉴로 이동 가능
B2. 10~20초 실제 영상 업로드 → /api/plan 성공 → Director 패널에 요약, 컷 제안, 빠진 설명, 장면 카드가 표시됨
B3. 모션 장면 코드 생성 → 장면 카드에 source(argon-code 또는 template-fallback), attempts, verified 배지가 표시됨.
    argon-code로 성공한 장면이 최소 1개 있는지 확인(전부 fallback이면 FAIL로 보고)
B4. 내보내기 → 완성 영상 재생, 다운로드 파일 재생, 오디오 포함 여부, 영상 길이 확인
B5. 시각 검증 결과가 표시되는지, 실패한 장면이 재생성되는지
B6. revise("make this simpler") 1회 → 해당 장면만 갱신되는지
B7. 잘못된 입력(25초 영상, 영상이 아닌 파일) → 친절한 오류 메시지
B8. 처리 시간: plan, 코드 생성, 내보내기 각각 몇 초 걸리는지
B9. 브라우저 콘솔 에러와 Cloud Run 로그 에러 확인(gcloud run services logs read)

[C. 시연 준비]
C1. 데모에 쓸 원본 영상과, 성공한 완성 영상을 docs/demo/에 백업(레포에는 올리지 말고 .gitignore 처리)
C2. 같은 영상으로 3회 연속 실행했을 때 성공 횟수
C3. 1440x900 화면에서 Director 패널과 배지가 한눈에 보이는지 스크린샷으로 확인

[D. 제출물]
D1. README.md(영어): 한 줄 소개, 문제, 작동 방식(mermaid), Argon 사용 지점 5곳(plan, write code, fix code, visual verify, revise), 배포 URL, 실행 방법, 한계, "Unofficial — not affiliated with YouTube"
D2. docs/DESCRIPTION.md: 영어 Project Description 150~250단어
D3. docs/DEMO-SCRIPT.md: 3분 데모 콘티(docs/hackathon-kit.md 5장 기준)

마지막에 "Public 전환 가능 여부"를 GO / NO-GO로 판정해. A3, A4가 모두 PASS일 때만 GO다.
레포를 Public으로 전환하는 건 내가 승인한 뒤에만 해.
```
