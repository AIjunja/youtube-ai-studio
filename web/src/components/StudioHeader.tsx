import React, { useState } from "react";
import type { HealthResponse } from "../../../shared/contract";

export type StudioNavTab = "dashboard" | "ai-create" | "content" | "analytics";

interface StudioHeaderProps {
  activeTab: StudioNavTab;
  onSelectTab: (tab: StudioNavTab) => void;
  onToggleSidebar: () => void;
  health: HealthResponse | null;
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({
  activeTab,
  onSelectTab,
  onToggleSidebar,
  health,
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <header className="h-16 px-4 bg-[#282828] border-b border-[#3e3e3e] flex items-center justify-between sticky top-0 z-40 select-none">
      {/* Left: Hamburger + Studio Logo + Prototype Badge */}
      <div className="flex items-center gap-3 min-w-[260px]">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="내비게이션 메뉴 토글"
          className="w-10 h-10 rounded-full flex items-center justify-center text-[#ffffff] hover:bg-[#3a3a3a] transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[24px]">menu</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab("dashboard")}
          className="flex items-center gap-2.5 cursor-pointer group text-left"
        >
          <img
            src="/studio/yt_studio_logo_v2_darkmode.svg"
            alt="YouTube Studio"
            className="h-[22px] w-auto object-contain"
          />
        </button>

        <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#7c4dff]/20 to-[#3ea6ff]/20 border border-[#7c4dff]/40 text-[#c9b8ff] font-medium tracking-tight whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-[#3ea6ff] animate-pulse" />
          AI Studio for Creators · Unofficial hackathon prototype
        </span>
      </div>

      {/* Center: Search Bar */}
      <div className="flex-1 max-w-[560px] mx-4">
        <div className="relative flex items-center w-full h-10 rounded-full bg-[#1f1f1f] border border-[#3e3e3e] focus-within:border-[#3ea6ff] px-4 transition-colors">
          <span className="material-symbols-outlined text-[#aaaaaa] text-[20px] mr-3">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="채널 전체에서 검색"
            aria-label="채널 전체에서 검색"
            className="w-full bg-transparent text-[14px] text-white placeholder-[#aaaaaa] focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-[#aaaaaa] hover:text-white cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">
                close
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Right: Argon Health, Ask Studio, Help, Create, Avatar */}
      <div className="flex items-center gap-2">
        {/* Argon Model Badge */}
        <div
          title={
            health
              ? `Model: ${health.model} (${health.renderer})`
              : "Connecting to Argon server..."
          }
          className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1f1f1f] border border-[#3e3e3e] text-[11px] text-[#aaaaaa]"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              health?.ok ? "bg-[#c6ff00]" : "bg-[#3ea6ff]"
            }`}
          />
          <span className="font-mono text-white font-medium">
            {health?.model || "gemini-4-argon"}
          </span>
        </div>

        {/* Ask YouTube Studio pill (from reference screenshot) */}
        <button
          type="button"
          onClick={() => onSelectTab("ai-create")}
          className="hidden lg:flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-[#1f1f1f] hover:bg-[#3a3a3a] border border-[#3e3e3e] text-[13px] font-medium text-white transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px] text-[#3ea6ff]">
            auto_awesome
          </span>
          <span>YouTube 스튜디오에 물어보기</span>
        </button>

        {/* Help Icon */}
        <button
          type="button"
          title="도움말"
          className="w-10 h-10 rounded-full flex items-center justify-center text-[#aaaaaa] hover:text-white hover:bg-[#3a3a3a] transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[22px]">help</span>
        </button>

        {/* Notifications Icon */}
        <button
          type="button"
          title="알림"
          className="hidden sm:flex w-10 h-10 rounded-full items-center justify-center text-[#aaaaaa] hover:text-white hover:bg-[#3a3a3a] transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[22px]">
            notifications
          </span>
        </button>

        {/* CREATE (만들기) Button -> navigates to AI Create */}
        <button
          type="button"
          onClick={() => onSelectTab("ai-create")}
          className={`flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[13px] font-medium transition-all cursor-pointer ${
            activeTab === "ai-create"
              ? "bg-gradient-to-r from-[#7c4dff] to-[#3ea6ff] text-white shadow-md shadow-[#7c4dff]/20"
              : "bg-[#1f1f1f] hover:bg-[#3a3a3a] border border-[#3e3e3e] text-white"
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">
            video_call
          </span>
          <span>만들기</span>
        </button>

        {/* Channel Profile Avatar */}
        <button
          type="button"
          onClick={() => onSelectTab("dashboard")}
          title="AI쭌 | AI 실전 자동화의 모든 것"
          className="ml-1 w-8 h-8 rounded-full overflow-hidden border border-[#3e3e3e] hover:border-[#3ea6ff] transition-colors cursor-pointer shrink-0"
        >
          <img
            src="/studio/channels4_profile.jpg"
            alt="내 채널 프로필"
            className="w-full h-full object-cover"
          />
        </button>
      </div>
    </header>
  );
};
