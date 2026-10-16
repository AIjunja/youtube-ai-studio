# Project Description (Submission Copy)

## Short Pitch (One-Liner)
**YouTube AI Studio — Just Record. AI Does the Rest.** Upload a 10–20s raw creator clip, and Gemini 4 Argon automatically cuts retakes, detects missing explanations, writes and sandboxes custom HTML5 Canvas 2D motion graphics code, visually verifies rendered keyframes, and exports a finished video.

## Detailed Description (English)
Solo creators and educators spend hours cutting out claps, retakes, and silences, and even more time building motion graphics to visually explain concepts they only mentioned verbally on camera.

**YouTube AI Studio** embeds an autonomous **Argon Director** directly inside a YouTube Studio-inspired creator interface (**Upload → AI Create → Verify → Download**), powered by **Gemini 4 Argon** (`ARGON_MODEL=gemini-4-argon`) and hosted on **Google Cloud Run**.

### How Gemini 4 Argon Powers the 4-Stage Closed Loop
1. **Multimodal Video Planning (`/api/plan`):** Using `@google/genai`, Argon analyzes the uploaded raw video file (audio + visual frames) to extract a timestamped transcript, identify NG/retake/silence segments (`cuts` with confidence scores where `< 0.7` is kept as a non-destructive suggestion), and discover **Explanation Gaps (`gaps`)** where viewers need a visual diagram or comparison card. It outputs a schema-validated `ScenePlan` JSON and isolates any unverified claims into `uncertainFacts`.
2. **Deterministic Motion Graphic Code Generation (`/api/scene-code`):** For each inserted `motion` and `ending` scene, Argon writes a pure JavaScript HTML5 Canvas 2D rendering function `draw(ctx, t, w, h, scene)` tailored to the creator's exact topic—creating kinetic typography, side-by-side comparison cards, and step-by-step architecture flowcharts without external libraries.
3. **Web Worker Sandbox & Code Self-Repair (`/api/fix-code`):** Generated code is statically checked and executed inside an isolated **Web Worker + `OffscreenCanvas`** sandbox (network APIs stripped, 2-second frame timeout, and pixel sampling at `t=0.5s` and `t=duration/2` to catch blank frames). If an error or blank frame occurs, the stack trace is sent to `/api/fix-code` for up to 2 automatic repair cycles, backed by 6 deterministic Canvas fallback templates so export never fails.
4. **Multimodal Visual Verification & Live Scene Revision (`/api/verify`, `/api/revise`):** Rendered keyframe images from each motion scene are passed back to Argon multimodally to verify text legibility, layout balance, and script alignment (`source`, `attempts`, and `verified` badges are displayed per scene). Creators can click any scene and type natural-language instructions (e.g., *"make this simpler"*) to regenerate and re-verify that scene in real time before exporting the final composite video (with audio and subtitles) via `MediaRecorder`.

### Tech Stack
- **AI / Multimodal & Coding Engine:** Google Gemini API (`@google/genai`, `ARGON_MODEL=gemini-4-argon` with resilient fallback and Zod schema validation)
- **Frontend & Renderer:** React 19, TypeScript, Tailwind CSS v4, HTML5 Canvas 2D, Web Worker + `OffscreenCanvas` sandbox, `MediaRecorder` + WebAudio synthesizer
- **Backend & Cloud:** Node.js 22, Express, Multer, deployed as a single containerized service on **Google Cloud Run** (`asia-northeast3`)
