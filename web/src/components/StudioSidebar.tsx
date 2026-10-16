import React from "react";
import type { StudioNavTab } from "./StudioHeader";

interface StudioSidebarProps {
  activeTab: StudioNavTab;
  onSelectTab: (tab: StudioNavTab) => void;
  collapsed: boolean;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: string;
  tab?: StudioNavTab;
}

const MAIN_NAV_ITEMS: NavItem[] = [
  {
    id: "dashboard",
    label: "대시보드",
    icon: "dashboard",
    tab: "dashboard",
  },
  {
    id: "content",
    label: "콘텐츠",
    icon: "smart_display",
    tab: "content",
  },
  {
    id: "ai-create",
    label: "AI 편집",
    icon: "movie_edit",
    tab: "ai-create",
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
  mobileOpen = false,
  onCloseMobile,
}) => {
  const renderNavContent = (isIconOnly: boolean, isMobileDrawer: boolean) => (
    <>
      <div className="flex flex-col">
        {/* Channel Avatar Block */}
        <div
          className={`flex flex-col items-center ${
            isIconOnly ? "py-4 px-2" : "pt-6 pb-4 px-4"
          }`}
        >
          <button
            type="button"
            onClick={() => {
              onSelectTab("dashboard");
              onCloseMobile?.();
            }}
            className="relative cursor-pointer"
          >
            <img
              src="/studio/channels4_profile.jpg"
              alt="AI쭌 채널 프로필"
              className={`${
                isIconOnly ? "w-9 h-9" : "w-[112px] h-[112px]"
              } rounded-full object-cover border border-[#3e3e3e]`}
            />
          </button>

          {!isIconOnly && (
            <div className="mt-3 text-center w-full overflow-hidden">
              <div className="text-[14px] font-medium text-[#f1f1f1] leading-snug">
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
        <nav className="space-y-0.5">
          {MAIN_NAV_ITEMS.map((item) => {
            const isActive = item.tab ? activeTab === item.tab : false;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.tab === "dashboard") {
                    onSelectTab("dashboard");
                  } else if (item.tab === "ai-create" || item.tab === "content") {
                    onSelectTab("ai-create");
                  } else {
                    onSelectTab("dashboard");
                  }
                  if (isMobileDrawer) {
                    onCloseMobile?.();
                  }
                }}
                title={item.label}
                className={`w-full flex items-center ${
                  isIconOnly ? "justify-center px-0 py-3" : "gap-5 px-5 py-2.5"
                } text-[14px] transition-colors cursor-pointer relative ${
                  isActive
                    ? "bg-[#1f1f1f] text-[#f1f1f1] font-medium border-l-[3px] border-[#ff4e45]"
                    : "text-[#aaaaaa] hover:bg-[#323232] hover:text-[#f1f1f1] font-normal border-l-[3px] border-transparent"
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[22px] ${
                    isActive ? "text-[#ff4e45]" : "text-[#aaaaaa]"
                  }`}
                >
                  {item.icon}
                </span>
                {!isIconOnly && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Pinned Items */}
      <div className="py-3 border-t border-[#3e3e3e] space-y-0.5">
        <button
          type="button"
          className={`w-full flex items-center ${
            isIconOnly ? "justify-center px-0 py-2.5" : "gap-5 px-5 py-2.5"
          } text-[14px] text-[#aaaaaa] hover:bg-[#323232] hover:text-[#f1f1f1] transition-colors cursor-pointer`}
          title="설정"
        >
          <span className="material-symbols-outlined text-[22px]">
            settings
          </span>
          {!isIconOnly && <span>설정</span>}
        </button>

        <button
          type="button"
          className={`w-full flex items-center ${
            isIconOnly ? "justify-center px-0 py-2.5" : "gap-5 px-5 py-2.5"
          } text-[14px] text-[#aaaaaa] hover:bg-[#323232] hover:text-[#f1f1f1] transition-colors cursor-pointer`}
          title="의견 보내기"
        >
          <span className="material-symbols-outlined text-[22px]">
            sms_failed
          </span>
          {!isIconOnly && <span>의견 보내기</span>}
        </button>

        {!isIconOnly && (
          <div className="px-5 pt-2 pb-1 text-[11px] text-[#717171] flex flex-wrap gap-x-2 gap-y-1">
            <span>이용약관</span>
            <span>·</span>
            <span>개인정보처리방침</span>
            <span>·</span>
            <span>정책 및 안전</span>
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop (>1024px): full width unless collapsed */}
      <aside
        className={`hidden lg:flex ${
          collapsed ? "w-[72px]" : "w-[240px]"
        } shrink-0 bg-[#282828] border-r border-[#3e3e3e] flex-col justify-between select-none min-h-[calc(100vh-64px)]`}
      >
        {renderNavContent(collapsed, false)}
      </aside>

      {/* Tablet (601px~1024px): always collapsed 72px icon bar */}
      <aside className="hidden sm:flex lg:hidden w-[72px] shrink-0 bg-[#282828] border-r border-[#3e3e3e] flex-col justify-between select-none min-h-[calc(100vh-64px)]">
        {renderNavContent(true, false)}
      </aside>

      {/* Mobile (<=600px): Drawer overlay when mobileOpen is true */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex sm:hidden">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={onCloseMobile}
          />
          <aside className="relative z-10 w-[240px] max-w-[80vw] bg-[#282828] border-r border-[#3e3e3e] flex flex-col justify-between select-none h-full overflow-y-auto">
            {renderNavContent(false, true)}
          </aside>
        </div>
      )}
    </>
  );
};
