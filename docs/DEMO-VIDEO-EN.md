# Demo Video Plan (English) — 3:00 이내, 2분 한국어 원본(real-take.mp4) 기준

## 원칙
- 원본 촬영은 한국어 OK. **내레이션과 화면 자막은 영어.** 한국어 UI·한국어 말이 나오는 순간에는 하단에 영어 자막 박스.
- **Cloud Run URL 주소창이 보이게** 녹화.
- 2분 원본을 다 보여주지 않는다. "전/후"가 확실한 순간 3개만 보여준다: ① NG가 잘린 곳 ② 빠진 설명 자리에 생긴 AI 장면(내 목소리) ③ 자막.
- 기다리는 구간은 빨리 감고 "sped up ×N"을 표기한다(정직성).

## 타임라인 (총 2:55)
| 시간 | 화면 | 영어 내레이션 |
|---|---|---|
| **0:00–0:12 훅** | 완성본 중 가장 멋진 AI 모션 장면 3초 → 컷 → 날것 원본 3초 | "This scene was never filmed. AI made it — in my own voice." |
| **0:12–0:30 문제** | 대시보드(주소창 Cloud Run URL 보이게) | "Millions of people want to start a YouTube channel but never post. The barrier isn't the camera — it's editing: cutting retakes, writing what you forgot to explain, and building motion graphics." |
| **0:30–0:45 내 목소리** | [만들기] → AI로 영상 만들기 → 내 목소리: 샘플 업로드, 동의 체크, 복제 완료 | "First, I register my voice once, with consent. Gemini 3.8 Flash TTS replicates it." |
| **0:45–1:00 업로드·선택** | 2분 원본 업로드 → 완성 방식 카드 2개 → [대본 추가해서 완성] | "I upload a two-minute take straight from my camera, and choose: just edit it, or let AI fill in what I didn't say." |
| **1:00–1:25 AI 제작 (×6 빨리감기)** | 체크리스트가 하나씩 완료: 받아쓰기 → 컷 → 빠진 설명 → 대본 → 내 목소리 → 장면 생성 → 화면 확인 | "Gemini 4 Argon watches and listens to the whole video. It transcribes it, finds retakes and dead air, and spots where my explanation is missing. Then it writes that script, and it's read in my voice." |
| **1:25–1:45 Argon 증거** | 검토 → [AI 작업 기록] 펼치기 → 실제 모델명(gemini-4-argon), 시도 횟수, 검증 결과 클로즈업 | "Each new scene is code written by Argon. It runs in a sandbox; if it breaks, Argon fixes it, then inspects the rendered frames itself. Every step shows the real model and the result — nothing is faked." |
| **1:45–2:00 전/후 ① 컷** | 원본⇄완성본 토글: NG 구간이 사라진 지점 | "Before… and after. The retake is gone." |
| **2:00–2:25 전/후 ② AI 장면** | 빠진 설명 자리에 들어간 모션그래픽 장면(내 목소리 내레이션, 자막) — 소리 그대로 | (내레이션 없이 완성본 소리를 들려준다) |
| **2:25–2:38 수정** | 장면 하나 [더 쉽게] → 그 장면만 다시 생성(빨리감기) | "Want it simpler? Just ask." |
| **2:38–2:55 마무리** | [다운로드] → 엔딩 카드: "YouTube AI Studio — Just record. AI does the rest." + Cloud Run URL + "Built with Gemini 4 Argon · Gemini 3.8 Flash TTS · Google Cloud Run" | "From first recording to first upload. Just record — AI does the rest." |

## 녹화 체크리스트 (14:25~14:50)
1. 해상도 1920×1080, 브라우저 확대 100%, 알림 끄기. OBS 또는 Win+Alt+R.
2. **1회 통째로 녹화**(업로드부터 다운로드까지, 대기 포함) → 편집에서 잘라 쓴다. 다시 찍을 시간 없음.
3. 내레이션은 녹화 후 따로 녹음(폰 녹음도 OK) → 편집에서 얹기. 시간 없으면 영어 자막만으로도 OK.
4. 다운로드한 완성본 MP4는 따로 백업(라이브 데모 백업용).
5. 훅(0:00–0:12)에 쓸 장면은 완성본에서 가져온다.

## 편집 (14:50~15:05)
- CapCut/Clipchamp 등 익숙한 도구로: 컷 → 빨리감기 구간 속도 조절 + "sped up ×6" 텍스트 → 영어 자막 → 내레이션.
- YouTube 업로드: 제목 "YouTube AI Studio — Just record. AI does the rest. (Google DeepMind AI Hackathon)", **일부공개(Unlisted)**.
- 업로드 직후 링크를 시크릿 창에서 열어 재생되는지 확인.
