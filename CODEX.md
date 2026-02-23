# AdjudicArts — Codex Handoff

**Repo:** `github.com/atenor/AdjudicArts`
**Active branch:** `codex/ui-redesign`
**Stack:** Next.js 14 (App Router) · TypeScript · Prisma · NextAuth · CSS Modules
**Deploy:** Vercel (auto-deploys on push to `codex/ui-redesign`)

---

## Design System

All UI must use these tokens — do not introduce Tailwind, shadcn, or new CSS frameworks.

| Token | Value | Usage |
|-------|-------|-------|
| `--purple` | `#462B7C` | Nav bar, primary buttons, active chips |
| `--purple-dark` | `#2D2145` | Hover states, deep bg |
| `--gold` | `#C9A84C` | CTA buttons, rank #1 badge |
| `--gold-light` | `#e0c070` | Wordmark "arts" italic, hero accent text |
| `--tint` | `#f5f0fc` | Dashboard page background |
| `--text-dark` | `#120d25` | Primary body text on light bg |

**Typography:** Cormorant Garamond for wordmark/display only. `font-family: var(--font-cormorant), Georgia, serif`. Geist Sans for body.

**Wordmark pattern** (used in nav and footer):
```tsx
<span style={{ fontFamily: "var(--font-cormorant), Georgia, serif" }}>
  <span style={{ color: "#ffffff", fontWeight: 700 }}>Adjudic</span>
  <span style={{ color: "#e0c070", fontWeight: 300, fontStyle: "italic" }}>arts</span>
</span>
```

---

## Route Map

```
/                    → components/marketing/homepage.tsx          (public)
/login               → app/login/page.tsx                         (public)
/apply/[eventId]     → app/apply/[eventId]/page.tsx               (public)
/status/[appId]      → app/status/[applicationId]/page.tsx        (public)

/dashboard                          → admin home
/dashboard/events                   → event list
/dashboard/events/[id]              → event detail + round management
/dashboard/events/[id]/edit         → edit event form
/dashboard/events/[id]/results      → results with rankings
/dashboard/applications             → application list
/dashboard/applications/[id]        → application detail
/dashboard/scoring                  → judge queue
/dashboard/scoring/[applicationId]  → scoring interface  ← primary judging page
/dashboard/import                   → CSV import
```

---

## Key Component Inventory

### Already Correct — Do NOT Redesign

| Component | File | Status |
|-----------|------|--------|
| Nav bar (52px, purple, Cormorant wordmark) | `components/shared/nav-header.tsx` + `.module.css` | ✅ |
| Dashboard layout (#f5f0fc bg) | `app/(dashboard)/layout.tsx` + `layout.module.css` | ✅ |
| Rubric chip scoring (0–10) | `components/judging/scoring-form.tsx` | ✅ |
| Results rank colors (gold/purple/bronze) | `components/results/round-results-tabs.tsx` + `.module.css` | ✅ |

### Recently Updated (current branch)

| File | What Changed |
|------|--------------|
| `app/layout.tsx` | Added `Cormorant_Garamond` font variable (`--font-cormorant`) to root `<html>` |
| `components/marketing/homepage.tsx` | Full dark purple v7 rewrite — `#462B7C` nav, gradient hero, Cormorant wordmark, gold CTAs, feature cards, footer |
| `app/(dashboard)/dashboard/scoring/[applicationId]/page.tsx` | Removed contestant `#N` from meta line; DiceBear notionists headshot fallback; `<FavouriteButton />` next to name |
| `app/(dashboard)/dashboard/scoring/[applicationId]/scoring.module.css` | Dark theme throughout (`#13102a` page bg, translucent cards, light text); mobile ≤860px sticky video strip |
| `components/judging/sticky-video-player.tsx` | Replaced `<iframe>` with YouTube thumbnail + red play overlay; clicking opens YouTube in new tab |
| `components/judging/sticky-video-player.module.css` | Dark theme (`#0f0d20` bg) |
| `components/judging/scoring-form.module.css` | Dark chips/cards/textarea; mobile chip row `flex-wrap: nowrap`; comment `min-height: 58px` |
| `components/judging/favourite-button.tsx` | **New** client component — toggleable gold star (UI-only, no persistence yet) |

---

## Architecture Rules

### What Codex CAN touch (UI layer only)
- `components/**/*.tsx` and `components/**/*.module.css`
- `app/**/page.tsx` — layout/JSX only, not data-fetching logic
- `app/**/layout.tsx` — layout shell only
- `app/**/*.module.css`
- `app/layout.tsx` — font/meta only
- `public/`

### What Codex must NOT touch
- `app/api/**` — API route handlers
- `lib/` — db queries, auth helpers, server utilities
- `prisma/` — schema and migrations
- `middleware.ts`
- Any `actions.ts` / server action files
- `app/providers.tsx`
- NextAuth config (`lib/auth.ts`)

---

## Scoring Page Layout (dark theme)

The scoring page (`/dashboard/scoring/[applicationId]`) uses a two-column layout:

```
┌─────────────────────────┬────────────────┐
│  .left                  │  .right        │
│  applicant header       │  (sticky)      │
│  application card       │  video player  │
│  repertoire card        │  video titles  │
│  rubric scoring form    │  queue nav     │
│  ← back link           │                │
└─────────────────────────┴────────────────┘
```

- Page bg: `#13102a`
- Cards: `rgba(255,255,255,0.04)` with `rgba(255,255,255,0.08)` border
- Applicant header: `#1a1538` with gold border tint
- Video player: `#0f0d20`
- At ≤860px: `.right` becomes `position: sticky; top: 52px; height: 126px` (strips to just video thumbnail)

---

## Video Player

`components/judging/sticky-video-player.tsx` renders a YouTube **thumbnail** (not an iframe). Clicking opens the video on YouTube in a new tab.

Thumbnail URL pattern: `https://img.youtube.com/vi/{videoId}/mqdefault.jpg`

Video ID is extracted from the embed URL: `embedUrl.split("?")[0].split("/").pop()`

The `toYouTubeEmbedUrl()` utility lives at `lib/youtube.ts` — do not modify it.

---

## Rank Colors (results page)

```css
#1  → background: #C9A84C  (gold)
#2  → background: #6B4BAA  (purple)
#3  → background: #c8864a  (bronze)
#4+ → background: #e5e0f0  (neutral)
```

Score bar: `height: 5px; background: linear-gradient(90deg, #6B4BAA, #462B7C); width: 80px`

---

## Headshot Fallback

When an applicant has no uploaded headshot, use DiceBear notionists:

```tsx
<img
  src={`https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(name)}`}
  alt={`${name} avatar`}
  className={styles.avatar}
/>
```

---

## FavouriteButton

`components/judging/favourite-button.tsx` — client component, toggles local state only (gold star on/off). No server persistence yet. If wiring persistence: add a `favouriteApplicationId` field to the `Score` model or a separate `Favourite` table; expose via a new server action in `lib/` and a new API route in `app/api/`.

---

## Build & Deploy

```bash
cd /Users/andylunsford/AdjudicArts
npm run build        # must pass with zero errors before committing
git push origin codex/ui-redesign   # triggers Vercel preview deploy
```

The `npm run build` script runs `prisma generate` then `next build`. ESLint is enforced at build time — no unused vars, no missing deps.

---

## Known Gotcha — Route Conflicts

**Do NOT create `app/(marketing)/page.tsx`.** The root route `/` is handled by
`app/page.tsx`. Creating any other file that resolves to `/` causes a Next.js
prerender failure and breaks the Vercel deployment. This already happened once
(commit `8f83258` fixed it). The `app/(marketing)/` route group directory was
removed — do not recreate it unless you add a distinct layout file there first.

## Logged-In User Redirect

`app/page.tsx` previously redirected authenticated users (`getServerSession`)
straight to `/dashboard`. Codex removed that check when fixing the route
conflict. Logged-in users who visit `/` will now see the marketing homepage.
This is a UX (not security) regression — middleware still guards all
`/dashboard` routes. Restore the redirect if needed, but note it requires
`getServerSession` (server-side data fetch) in `app/page.tsx`.
