import React from "react";

interface DashboardViewProps {
  onStartAiCreate: (flow?: "upload" | "scratch" | "sample") => void;
}

const PUBLISHED_VIDEOS = [
  {
    id: "v1",
    thumbnail: "/studio/mqdefault.jpg",
    title: "정상 사진에 한 줄을 붙이면? AI로 만든 오늘의 정상 #shorts",
    views: "759",
    comments: "1",
    likes: "3",
  },
  {
    id: "v2",
    thumbnail: "/studio/mqdefault(1).jpg",
    title: "현장에서 진짜 원하는 AI 자동화는 이거였다 #shorts",
    views: "178",
    comments: "0",
    likes: "0",
  },
  {
    id: "v3",
    thumbnail: "/studio/mqdefault(2).jpg",
    title: "AI가 배포 완료라길래 열어봤는데 안 됐습니다 #shorts",
    views: "1.3천",
    comments: "1",
    likes: "3",
  },
];

const TOP_CONTENT_48H = [
  {
    title: "정상 사진에 한 줄을 붙이면? AI로 만든 오늘의 정상 #shorts",
    views: "786",
  },
  {
    title: "AI가 너무 빨라서 나만 뒤처진 것 같다면 #shorts",
    views: "690",
  },
  {
    title: "AI가 배포 완료라길래 열어봤는데 안 됐습니다 #shorts",
    views: "168",
  },
];

const RECENT_SUBSCRIBERS = [
  {
    name: "Subscriber A",
    subs: "구독자 2명",
    avatar: "/studio/channels4_profile(1).jpg",
  },
  {
    name: "Subscriber B",
    subs: "구독자 2명",
    avatar: "/studio/unnamed.jpg",
  },
  {
    name: "Subscriber C",
    subs: "구독자 1명",
    avatar: "/studio/unnamed(1).jpg",
  },
];

const RECENT_COMMENTS = [
  {
    author: "@viewer_a",
    time: "2일 전",
    text: "Great video!",
    avatar: "/studio/channels4_profile(2).jpg",
    videoThumb: "/studio/2.jpg",
  },
  {
    author: "@빵지-y5h",
    time: "4개월 전",
    text: "감사해요 😅😅",
    avatar: "/studio/channels4_profile(3).jpg",
    videoThumb: "/studio/default.jpg",
  },
];

export const DashboardView: React.FC<DashboardViewProps> = ({
  onStartAiCreate,
}) => {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 md:px-8 max-w-[1520px] w-full mx-auto">
      {/* Top Page Title & Action Icons */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[20px] font-medium text-[#f1f1f1]">
          채널 대시보드
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onStartAiCreate("upload")}
            title="동영상 업로드"
            className="w-10 h-10 rounded-full bg-[#282828] hover:bg-[#323232] border border-[#3e3e3e] flex items-center justify-center text-[#f1f1f1] transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">
              upload
            </span>
          </button>
          <button
            type="button"
            title="실시간 스트리밍 시작"
            className="w-10 h-10 rounded-full bg-[#282828] hover:bg-[#323232] border border-[#3e3e3e] flex items-center justify-center text-[#f1f1f1] transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">
              sensors
            </span>
          </button>
          <button
            type="button"
            title="게시물 작성"
            className="w-10 h-10 rounded-full bg-[#282828] hover:bg-[#323232] border border-[#3e3e3e] flex items-center justify-center text-[#f1f1f1] transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">
              edit_square
            </span>
          </button>
        </div>
      </div>

      {/* 3-Column Responsive Dashboard Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
        {/* ================= COLUMN 1 ================= */}
        <div className="space-y-6">
          {/* Card 0: AI 편집 (Standard #282828 YouTube Studio Card) */}
          <section className="bg-[#282828] border border-[#3e3e3e] rounded-[8px] p-6">
            <div className="flex items-center gap-2.5 mb-2">
              <span className="material-symbols-outlined text-[20px] text-[#aaaaaa]">
                movie_edit
              </span>
              <h2 className="text-[18px] font-medium text-[#f1f1f1]">
                AI 편집
              </h2>
            </div>
            <p className="text-[14px] text-[#aaaaaa] leading-[20px] mb-5">
              원본 영상을 다듬거나, 내 목소리와 설명 장면을 더해 영상을 완성하세요.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onStartAiCreate("upload")}
                className="px-4 py-2 rounded-[4px] bg-[#3ea6ff] hover:bg-[#65b8ff] text-[#0f0f0f] text-[14px] font-medium transition-colors cursor-pointer"
              >
                새 영상 만들기
              </button>
              <button
                type="button"
                onClick={() => onStartAiCreate("scratch")}
                className="px-3 py-2 rounded-[4px] hover:bg-[#323232] text-[#3ea6ff] text-[14px] font-medium transition-colors cursor-pointer"
              >
                처음부터 만들기
              </button>
            </div>
          </section>

          {/* Card 1: 최신 Shorts 동영상 실적 */}
          <section className="bg-[#282828] border border-[#3e3e3e] rounded-[8px] p-6">
            <h3 className="text-[18px] font-medium text-[#f1f1f1] mb-4">
              최신 Shorts 동영상 실적
            </h3>

            <div className="relative rounded-[4px] overflow-hidden bg-[#181818] aspect-[16/9] mb-3 border border-[#3e3e3e]">
              <img
                src="/studio/sddefault.jpg"
                alt="AI가 너무 빨라서 나만 뒤처진 것 같다면 #shorts"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-black/75 p-3">
                <p className="text-[14px] font-medium text-[#f1f1f1] line-clamp-2 leading-snug">
                  AI가 너무 빨라서 나만 뒤처진 것 같다면 #shorts
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between py-2.5 border-b border-[#3e3e3e] text-[13px] text-[#aaaaaa]">
              <div className="flex items-center gap-4">
                <span className="inline-flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">
                    bar_chart
                  </span>
                  <strong className="text-[#f1f1f1] font-medium">690</strong>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[17px]">
                    chat
                  </span>
                  <span>1</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[17px]">
                    thumb_up
                  </span>
                  <span>1</span>
                </span>
              </div>
              <span className="material-symbols-outlined text-[20px]">
                expand_less
              </span>
            </div>

            <div className="py-3 text-[12px] text-[#aaaaaa]">
              처음 19시간 34분
            </div>

            <div className="space-y-3 text-[14px]">
              <div className="flex items-center justify-between">
                <span className="text-[#aaaaaa]">조회수 순위</span>
                <span className="text-[#f1f1f1] font-medium inline-flex items-center gap-1">
                  5/10
                  <span className="material-symbols-outlined text-[16px] text-[#aaaaaa]">
                    chevron_right
                  </span>
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#aaaaaa]">조회수</span>
                <span className="text-[#f1f1f1] font-medium inline-flex items-center gap-1.5">
                  690
                  <span className="material-symbols-outlined text-[16px] text-[#2ba640]">
                    check_circle
                  </span>
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#aaaaaa]">평균 조회율</span>
                <span className="text-[#f1f1f1] font-medium inline-flex items-center gap-1.5">
                  43.1%
                  <span className="material-symbols-outlined text-[16px] text-[#aaaaaa]">
                    arrow_circle_down
                  </span>
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#aaaaaa]">좋아요</span>
                <span className="text-[#f1f1f1] font-medium inline-flex items-center gap-1.5">
                  1
                  <span className="material-symbols-outlined text-[16px] text-[#2ba640]">
                    check_circle
                  </span>
                </span>
              </div>
            </div>

            <div className="mt-5 pt-2">
              <button
                type="button"
                className="px-4 py-2 rounded-[4px] bg-[#181818] hover:bg-[#323232] border border-[#3e3e3e] text-[14px] font-medium text-[#f1f1f1] transition-colors cursor-pointer"
              >
                동영상 분석으로 이동
              </button>
            </div>
          </section>

          {/* Card 3: 게시된 동영상 */}
          <section className="bg-[#282828] border border-[#3e3e3e] rounded-[8px] p-6">
            <h3 className="text-[18px] font-medium text-[#f1f1f1] mb-4">
              게시된 동영상
            </h3>
            <div className="space-y-4">
              {PUBLISHED_VIDEOS.map((video) => (
                <div
                  key={video.id}
                  className="flex items-start gap-3.5 p-2 -mx-2 rounded-[4px] hover:bg-[#323232] transition-colors"
                >
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-[112px] h-[63px] rounded-[4px] object-cover border border-[#3e3e3e] shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-[#f1f1f1] line-clamp-2 leading-snug">
                      {video.title}
                    </p>
                    <div className="mt-2 flex items-center gap-4 text-[12px] text-[#aaaaaa]">
                      <span className="inline-flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px]">
                          bar_chart
                        </span>
                        {video.views}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px]">
                          chat
                        </span>
                        {video.comments}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px]">
                          thumb_up
                        </span>
                        {video.likes}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ================= COLUMN 2 ================= */}
        <div className="space-y-6">
          {/* Card 2: 채널 분석 */}
          <section className="bg-[#282828] border border-[#3e3e3e] rounded-[8px] p-6">
            <h3 className="text-[18px] font-medium text-[#f1f1f1] mb-2">
              채널 분석
            </h3>
            <div className="text-[12px] text-[#aaaaaa]">현재 구독자 수</div>
            <div className="text-[32px] font-bold text-[#f1f1f1] leading-tight mt-0.5">
              65
            </div>
            <div className="text-[12px] text-[#aaaaaa] mt-1 pb-4 border-b border-[#3e3e3e]">
              지난 28일 동안{" "}
              <span className="text-[#2ba640] font-medium">+9</span> (9 증가)
            </div>

            <div className="py-4 border-b border-[#3e3e3e] space-y-3">
              <div>
                <div className="text-[14px] font-medium text-[#f1f1f1]">
                  요약
                </div>
                <div className="text-[12px] text-[#aaaaaa]">지난 28일</div>
              </div>

              <div className="flex items-center justify-between text-[14px]">
                <span className="text-[#aaaaaa]">조회수</span>
                <span className="text-[#f1f1f1] font-medium inline-flex items-center gap-1.5">
                  1.1만
                  <span className="material-symbols-outlined text-[16px] text-[#2ba640]">
                    arrow_upward
                  </span>
                </span>
              </div>

              <div className="flex items-center justify-between text-[14px]">
                <span className="text-[#aaaaaa]">시청 시간(단위: 시간)</span>
                <span className="text-[#f1f1f1] font-medium inline-flex items-center gap-1.5">
                  142.5
                  <span className="text-[#aaaaaa]">—</span>
                </span>
              </div>
            </div>

            <div className="py-4 space-y-3">
              <div>
                <div className="text-[14px] font-medium text-[#f1f1f1]">
                  인기 동영상
                </div>
                <div className="text-[12px] text-[#aaaaaa]">
                  지난 48시간 · 조회수
                </div>
              </div>

              <div className="space-y-2.5 text-[14px]">
                {TOP_CONTENT_48H.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="text-[#f1f1f1] truncate">{item.title}</span>
                    <span className="text-[#f1f1f1] font-medium shrink-0">
                      {item.views}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Card 4: 최신 게시물 */}
          <section className="bg-[#282828] border border-[#3e3e3e] rounded-[8px] p-6">
            <h3 className="text-[18px] font-medium text-[#f1f1f1] mb-4">
              최신 게시물
            </h3>
            <div className="flex items-center gap-3 mb-3">
              <img
                src="/studio/channels4_profile.jpg"
                alt="AI쭌"
                className="w-9 h-9 rounded-full object-cover border border-[#3e3e3e]"
              />
              <div className="text-[12px]">
                <div className="text-[#f1f1f1] font-medium">
                  AI쭌 | AI 실전 자동화의 모든 것
                </div>
                <div className="text-[#aaaaaa]">2026. 3. 31.</div>
              </div>
            </div>
            <p className="text-[14px] text-[#aaaaaa] leading-[20px] line-clamp-4">
              안녕하세요 ~ AI쭌입니다! 제 채널은 밖에 나가야 사는 사람(저)이,
              일상 속에서 AI를 어떻게 같이 데리고 다니는지 보여주는 채널입니다.
              앞으로 [밖에서 AI해봄] 콘텐츠로 찾아뵙겠습니다 :)
            </p>
          </section>

          {/* Comments Card */}
          <section className="bg-[#282828] border border-[#3e3e3e] rounded-[8px] p-6">
            <h3 className="text-[18px] font-medium text-[#f1f1f1] mb-4">
              댓글
            </h3>
            <div className="space-y-4">
              {RECENT_COMMENTS.map((c, idx) => (
                <div
                  key={idx}
                  className="flex items-start justify-between gap-3 pb-3 border-b border-[#3e3e3e] last:border-b-0 last:pb-0"
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={c.avatar}
                      alt={c.author}
                      className="w-8 h-8 rounded-full object-cover shrink-0"
                    />
                    <div>
                      <div className="text-[12px] text-[#aaaaaa]">
                        <span className="text-[#f1f1f1] font-medium">
                          {c.author}
                        </span>{" "}
                        · {c.time}
                      </div>
                      <p className="text-[14px] text-[#f1f1f1] mt-0.5">
                        {c.text}
                      </p>
                    </div>
                  </div>
                  <img
                    src={c.videoThumb}
                    alt="댓글 영상"
                    className="w-14 h-8 rounded-[4px] object-cover border border-[#3e3e3e] shrink-0"
                  />
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ================= COLUMN 3 ================= */}
        <div className="space-y-6">
          {/* Card 6: 뉴스 */}
          <section className="bg-[#282828] border border-[#3e3e3e] rounded-[8px] p-6">
            <h3 className="text-[18px] font-medium text-[#f1f1f1] mb-4">
              뉴스
            </h3>
            <div className="rounded-[4px] overflow-hidden border border-[#3e3e3e] mb-3.5 bg-[#181818]">
              <img
                src="/studio/90237b301fdecbbeb729196c1fd5008683c77111abc2b3df2696f0ead9f40466_380x170.png"
                alt="Made On YouTube RoundUp"
                className="w-full h-auto object-cover"
              />
            </div>
            <h4 className="text-[14px] font-medium text-[#f1f1f1] leading-snug">
              월간 소식: Made On YouTube 에디션
            </h4>
            <p className="text-[14px] text-[#aaaaaa] mt-1.5 leading-[20px]">
              이번 달 월간 소식을 통해 Made On YouTube의 새로운 기능을 모두
              알아보세요.
            </p>
          </section>

          {/* Card 5: 최근 구독자 */}
          <section className="bg-[#282828] border border-[#3e3e3e] rounded-[8px] p-6">
            <h3 className="text-[18px] font-medium text-[#f1f1f1]">
              최근 구독자
            </h3>
            <p className="text-[12px] text-[#aaaaaa] mt-0.5 mb-4">지난 90일</p>

            <div className="space-y-3.5">
              {RECENT_SUBSCRIBERS.map((sub, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <img
                    src={sub.avatar}
                    alt={sub.name}
                    className="w-9 h-9 rounded-full object-cover border border-[#3e3e3e] shrink-0"
                  />
                  <div>
                    <div className="text-[14px] font-medium text-[#f1f1f1]">
                      {sub.name}
                    </div>
                    <div className="text-[12px] text-[#aaaaaa]">{sub.subs}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
