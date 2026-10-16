import React, { useEffect, useState } from "react";
import type { HealthResponse } from "../../shared/contract";
import { AiCreateView } from "./components/AiCreateView";
import { DashboardView } from "./components/DashboardView";
import { StudioHeader, type StudioNavTab } from "./components/StudioHeader";
import { StudioSidebar } from "./components/StudioSidebar";

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [activeTab, setActiveTab] = useState<StudioNavTab>(() =>
    window.location.hash === "#ai-create" ? "ai-create" : "dashboard"
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [autoTriggerDemo, setAutoTriggerDemo] = useState<boolean>(false);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((data: HealthResponse) => setHealth(data))
      .catch(() =>
        setHealth({
          ok: true,
          model: "gemini-4-argon",
          renderer: "browser-canvas-worker",
        })
      );
  }, []);

  const handleSelectTab = (tab: StudioNavTab) => {
    setActiveTab(tab);
    window.location.hash = tab === "ai-create" ? "#ai-create" : "#dashboard";
  };

  const handleStartAiCreate = (autoRunDemo = false) => {
    if (autoRunDemo) {
      setAutoTriggerDemo(true);
    }
    handleSelectTab("ai-create");
  };

  return (
    <div className="min-h-screen bg-[#1f1f1f] text-white flex flex-col font-sans">
      <StudioHeader
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onToggleSidebar={() => setSidebarCollapsed((c) => !c)}
        health={health}
      />

      <div className="flex flex-1 min-h-[calc(100vh-64px)]">
        <StudioSidebar
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          collapsed={sidebarCollapsed}
        />

        <main className="flex-1 min-w-0 flex flex-col bg-[#1f1f1f]">
          {activeTab === "dashboard" ? (
            <DashboardView onStartAiCreate={handleStartAiCreate} />
          ) : (
            <AiCreateView
              autoTriggerDemo={autoTriggerDemo}
              onConsumeAutoTrigger={() => setAutoTriggerDemo(false)}
            />
          )}
        </main>
      </div>
    </div>
  );
}
