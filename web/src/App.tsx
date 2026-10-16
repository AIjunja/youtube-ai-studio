import React, { useEffect, useState } from "react";
import type { HealthResponse } from "../../shared/contract";
import { MOCK_SCENE_PLAN } from "../../shared/mockData";

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((data: HealthResponse) => setHealth(data))
      .catch(() =>
        setHealth({
          ok: false,
          model: "gemini-4-argon",
          renderer: "browser-canvas-worker",
        })
      );
  }, []);

  return (
    <div className="min-h-screen bg-[#1f1f1f] text-white flex flex-col">
      <header className="h-16 px-6 border-b border-[#3e3e3e] bg-[#282828] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/studio/yt_studio_logo_v2_darkmode.svg"
            alt="Studio"
            className="h-6"
          />
          <span className="text-xs px-2 py-0.5 rounded bg-[#3ea6ff]/20 text-[#3ea6ff] font-medium">
            AI Studio for Creators · Unofficial Hackathon Prototype
          </span>
        </div>
        <div className="text-xs text-[#aaaaaa]">
          {health
            ? `Model: ${health.model} · Status: ${health.ok ? "ONLINE" : "OFFLINE"}`
            : "Checking /api/health..."}
        </div>
      </header>
      <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
        <h1 className="text-2xl font-bold mb-2">
          YouTube AI Studio — Just Record. AI Does the Rest.
        </h1>
        <p className="text-sm text-[#aaaaaa] mb-6">
          Mock ScenePlan ready ({MOCK_SCENE_PLAN.scenes.length} scenes,{" "}
          {MOCK_SCENE_PLAN.gaps.length} explanation gaps detected).
        </p>
      </main>
    </div>
  );
}
