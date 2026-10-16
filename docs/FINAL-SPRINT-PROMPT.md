# AGY 최종 스프린트 프롬프트 — 이 코드블록 하나만 붙여넣기

```text
[최종 스프린트 — 30분 제한] 이 지시가 이전의 모든 프롬프트(STEER/NEXT/DESIGN-REDO/FINAL/RESUME)를 대체한다.
⏱ 30분 안에 "구현 → main 머지 → Cloud Run 배포 → 보고"까지 끝내라. 사용자가 그 뒤에 최종 검증을 한다.
- 긴 검증, 반복 E2E, 스크린샷 비교 리포트는 하지 마. 대신 모든 API 엔드포인트를 배포 URL에 실제로 1회씩 호출해서
  HTTP 상태와 usedModel이 정상인지만 확인해(가짜 성공 금지).
- 미커밋 변경이 있으면 먼저 커밋해. 키 값은 출력·커밋하지 마. Argon(gemini-4-argon)은 200 OK가 확인된 상태다.
- 속도를 위해 처음 5분 동안 총괄이 shared/contract.ts를 갱신하고, 3개 worktree(ui / ai-api / render)에 서브에이전트를 병렬로 투입해.
  20분 시점에 머지(ai-api → render → ui), 25분에 배포, 30분에 보고.
- 코드 레벨 버그 위치는 docs/FINAL-PROMPT-ADDENDUM.md를 참고해(내보내기 가짜 녹화기, 가짜 성공, 960/1920 불일치 등).

════ 1. 사용자 흐름 (반드시 이대로) ════
흐름 A — 원본 영상이 있을 때
 ① 내 목소리 등록: 목소리 샘플 업로드(또는 녹음) → 본인 동의 체크 → 목소리 복제(voiceId 생성)
 ② 원본 영상 업로드
 ③ 질문: "어떻게 완성할까요?"
    [편집·그래픽만]  컷 편집 + 자막 + 모션그래픽 오버레이로 원본을 다듬어 완성
    [대본 추가해서 완성]  Argon이 빠진 설명 대본을 추가로 작성 → 복제된 내 목소리로 음성 생성
                         → 얼굴 노출 없이 모션그래픽 장면으로 제작 → 원본 편집본과 이어 붙여 최종본
흐름 B — 원본 영상 없이 처음부터
 ① 내 목소리 등록(동일)
 ② [처음부터 만들기] 선택 → 주제와 핵심 내용을 몇 줄 입력
 ③ Argon이 대본 작성 → 복제 목소리로 음성 생성 → 대본 기반 모션그래픽 영상 제작 → 최종본
목소리는 한 번 등록하면 다음 프로젝트에서 재사용한다(voiceId를 localStorage에 저장하고 [목소리 바꾸기] 제공).

════ 2. API (실제 호출이 명확해야 함) ════
- POST /api/voice/clone: 목소리 샘플(10~30초 wav/mp3/webm) + consent:true → { voiceId, usedModel }.
  gemini-api-dev 스킬로 gemini-3.8-flash-tts의 Voice Replication 문서(https://ai.google.dev/gemini-api/docs/voice-replication.md.txt)를 읽고 그대로 구현해.
  동의 체크 없이는 호출을 막아. 복제에 실패하면 실제 오류를 반환하고, UI에서 기본 음성(Kore)으로 진행할지 묻는다.
- POST /api/plan(기존): 영상 멀티모달 분석. transcript(1~3초 구절, 0.1초 단위, 실제로 한 말 그대로), cuts, gaps, scenes. 모델 gemini-4-argon.
- POST /api/script(신규): mode("append" | "from-scratch"), plan 또는 { topic, notes } → 장면별 대본[{id, script, caption, visualIdea, durationSec}]. 모델 gemini-4-argon.
- POST /api/tts: { text, voiceId } → audio/wav. 모델 env TTS_MODEL=gemini-3.8-flash-tts(로컬 .env와 Cloud Run 둘 다).
  responseModalities AUDIO, 응답은 inlineData audio/wav로 바로 온다. 장면 동시 호출은 3개까지.
- POST /api/scene-code, /api/fix-code, /api/verify, /api/revise(기존) 유지. 모든 응답과 로그에 usedModel을 넣고, 실패는 실패로 반환해.
- shared/contract.ts: ProjectMode = "edit-only" | "edit-plus-script" | "script-only", VoiceProfile { voiceId, label, createdAt }를 추가.

════ 3. UI/UX — YouTube Studio의 UI·UX·CI를 그대로 (글리치·제미나이 풍 금지) ════
docs/UIUX-SPEC.md를 따르되 위 흐름에 맞춰 단계를 바꿔.
- 금지: 그라데이션, 글로우, 네온, 글리치·노이즈 효과, ✨ 반복, 알약 배지, 영어 대문자 라벨, 메인 화면의 개발 용어.
- 따를 것: YouTube Studio 다크 테마 그대로. 평평한 #282828 계열 카드와 모달, 1px 테두리, Roboto/Noto Sans KR 14px,
  파란 주 버튼(#3ea6ff), 흰색·회색 텍스트 버튼, Material 아이콘. 비교 기준은
  C:\Users\letgo\Documents\youtube-ai-studio-review\shots\youtube-studio-live-reference.png.
- 진입점: 상단 [만들기] → "AI로 영상 만들기", 왼쪽 내비 "AI 편집"(아이콘+한 줄), 대시보드 첫 카드.
- Studio "동영상 업로드" 모달 형식, 스텝퍼:
  흐름 A: 내 목소리 → 영상 업로드 → 완성 방식 선택 → AI 제작 → 검토 → 내보내기
  흐름 B: 내 목소리 → 주제 입력 → AI 제작 → 검토 → 내보내기
  (목소리가 이미 등록돼 있으면 1단계는 "목소리: 내 목소리 ✓ [바꾸기]"로 접힌다)
- 완성 방식 선택 화면: 큰 선택 카드 2개(Studio의 공개 상태 라디오 카드처럼)
  "편집·그래픽만 — 내가 찍은 영상을 다듬어요" / "대본 추가해서 완성 — 빠진 설명을 AI가 내 목소리로 채워요".
  첫 화면에 [영상 없이 처음부터 만들기] 텍스트 버튼.
- AI 제작 화면: 쉬운 한국어 체크리스트가 차례로 완료됨("말을 받아 적었어요 37단어", "말이 끊긴 곳 2군데를 잘랐어요",
  "빠진 설명 대본을 썼어요", "내 목소리로 읽었어요", "설명 장면 3개를 만들었어요", "완성 화면을 확인했어요").
  실패는 회색 경고와 쉬운 문장으로 솔직하게. 진행 막대와 남은 시간.
- 검토 화면: 오른쪽 미리보기(원본⇄완성본), 왼쪽 탭 [자막](바로 수정) [AI 장면](▶ 듣기, 더 쉽게/더 짧게/다시 만들기) [AI 작업 기록](접힘: 실제 모델, 시도 횟수, 검증 결과).
- 첫 진입은 빈 업로드 화면이다. mock을 자동으로 보여주지 마. 샘플은 [샘플로 체험하기]로만, "샘플 데이터" 표시와 함께.
- 반응형: 1024px 이하에서는 내비를 아이콘으로, 600px 이하에서는 서랍 메뉴와 한 열. 가로 넘침 0.

════ 4. 영상 품질 ════
- 진짜 내보내기: 실제 업로드 영상 픽셀과 원본 음성을 requestAnimationFrame으로 실시간 합성하고 MediaRecorder로 녹화해.
  demoSampleVideo.ts의 120단계 가짜 녹화기와 oscillator 톤을 실제 내보내기에서 제거해. 프리뷰와 다운로드가 같아야 한다(자막 포함).
  출력 길이 = 장면 합계 ±0.3초.
- 오디오: 원본 음성 + 복제 목소리 내레이션 + (가능하면) 합성 BGM 덕킹. 모션 장면 동안 원본 오디오는 음소거. 목표 -14 LUFS, 피크 -1.5dB 리미터.
- 컷 경계: 브라우저에서 오디오 RMS(20ms)로 Argon 컷 경계를 ±0.3초 안의 가장 조용한 지점에 맞추고, 앞뒤 0.08초 여유.
- 영상 폰트는 G마켓 산스: C:\Windows\Fonts\GmarketSansTTFBold/Medium/Light.ttf → web/public/fonts/.
  제목·슬램 Bold, 본문·자막 Medium, 보조 Light. 자간 -0.02~-0.04em. 영문 라벨만 JetBrains Mono.
  Worker에서 FontFace로 로드가 끝난 뒤 렌더를 시작해.
- 기준 해상도를 1920×1080 논리 좌표 하나로 통일(codeLoop의 960×540 제거). 최소 글자 34px, 안전 여백 좌우 120 / 상하 96, 가운데 정렬,
  한 화면 한 생각(15자 안팎 2~3줄), 장면당 2~4초 이상, 1.5~3초마다 변화, 4초 넘는 정지 금지, 전환은 하드 컷 + 흰 플래시.
  색: 바탕 #FAFAF8, 먹 #0E0E10, 회색 #8A8A90, 강조 라임 #D7FF3A 하나, 다크 #0B0B0C.
- Worker에 규칙이 박힌 kit(kit.slam / full / card / chip / numbered / chat / flow·arrow·box / caption / flash)를 넣고,
  Argon은 kit를 호출해서 장면을 만든다. 모든 텍스트는 measureText로 자동 줄바꿈하고 넘치지 않게 한다.
- 모션 설명 장면 참고: https://github.com/AX-Surfers/llm-motion-graphic.git 을 레포 밖(.worktrees가 아닌 임시 폴더)에 읽기 전용으로 클론해서
  장면 구성·애니메이션 패턴(개념 설명, 흐름도, 단계 등장)을 참고하고, 좋은 패턴을 kit 함수와 scene-code 예시에 반영해.
  라이선스를 확인하고 코드를 그대로 복사하지 말고 패턴만 가져와. 내 스킬 aijjun-concept-motion도 같은 용도로 참고해.
- "ORIGINAL KEEP", 시간 표시, "Verified by …" 같은 디버그·검증 문구는 영상에 넣지 마.
- 흐름 B와 대본 추가 장면은 얼굴 없이 모션그래픽만 쓴다. 내레이션 길이에 맞춰 장면 길이를 정하고(음성 + 0.4초), 자막은 음성 길이에 비례해 구절을 배분해.

════ 5. 보고 (30분 시점, 7줄) ════
1) 배포 URL과 revision
2) 엔드포인트별 실제 호출 결과: voice/clone, plan, script, tts, scene-code, verify — HTTP 상태와 usedModel
3) 흐름 A-편집만 / A-대본추가 / B-처음부터 각각 동작 여부(한 줄씩)
4) 샘플 1개의 입력·출력 길이, 원본 음성·내레이션 유무
5) 폰트(G마켓 산스) 적용 여부
6) 못 한 것과 이유
7) 사용자가 바로 확인할 순서(클릭 경로)
```
