import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
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
const distWebPath = path.resolve(__dirname, "../../dist/web");
app.use(express.static(distWebPath));

app.get("/{*splat}", (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    next();
    return;
  }
  res.sendFile(path.join(distWebPath, "index.html"), (err) => {
    if (err) {
      res
        .status(200)
        .send("YouTube AI Studio API Server Running. Start Vite on :5173 for dev.");
    }
  });
});

app.listen(PORT, () => {
  console.log(
    `[server] YouTube AI Studio listening on http://localhost:${PORT} (model=${getArgonModel()}, ttsModel=${getTtsModel()}, hasApiKey=${hasApiKey()})`
  );
});
