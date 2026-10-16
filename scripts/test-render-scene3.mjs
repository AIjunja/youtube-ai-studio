import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const demoDir = path.join(rootDir, "docs", "demo");

const PORT = 9888;
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const planJson = JSON.parse(fs.readFileSync(path.join(demoDir, "plan-result.json"), "utf8"));
const scene3Code = fs.readFileSync(path.join(demoDir, "scene-3-motion-code.js"), "utf8");
const motionKitBundle = fs.readFileSync(path.join(demoDir, "motionKit.bundle.js"), "utf8");

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === "/log") {
    console.log("[Chrome Log]:", url.searchParams.get("msg"));
    res.writeHead(200);
    res.end("ok");
    return;
  }

  if (url.pathname === "/save-frame") {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => {
      fs.writeFileSync(path.join(demoDir, "test-scene-3.jpg"), Buffer.concat(chunks));
      console.log("Saved test-scene-3.jpg!");
      res.writeHead(200);
      res.end("ok");
    });
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
      res.end(fs.readFileSync(fontPath));
      return;
    }
  }

  if (url.pathname === "/test.html") {
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
    body, html { margin: 0; padding: 0; background: #000; }
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
    window.onunhandledrejection = (e) => {
      fetch('/log?msg=' + encodeURIComponent('PROMISE REJECTION: ' + (e.reason ? (e.reason.stack || e.reason) : e)));
    };

    ${scene3Code.replace("function draw(", "function drawScene3(")}

    window.onload = async () => {
      try {
        await document.fonts.ready;
        fetch('/log?msg=' + encodeURIComponent('Fonts ready'));
        const canvas = document.getElementById('c');
        const ctx = canvas.getContext('2d');
        const kit = window.MotionKitLib ? window.MotionKitLib.createMotionKit(ctx, 0, 1920, 1080) : null;
        const scene3Obj = ${JSON.stringify(planJson.scenes.find(s => s.id === "scene-3-motion"))};
        scene3Obj.durationSec = 7.72;

        fetch('/log?msg=' + encodeURIComponent('Calling drawScene3 at t=2.0'));
        ctx.clearRect(0, 0, 1920, 1080);
        ctx.save();
        drawScene3(ctx, 2.0, 1920, 1080, scene3Obj, kit);
        ctx.restore();
        fetch('/log?msg=' + encodeURIComponent('Finished drawScene3 successfully'));

        const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.95));
        await fetch('/save-frame', { method: 'POST', body: blob });
        fetch('/log?msg=' + encodeURIComponent('Done frame save'));
      } catch (e) {
        fetch('/log?msg=' + encodeURIComponent('Exception in onload: ' + e.stack));
      }
    };
  </script>
</body>
</html>`);
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, async () => {
  console.log("Listening on " + PORT);
  const chrome = spawn(CHROME_PATH, [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--window-size=1920,1080",
    `http://localhost:${PORT}/test.html`
  ]);

  setTimeout(() => {
    chrome.kill();
    server.close();
    process.exit(0);
  }, 4000);
});
