import React from "react";
import type { StudioNavTab } from "./StudioHeader";

interface StudioSidebarProps {
  activeTab: StudioNavTab;
  onSelectTab: (tab: StudioNavTab) => void;
  collapsed: boolean;
}

interface NavItem {
  id: string;
  label: string;
  icon: string;
  tab?: StudioNavTab;
  isAiFeature?: boolean;
}

const MAIN_NAV_ITEMS: NavItem[] = [
  {
    id: "dashboard",
    label: "대시보드",
    icon: "dashboard",
    tab: "dashboard",
  },
  {
    id: "ai-create",
    label: "✨ AI 제작",
    icon: "auto_awesome",
    tab: "ai-create",
    isAiFeature: true,
  },
  {
    id: "content",
    label: "콘텐츠",
    icon: "smart_display",
    tab: "content",
  },
  {
    id: "analytics",
    label: "분석",
    icon: "insert_chart",
    tab: "analytics",
  },
  {
    id: "community",
    label: "커뮤니티",
    icon: "groups",
  },
  {
    id: "subtitles",
    label: "자막",
    icon: "subtitles",
  },
  {
    id: "copyright",
    label: "저작권",
    icon: "copyright",
  },
  {
    id: "earn",
    label: "수익 창출",
    icon: "monetization_on",
  },
  {
    id: "customization",
    label: "맞춤설정",
    icon: "auto_fix_high",
  },
  {
    id: "audio-library",
    label: "오디오 보관함",
    icon: "library_music",
  },
];

export const StudioSidebar: React.FC<StudioSidebarProps> = ({
  activeTab,
  onSelectTab,
  collapsed,
}) => {
  return (
    <aside
      className={`${
        collapsed ? "w-[72px]" : "w-[255px]"
      } shrink-0 bg-[#282828] border-r border-[#3e3e3e] flex flex-col justify-between transition-[width] duration-200 select-none min-h-[calc(100vh-64px)]`}
    >
      {/* Top Channel Profile + Main Menu */}
      <div className="flex flex-col">
        {/* Channel Avatar Block */}
        <div
          className={`flex flex-col items-center ${
            collapsed ? "py-4 px-2" : "pt-6 pb-4 px-4"
          }`}
        >
          <button
            type="button"
            onClick={() => onSelectTab("dashboard")}
            className="relative group cursor-pointer"
          >
            <img
              src="/studio/channels4_profile.jpg"
              alt="AI쭌 채널 프로필"
              className={`${
                collapsed ? "w-9 h-9" : "w-[112px] h-[112px]"
              } rounded-full object-cover border-2 border-[#3e3e3e] group-hover:border-[#3ea6ff] transition-all`}
            />
            {!collapsed && (
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <span className="material-symbols-outlined text-white text-[24px]">
                  open_in_new
                </span>
              </div>
            )}
          </button>

          {!collapsed && (
            <div className="mt-3 text-center w-full overflow-hidden">
              <div className="text-[15px] font-medium text-white leading-snug">
                내 채널
              </div>
              <div
                className="text-[12px] text-[#aaaaaa] truncate mt-0.5"
                title="AI쭌 | AI 실전 자동화의 모든 것"
              >
                AI쭌 | AI 실전 자동화의 모든 것
              </div>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="px-2 space-y-0.5">
          {MAIN_NAV_ITEMS.map((item) => {
            const isActive = item.tab ? activeTab === item.tab : false;

            if (item.isAiFeature) {
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab("ai-create")}
                  title="✨ AI 제작 (NEW)"
                  className={`w-full flex items-center ${
                    collapsed ? "justify-center px-0 py-3" : "justify-between px-4 py-2.5"
                  } rounded-lg transition-all cursor-pointer relative overflow-hidden group ${
                    isActive
                      ? "bg-gradient-to-r from-[#7c4dff]/25 to-[#3ea6ff]/20 text-white border border-[#7c4dff]/60 shadow-sm shadow-[#7c4dff]/20"
                      : "bg-gradient-to-r from-[#7c4dff]/10 to-[#3ea6ff]/10 hover:from-[#7c4dff]/20 hover:to-[#3ea6ff]/20 text-white border border-[#7c4dff]/30"
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-gradient-to-b from-[#7c4dff] to-[#3ea6ff]" />
                  )}
                  <div
                    className={`flex items-center ${
                      collapsed ? "justify-center" : "gap-4"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[22px] text-[#3ea6ff] group-hover:scale-110 transition-transform">
                      {item.icon}
                    </span>
                    {!collapsed && (
                      <span className="text-[14px] font-semibold tracking-tight bg-gradient-to-r from-white via-[#e2d6ff] to-[#3ea6ff] bg-clip-text text-transparent">
                        {item.label}
                      </span>
                    )}
                  </div>
                  {!collapsed && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-[#7c4dff] to-[#3ea6ff] text-white tracking-wider shadow-sm">
                      NEW
                    </span>
                  )}
                </button>
              );
            }

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.tab === "dashboard") {
                    onSelectTab("dashboard");
                  } else if (item.tab === "content") {
                    onSelectTab("ai-create");
                  } else {
                    onSelectTab("dashboard");
                  }
                }}
                title={item.label}
                className={`w-full flex items-center ${
                  collapsed ? "justify-center px-0 py-3" : "gap-5 px-4 py-2.5"
                } rounded-lg text-[14px] transition-colors cursor-pointer relative ${
                  isActive
                    ? "bg-[#1f1f1f] text-white font-medium"
                    : "text-[#aaaaaa] hover:bg-[#3a3a3a] hover:text-white font-normal"
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-white" />
                )}
                <span
                  className={`material-symbols-outlined text-[22px] ${
                    isActive ? "text-white" : "text-[#aaaaaa]"
                  }`}
                >
                  {item.icon}
                </span>
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Pinned Items: Settings & Send Feedback */}
      <div className="px-2 py-3 border-t border-[#3e3e3e] space-y-0.5">
        <button
          type="button"
          className={`w-full flex items-center ${
            collapsed ? "justify-center px-0 py-2.5" : "gap-5 px-4 py-2.5"
          } rounded-lg text-[14px] text-[#aaaaaa] hover:bg-[#3a3a3a] hover:text-white transition-colors cursor-pointer`}
          title="설정"
        >
          <span className="material-symbols-outlined text-[22px]">
            settings
          </span>
          {!collapsed && <span>설정</span>}
        </button>

        <button
          type="button"
          className={`w-full flex items-center ${
            collapsed ? "justify-center px-0 py-2.5" : "gap-5 px-4 py-2.5"
          } rounded-lg text-[14px] text-[#aaaaaa] hover:bg-[#3a3a3a] hover:text-white transition-colors cursor-pointer`}
          title="의견 보내기"
        >
          <span className="material-symbols-outlined text-[22px]">
            sms_failed
          </span>
          {!collapsed && <span>의견 보내기</span>}
        </button>

        {!collapsed && (
          <div className="px-4 pt-2 pb-1 text-[11px] text-[#717171] flex flex-wrap gap-x-2 gap-y-1">
            <span>이용약관</span>
            <span>·</span>
            <span>개인정보처리방침</span>
            <span>·</span>
            <span>정책 및 안전</span>
          </div>
        )}
      </div>
    </aside>
  );
};
