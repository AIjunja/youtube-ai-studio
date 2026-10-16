# 계정·키 교체 후 AGY 재개 프롬프트 (이 코드블록 하나만 붙여넣기)

```text
[재개] 사용자가 GCP 로그인 계정과 GEMINI_API_KEY를 직접 교체했다. 아래 순서대로 진행해. 키 값은 절대 출력하거나 커밋하지 마.

STEP 0. 환경 확인 (5분) — 3줄로 보고
- gcloud config get-value account / project / run/region
- 로컬 .env의 GEMINI_API_KEY로 gemini-4-argon generateContent를 1회 호출해서 성공 여부 확인. 실패하면 오류 코드와 quotaMetric만 보고하고 멈춰.
  (free_tier limit 0이면 결제가 연결된 프로젝트의 키가 아니라는 뜻이다.)
- 현재 project에 Cloud Run 서비스 youtube-ai-studio가 있는지 확인.
  · 프로젝트가 바뀌었으면 새 프로젝트에 새로 배포해야 한다. 필요한 API(run, cloudbuild, artifactregistry)를 활성화하고, 배포 서비스 계정 권한을 확인한 뒤
    `gcloud run deploy youtube-ai-studio --source . --region asia-northeast3 --allow-unauthenticated`로 배포하고, GEMINI_API_KEY와 ARGON_MODEL을 env로 설정해.
    새 URL을 README, docs/DESCRIPTION.md, docs/DEMO-SCRIPT.md에 반영해.
  · 같은 프로젝트면 `gcloud run services update youtube-ai-studio --update-env-vars`로 키만 교체해.
- 배포 서버에서 Argon 호출 1회 성공 + 응답의 usedModel이 gemini-4-argon인지 확인해.

STEP 1. docs/FINAL-PROMPT.md의 코드블록 지시를 실행해.
STEP 2. 같은 단계에서 docs/FINAL-PROMPT-ADDENDUM.md의 원인 위치와 재검수 기준을 함께 적용해(두 문서가 다르면 ADDENDUM이 우선).

시간 규칙: 진짜 내보내기(실제 영상 + 원본 음성 + 정상 길이)와 정직성 수정을 가장 먼저 끝내고 바로 재배포해.
UI 재디자인과 G마켓 산스 키트는 그다음이다. 14:20까지 안 끝난 항목은 멈추고, 14:30에 docs/VERIFY-PROMPT.md를 실행해(A1은 정직하게).
P0 재배포 직후 5줄 보고: 실제 응답 모델 / 입력·출력 길이와 원본 음성 / kit 규칙 검사 / UI 비교 캡처 경로 / 남은 문제.
```
