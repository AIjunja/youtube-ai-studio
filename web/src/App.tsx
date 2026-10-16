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
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);
  const [initialFlow, setInitialFlow] = useState<
    "upload" | "scratch" | "sample" | null
  >(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((data: HealthResponse) => setHealth(data))
      .catch(() => setHealth(null));
  }, []);

  const handleSelectTab = (tab: StudioNavTab) => {
    setActiveTab(tab);
    window.location.hash = tab === "ai-create" ? "#ai-create" : "#dashboard";
  };

  const handleStartAiCreate = (
    flow: "upload" | "scratch" | "sample" = "upload"
  ) => {
    setInitialFlow(flow);
    handleSelectTab("ai-create");
  };

  const handleToggleSidebar = () => {
    if (window.innerWidth <= 600) {
      setMobileDrawerOpen((prev) => !prev);
    } else {
      setSidebarCollapsed((prev) => !prev);
    }
  };

  return (
    <div className="min-h-screen bg-[#1f1f1f] text-[#f1f1f1] flex flex-col font-sans overflow-x-hidden">
      <StudioHeader
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onToggleSidebar={handleToggleSidebar}
        onStartAiFlow={handleStartAiCreate}
        health={health}
      />

      <div className="flex flex-1 min-h-[calc(100vh-64px)]">
        <StudioSidebar
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          collapsed={sidebarCollapsed}
          mobileOpen={mobileDrawerOpen}
          onCloseMobile={() => setMobileDrawerOpen(false)}
        />

        <main className="flex-1 min-w-0 flex flex-col bg-[#1f1f1f]">
          {activeTab === "dashboard" ? (
            <DashboardView onStartAiCreate={handleStartAiCreate} />
          ) : (
            <AiCreateView
              initialFlow={initialFlow}
              onConsumeInitialFlow={() => setInitialFlow(null)}
            />
          )}
        </main>
      </div>
    </div>
  );
}
