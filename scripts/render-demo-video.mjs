import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const demoDir = path.join(rootDir, "docs", "demo");
const framesDir = path.join(demoDir, "frames");

const PORT = 9876;
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

// Ensure folders exist
fs.mkdirSync(path.join(framesDir, "scene-3"), { recursive: true });
fs.mkdirSync(path.join(framesDir, "scene-5"), { recursive: true });
fs.mkdirSync(path.join(framesDir, "subtitles"), { recursive: true });

// Read scene codes and plan
const planJson = JSON.parse(fs.readFileSync(path.join(demoDir, "plan-result.json"), "utf8"));
const scene3Code = fs.readFileSync(path.join(demoDir, "scene-3-motion-code.js"), "utf8");
const scene5Code = fs.readFileSync(path.join(demoDir, "scene-5-ending-code.js"), "utf8");
const motionKitBundle = fs.readFileSync(path.join(demoDir, "motionKit.bundle.js"), "utf8");

// Audio durations from ffprobe
const scene3Duration = 7.72;
const scene5Duration = 7.60;
const FPS = 30;

let doneResolverScene3;
const scene3Promise = new Promise((resolve) => { doneResolverScene3 = resolve; });
let doneResolverScene5;
const scene5Promise = new Promise((resolve) => { doneResolverScene5 = resolve; });
let doneResolverSubs;
const subsPromise = new Promise((resolve) => { doneResolverSubs = resolve; });

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === "/log") {
    console.log("[Chrome Log]:", url.searchParams.get("msg"));
    res.writeHead(200);
    res.end("ok");
    return;
  }

  if (url.pathname === "/render.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @font-face {
      font-family: 'GmarketSansBold';
      src: url('/fonts/GmarketSansTTFBold.ttf') format('truetype');
      font-weight: 700;
    }
    @font-face {
      font-family: 'GmarketSansMedium';
      src: url('/fonts/GmarketSansTTFMedium.ttf') format('truetype');
      font-weight: 500;
    }
    body, html { margin: 0; padding: 0; background: #000; overflow: hidden; }
    canvas { width: 1920px; height: 1080px; }
  </style>
  <script src="/motionKit.bundle.js"></script>
</head>
<body>
  <canvas id="c" width="1920" height="1080"></canvas>
  <script>
    window.onerror = (msg, src, line, col, err) => {
      fetch('/log?msg=' + encodeURIComponent('ERROR: ' + msg + ' (' + line + ':' + col + ') ' + (err ? err.stack : '')));
    };

    // Injected draw functions
    ${scene3Code.replace("function draw(", "function drawScene3(")}
    ${scene5Code.replace("function draw(", "function drawScene5(")}

    window.onload = async () => {
      await document.fonts.ready;
      console.log('Fonts loaded');
      fetch('/log?msg=Fonts loaded');
      const canvas = document.getElementById('c');
      const ctx = canvas.getContext('2d');

      const kit = window.MotionKitLib ? window.MotionKitLib.createMotionKit(ctx, 0, 1920, 1080) : null;

      // 1. Render Subtitle Overlays for Scenes 1, 2, 4
      const subs = [
        { id: 'sub-1', text: 'AI를 일상에! AI쭌입니다' },
        { id: 'sub-2', text: '특별한 목적지: 구글 스타트업 캠퍼스' },
        { id: 'sub-4', text: '구글 딥마인드 X 어텐션' },
      ];

      for (const s of subs) {
        ctx.clearRect(0, 0, 1920, 1080);
        // Draw subtitle overlay
        const barW = 1520;
        const barH = 118;
        const bx = (1920 - barW) * 0.5;
        const by = 1080 - 96 - barH;

        ctx.fillStyle = 'rgba(14, 14, 16, 0.94)';
        ctx.fillRect(bx, by, barW, barH);

        ctx.fillStyle = '#D7FF3A'; // lime
        ctx.fillRect(bx, by, 14, barH);

        ctx.fillStyle = '#FAFAF8';
        ctx.font = 'bold 44px "GmarketSansBold", "Pretendard", sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText(s.text, bx + 44, by + barH / 2);

        const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
        await fetch('/frame?type=sub&id=' + s.id, { method: 'POST', body: blob });
      }
      await fetch('/done?scene=subtitles');

      // 2. Render Scene 3 Motion Graphic
      console.log('Rendering Scene 3...');
      const scene3Obj = ${JSON.stringify(planJson.scenes.find(s => s.id === "scene-3-motion"))};
      scene3Obj.durationSec = ${scene3Duration};
      const totalFrames3 = Math.ceil(${scene3Duration} * ${FPS});

      for (let f = 0; f < totalFrames3; f++) {
        const t = f / ${FPS};
        ctx.clearRect(0, 0, 1920, 1080);
        ctx.save();
        drawScene3(ctx, t, 1920, 1080, scene3Obj, kit);
        ctx.restore();

        const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.92));
        await fetch('/frame?scene=scene-3&frame=' + f, { method: 'POST', body: blob });
      }
      await fetch('/done?scene=scene-3');

      // 3. Render Scene 5 Ending Graphic
      console.log('Rendering Scene 5...');
      const scene5Obj = ${JSON.stringify(planJson.scenes.find(s => s.id === "scene-5-ending"))};
      scene5Obj.durationSec = ${scene5Duration};
      const totalFrames5 = Math.ceil(${scene5Duration} * ${FPS});

      for (let f = 0; f < totalFrames5; f++) {
        const t = f / ${FPS};
        ctx.clearRect(0, 0, 1920, 1080);
        ctx.save();
        drawScene5(ctx, t, 1920, 1080, scene5Obj, kit);
        ctx.restore();

        const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.92));
        await fetch('/frame?scene=scene-5&frame=' + f, { method: 'POST', body: blob });
      }
      await fetch('/done?scene=scene-5');
      console.log('All rendering finished in browser!');
    };
  </script>
</body>
</html>`);
    return;
  }

  if (url.pathname === "/motionKit.bundle.js") {
    res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
    res.end(motionKitBundle);
    return;
  }

  if (url.pathname.startsWith("/fonts/")) {
    const fontFile = path.basename(url.pathname);
    const fontPath = path.join(rootDir, "web", "public", "fonts", fontFile);
    if (fs.existsSync(fontPath)) {
      res.writeHead(200, { "Content-Type": "font/ttf" });
      fs.createReadStream(fontPath).pipe(res);
      return;
    }
  }

  if (url.pathname === "/frame" && req.method === "POST") {
    const type = url.searchParams.get("type");
    if (type === "sub") {
      const subId = url.searchParams.get("id");
      const outPath = path.join(framesDir, "subtitles", `${subId}.png`);
      const fileStream = fs.createWriteStream(outPath);
      req.pipe(fileStream);
      req.on("end", () => {
        res.writeHead(200);
        res.end("ok");
      });
      return;
    }

    const scene = url.searchParams.get("scene");
    const frameIndex = parseInt(url.searchParams.get("frame") || "0", 10);
    const padded = String(frameIndex).padStart(5, "0");
    const outPath = path.join(framesDir, scene, `${padded}.jpg`);
    const fileStream = fs.createWriteStream(outPath);
    req.pipe(fileStream);
    req.on("end", () => {
      res.writeHead(200);
      res.end("ok");
    });
    return;
  }

  if (url.pathname === "/done") {
    const scene = url.searchParams.get("scene");
    console.log(`[Renderer] Received done for: ${scene}`);
    if (scene === "subtitles") doneResolverSubs();
    if (scene === "scene-3") doneResolverScene3();
    if (scene === "scene-5") doneResolverScene5();
    res.writeHead(200);
    res.end("ok");
    return;
  }

  res.writeHead(404);
  res.end("not found");
});

server.listen(PORT, async () => {
  console.log(`Server listening at http://localhost:${PORT}`);

  console.log("Launching headless Chrome...");
  const chrome = spawn(CHROME_PATH, [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--window-size=1920,1080",
    `http://localhost:${PORT}/render.html`,
  ], { stdio: "ignore" });

  console.log("Waiting for frames to be rendered...");
  await subsPromise;
  console.log("✓ Subtitles rendered");
  await scene3Promise;
  console.log("✓ Scene 3 frames rendered");
  await scene5Promise;
  console.log("✓ Scene 5 frames rendered");

  console.log("Closing Chrome...");
  chrome.kill();
  server.close();

  console.log("Beginning FFmpeg composition pipeline...");
  await runFfmpegPipeline();
});

function execCmd(cmd, args) {
  return new Promise((resolve, reject) => {
    console.log(`[ffmpeg] ${cmd} ${args.join(" ")}`);
    const proc = spawn(cmd, args, { stdio: "inherit" });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
  });
}

async function runFfmpegPipeline() {
  const videoInput = path.join(demoDir, "real-take-20s.mp4");
  const sub1 = path.join(framesDir, "subtitles", "sub-1.png").replace(/\\/g, "/");
  const sub2 = path.join(framesDir, "subtitles", "sub-2.png").replace(/\\/g, "/");
  const sub4 = path.join(framesDir, "subtitles", "sub-4.png").replace(/\\/g, "/");

  const part1 = path.join(demoDir, "part-1.mp4");
  const part2 = path.join(demoDir, "part-2.mp4");
  const part3 = path.join(demoDir, "part-3.mp4");
  const part4 = path.join(demoDir, "part-4.mp4");
  const part5 = path.join(demoDir, "part-5.mp4");
  const finalOutput = path.join(demoDir, "final-output.mp4");

  // Part 1: Keep 1 (03.0s ~ 08.9s)
  console.log("=== Encoding Part 1 (Original Scene 1) ===");
  await execCmd("ffmpeg", [
    "-y",
    "-ss", "3.0",
    "-to", "8.9",
    "-i", videoInput,
    "-i", sub1,
    "-filter_complex",
    "[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,fps=30[scaled];[scaled][1:v]overlay=0:0[v]",
    "-map", "[v]",
    "-map", "0:a",
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "192k",
    "-ar", "48000",
    "-ac", "2",
    part1,
  ]);

  // Part 2: Keep 2 (09.4s ~ 17.5s)
  console.log("=== Encoding Part 2 (Original Scene 2) ===");
  await execCmd("ffmpeg", [
    "-y",
    "-ss", "9.4",
    "-to", "17.5",
    "-i", videoInput,
    "-i", sub2,
    "-filter_complex",
    "[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,fps=30[scaled];[scaled][1:v]overlay=0:0[v]",
    "-map", "[v]",
    "-map", "0:a",
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "192k",
    "-ar", "48000",
    "-ac", "2",
    part2,
  ]);

  // Part 3: Argon Motion Scene 3
  console.log("=== Encoding Part 3 (Argon Motion Scene 3) ===");
  const framesPattern3 = path.join(framesDir, "scene-3", "%05d.jpg");
  const audio3 = path.join(demoDir, "scene-3-clean-tts.wav");
  await execCmd("ffmpeg", [
    "-y",
    "-framerate", "30",
    "-i", framesPattern3,
    "-i", audio3,
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "192k",
    "-ar", "48000",
    "-ac", "2",
    "-shortest",
    part3,
  ]);

  // Part 4: Keep 3 (18.0s ~ 20.0s)
  console.log("=== Encoding Part 4 (Original Scene 4) ===");
  await execCmd("ffmpeg", [
    "-y",
    "-ss", "18.0",
    "-to", "20.0",
    "-i", videoInput,
    "-i", sub4,
    "-filter_complex",
    "[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,fps=30[scaled];[scaled][1:v]overlay=0:0[v]",
    "-map", "[v]",
    "-map", "0:a",
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "192k",
    "-ar", "48000",
    "-ac", "2",
    part4,
  ]);

  // Part 5: Argon Ending Card Scene 5
  console.log("=== Encoding Part 5 (Argon Ending Scene 5) ===");
  const framesPattern5 = path.join(framesDir, "scene-5", "%05d.jpg");
  const audio5 = path.join(demoDir, "scene-5-clean-tts.wav");
  await execCmd("ffmpeg", [
    "-y",
    "-framerate", "30",
    "-i", framesPattern5,
    "-i", audio5,
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "192k",
    "-ar", "48000",
    "-ac", "2",
    "-shortest",
    part5,
  ]);

  // Concatenate all 5 parts seamlessly with filter_complex concat
  console.log("=== Concatenating all 5 parts with filter_complex into final-output.mp4 ===");
  await execCmd("ffmpeg", [
    "-y",
    "-i", part1,
    "-i", part2,
    "-i", part3,
    "-i", part4,
    "-i", part5,
    "-filter_complex",
    "[0:v][0:a][1:v][1:a][2:v][2:a][3:v][3:a][4:v][4:a]concat=n=5:v=1:a=1[v][a]",
    "-map", "[v]",
    "-map", "[a]",
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "192k",
    finalOutput,
  ]);

  console.log(`\n========================================`);
  console.log(`🎉 SUCCESS! Final video saved to:`);
  console.log(`${finalOutput}`);
  console.log(`========================================\n`);

  await execCmd("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration,size,bit_rate:stream=codec_name,width,height,r_frame_rate",
    "-of", "default=noprint_wrappers=1",
    finalOutput,
  ]);
}
