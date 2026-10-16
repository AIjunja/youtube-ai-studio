import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { API_ENDPOINTS, type HealthResponse } from "../shared/contract.js";
import { MOCK_SCENE_PLAN } from "../shared/mockData.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 8080);
export const ARGON_MODEL = process.env.ARGON_MODEL || "gemini-4-argon";

app.use(cors());
app.use(express.json({ limit: "32mb" }));
app.use(express.urlencoded({ extended: true, limit: "32mb" }));

// GET /api/health
app.get(API_ENDPOINTS.HEALTH, (_req, res) => {
  const payload: HealthResponse = {
    ok: true,
    model: ARGON_MODEL,
    renderer: "browser-canvas-worker",
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  };
  res.json(payload);
});

// Mock fixture endpoint for early local testing
app.get("/api/mock-plan", (_req, res) => {
  res.json(MOCK_SCENE_PLAN);
});

// Serve static built frontend from web/dist
const candidates = [
  path.resolve(process.cwd(), "web/dist"),
  path.resolve(__dirname, "../../web/dist"),
  path.resolve(__dirname, "../web/dist"),
];
const webDistPath =
  candidates.find((p) => fs.existsSync(p)) ||
  path.resolve(process.cwd(), "web/dist");

if (fs.existsSync(webDistPath)) {
  app.use(express.static(webDistPath));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(webDistPath, "index.html"));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `[YouTube AI Studio] Server listening on http://0.0.0.0:${PORT} (model=${ARGON_MODEL})`
  );
});

export default app;
