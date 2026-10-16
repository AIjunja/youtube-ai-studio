# Layout reference — YouTube-Studio-style shell (extracted from a saved dashboard page)

Use this as a visual/structural reference only. Do NOT reproduce YouTube logos, scripts or trademarks.
Product name shown in the app: "AI Studio for Creators" with a small "Unofficial hackathon prototype" label.

## Global shell (dark theme)
- Top bar (64px): hamburger icon, product logo + name (left); centered search field "Search across your channel";
  right: help icon, "CREATE" outlined button, round avatar.
- Left navigation drawer (~255px, collapsible to 72px icons):
  - Top: large round channel avatar, "Your channel", channel name "AI쭌 | AI 실전 자동화의 모든 것"
  - Items (icon + label): Dashboard, Content, **✨ AI Create (NEW, highlighted)**, Analytics, Community,
    Subtitles, Copyright, Earn, Customization, Audio library
  - Bottom: Settings, Send feedback
- Main area: page title (e.g. "Channel dashboard") top-left, content in a responsive masonry of cards.

## Dashboard cards (mock data only)
1. "Latest Shorts performance": thumbnail, title, views 690, likes, comments, "Go to video analytics"
2. "Channel analytics": Current subscribers 65 (+9 in last 28 days), Summary last 28 days: views 11K, watch time, "Go to channel analytics"
3. "Published videos": list of 3 rows (thumbnail, title, views, comments, likes)
4. "Latest post": community post preview
5. "Recent subscribers": 3 placeholder rows (use generic names like "Creator A")
6. "News": one news card with "Learn more"
7. NEW promo card (top of grid, accent border): "✨ Just record. AI does the rest." + button "Start AI Create"

## Visual tokens (approximate dark Studio palette)
- background #1f1f1f, cards #282828, card border #3e3e3e, hover #3a3a3a
- text primary #ffffff, secondary #aaaaaa, divider #3e3e3e
- accent blue #3ea6ff (links/primary buttons), red #ff0000 only for small brand dots
- AI accent (our feature): gradient #7c4dff → #3ea6ff
- font: Roboto / "Google Sans", 14px body, 24px page title, card radius 8px, card padding 24px, grid gap 24px
- icons: Material Symbols Outlined
