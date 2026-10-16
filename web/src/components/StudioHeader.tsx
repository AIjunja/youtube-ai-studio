import React, { useEffect, useRef, useState } from "react";
import type { HealthResponse } from "../../../shared/contract";

export type StudioNavTab = "dashboard" | "ai-create" | "content" | "analytics";

interface StudioHeaderProps {
  activeTab: StudioNavTab;
  onSelectTab: (tab: StudioNavTab) => void;
  onToggleSidebar: () => void;
  onStartAiFlow?: (flow: "upload" | "scratch" | "sample") => void;
  health: HealthResponse | null;
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({
  onSelectTab,
  onToggleSidebar,
  onStartAiFlow,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setCreateMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="h-16 px-4 bg-[#282828] border-b border-[#3e3e3e] flex items-center justify-between sticky top-0 z-40 select-none">
      {/* Left: Hamburger + Studio Logo */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="내비게이션 메뉴 토글"
          className="w-10 h-10 rounded-full flex items-center justify-center text-[#f1f1f1] hover:bg-[#323232] transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[24px]">menu</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab("dashboard")}
          className="flex items-center gap-2 cursor-pointer text-left"
        >
          <img
            src="/studio/yt_studio_logo_v2_darkmode.svg"
            alt="YouTube Studio"
            className="h-[22px] w-auto object-contain"
          />
        </button>
      </div>

      {/* Center: Search Bar */}
      <div className="hidden sm:flex flex-1 max-w-[560px] mx-4">
        <div className="relative flex items-center w-full h-10 rounded-[4px] bg-[#181818] border border-[#3e3e3e] focus-within:border-[#3ea6ff] px-3.5 transition-colors">
          <span className="material-symbols-outlined text-[#aaaaaa] text-[20px] mr-3">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="채널 전체에서 검색"
            aria-label="채널 전체에서 검색"
            className="w-full bg-transparent text-[14px] text-[#f1f1f1] placeholder-[#717171] focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-[#aaaaaa] hover:text-[#f1f1f1] cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">
                close
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Right: Help, Create Dropdown, Avatar */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          title="도움말"
          className="hidden sm:flex w-10 h-10 rounded-full items-center justify-center text-[#aaaaaa] hover:text-[#f1f1f1] hover:bg-[#323232] transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[22px]">help</span>
        </button>

        {/* 만들기 Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setCreateMenuOpen((prev) => !prev)}
            className="flex items-center gap-1.5 h-9 px-3.5 rounded-[18px] bg-[#282828] hover:bg-[#323232] border border-[#3e3e3e] text-[14px] font-medium text-[#f1f1f1] transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px] text-[#ff4e45]">
              video_call
            </span>
            <span>만들기</span>
          </button>

          {createMenuOpen && (
            <div className="absolute right-0 mt-2 w-52 bg-[#282828] border border-[#3e3e3e] rounded-[4px] py-1.5 z-50">
              <button
                type="button"
                onClick={() => {
                  setCreateMenuOpen(false);
                  if (onStartAiFlow) {
                    onStartAiFlow("upload");
                  } else {
                    onSelectTab("ai-create");
                  }
                }}
                className="w-full px-4 py-2.5 text-left text-[14px] text-[#f1f1f1] hover:bg-[#323232] flex items-center gap-3 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px] text-[#aaaaaa]">
                  upload
                </span>
                <span>동영상 업로드</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreateMenuOpen(false);
                  if (onStartAiFlow) {
                    onStartAiFlow("upload");
                  } else {
                    onSelectTab("ai-create");
                  }
                }}
                className="w-full px-4 py-2.5 text-left text-[14px] text-[#f1f1f1] hover:bg-[#323232] flex items-center gap-3 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px] text-[#aaaaaa]">
                  movie_edit
                </span>
                <span>AI로 영상 만들기</span>
              </button>
            </div>
          )}
        </div>

        {/* Channel Profile Avatar */}
        <button
          type="button"
          onClick={() => onSelectTab("dashboard")}
          title="AI쭌 | AI 실전 자동화의 모든 것"
          className="ml-1 w-8 h-8 rounded-full overflow-hidden border border-[#3e3e3e] cursor-pointer shrink-0"
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
