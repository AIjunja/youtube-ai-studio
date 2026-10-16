# YouTube AI Studio — 에이전트 규칙

이 레포에서 일하는 모든 에이전트는 작업 전에 아래 문서를 읽는다.
1. `docs/agy-context.md` — 확정된 기획, 설계 원칙, 아키텍처, 브랜치 분담, 일정 (**최우선**)
2. `reference/studio/AGY-clone-prompt.md` — UI(YouTube Studio 디자인 클론) 지시
3. `docs/hackathon-kit.md` — 상세 프롬프트 모음, 타임테이블, 데모·피칭(AGY ②)
4. `docs/layout-spec.md` — 레이아웃 요약(보조 자료)

규칙
- 기획 결정을 다시 논의하지 않는다. 막히면 범위를 줄인다(13:40 규칙, 14:30 기능 동결).
- 공통 파일(package.json, lockfile, shared/*, 배포 설정)은 main 총괄만 수정한다.
- API 키, .env, 토큰은 절대 커밋하지 않는다. 모델 ID는 env `ARGON_MODEL` 하나로 관리한다.
- `reference/`는 읽기 전용이다. 필요한 이미지는 `web/public/studio/`로 복사해서 쓴다.
- 모르는 값(모델 ID, GCP 프로젝트, 리전)은 추측하지 말고 사용자에게 묻는다.
