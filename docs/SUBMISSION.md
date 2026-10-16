# 제출 폼 초안 (v2)

## Team Name
AIJunJa

## Project Description + Google Cloud Link
(아래 코드블록 안 텍스트를 그대로 붙여넣기. [ ] 부분은 최종 배포 후 확인)

```
YouTube AI Studio — Just record. AI does the rest.

Live on Google Cloud Run: [https://youtube-ai-studio-877956401307.asia-northeast3.run.app]

Not YouTube Studio. YouTube AI Studio: an "AI Edit" workflow built into the YouTube Studio experience creators already know.

WHY WE BUILT IT
Two groups of people are locked out of making videos today.
1) People who never start. They have knowledge and stories worth sharing, but cutting retakes, writing the part they forgot to explain, and building motion graphics feels impossible — so the first video never gets posted.
2) People who can only automate editing if they code. Even with today's AI, automated editing means driving coding agents and motion frameworks, and knowing a professional editing playbook to get a good result.
We wanted to take that wall down. In YouTube AI Studio, all you need is your footage — or just your voice and a well-planned script — to make your video and publish it.

HOW IT WORKS
Register your voice once (with explicit consent). Then choose one of three paths:
- Edit only: upload a raw take. The app cuts retakes, filler and dead air, adds captions and motion graphics, and returns a polished video.
- Add a script: Gemini 4 Argon finds the explanation you skipped, writes the missing script, and the app narrates it in your cloned voice over new, face-free motion-graphic scenes appended to your edited take.
- Start from scratch: no footage at all. Type a topic, Argon writes the script, your voice narrates it, and motion graphics tell the story.
Review the captions and scenes, ask for changes in plain words ("make this simpler"), and download the finished video.

HOW GEMINI IS USED
- Gemini 4 Argon — multimodal understanding: watches and listens to the raw video and returns a structured plan (transcript, cuts with reasons, missing-explanation gaps).
- Gemini 4 Argon — writing: drafts the missing script, or a full script from a topic.
- Gemini 4 Argon — coding: writes the rendering code for every motion-graphic scene through a design kit that enforces typography, layout and pacing rules taken from a working creator's editing playbook.
- Gemini 4 Argon — verification loop: the generated code runs in an isolated browser sandbox; errors and blank frames go back to Argon for repair (max 2 attempts, then a safe template), and Argon inspects the rendered frames to check readability and script match. The app shows which model actually responded, how many attempts it took, and whether each check passed. Failures are shown, not hidden.
- Gemini 3.8 Flash TTS with voice replication narrates new scenes in the creator's own voice.
Built with Google Antigravity and deployed as a single service on Google Cloud Run.

WHERE IT GOES
- Business model: an AI Edit perk for YouTube Premium members, or a few free videos for new creators with more credits for fast-growing channels.
- Next (not yet implemented): one-click publishing straight to the creator's channel with an AI-written title and description, longer videos with server-side rendering on Cloud Run Jobs, and learning each channel's own style.

Saving creators time, with AI and technology. — AI쭌 (AIJunJa)

Unofficial hackathon prototype, not affiliated with YouTube.
```

## Public GitHub Repository
https://github.com/AIjunja/youtube-ai-studio   ← 제출 전 Public 전환(비밀값 스캔 후)

## Demo Video
[YouTube 일부공개(Unlisted) 링크]
