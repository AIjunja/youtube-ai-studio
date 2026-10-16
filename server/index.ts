import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { API_ENDPOINTS, type HealthResponse } from "../shared/contract.js";
import { getArgonModel, getTtsModel, hasApiKey } from "./argonClient.js";
import { apiRouter } from "./routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 8080);

app.use(cors());
app.use(express.json({ limit: "45mb" }));
app.use(express.urlencoded({ extended: true, limit: "45mb" }));

// Health check endpoint
app.get(API_ENDPOINTS.HEALTH, (_req, res) => {
  const payload: HealthResponse = {
    ok: true,
    model: getArgonModel(),
    ttsModel: getTtsModel(),
    renderer: "canvas2d-mediabunny",
    hasApiKey: hasApiKey(),
    timestamp: new Date().toISOString(),
  };
  res.json(payload);
});

// Mount all AI pipeline API routes (/api/plan, /api/scene-code, /api/fix-code, /api/verify, /api/revise, /api/voice/clone, /api/script, /api/tts)
app.use(apiRouter);

// Serve static build in production
// When root is 'web' and outDir is 'dist', Vite places files at web/dist (or root/dist).
// In compiled dist/server/index.js, __dirname is dist/server.
const candidatePaths = [
  path.resolve(__dirname, "../../web/dist"),
  path.resolve(__dirname, "../web"),
  path.resolve(process.cwd(), "web/dist"),
  path.resolve(process.cwd(), "dist/web"),
  path.resolve(process.cwd(), "dist"),
];

const resolvedWebPath =
  candidatePaths.find((p) => fs.existsSync(path.join(p, "index.html"))) ||
  path.resolve(process.cwd(), "web/dist");

console.log(`[server] Serving static web from: ${resolvedWebPath} (exists: ${fs.existsSync(resolvedWebPath)})`);

app.use(express.static(resolvedWebPath));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    next();
    return;
  }
  const indexPath = path.join(resolvedWebPath, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res
      .status(200)
      .send("YouTube AI Studio API Server Running. (index.html not found)");
  }
});

app.listen(PORT, () => {
  console.log(
    `[server] YouTube AI Studio listening on http://localhost:${PORT} (model=${getArgonModel()}, ttsModel=${getTtsModel()}, hasApiKey=${hasApiKey()})`
  );
});
