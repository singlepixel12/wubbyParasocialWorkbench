# Editorial Uplift — Rest of the Site

> Working spec for extending the "The Wubby Archive" editorial design language to every
> page outside the VOD Diary. Build this section by section; check items off as implemented.
> **Status:** planned, not yet started.

## Context

The "The Wubby Archive" editorial redesign was applied only to the VOD Diary / browse
experience (`Masthead`, `VideoCard`, `VideoList`, `Header`, `globals.css` tokens).
Business loved it and wants the same design language extended to every remaining page.

Today the rest of the site still uses the **old styling**: generic shadcn `Card`
sections (`rounded-lg border border-border bg-card`), plain bold sans-serif headings,
hardcoded hex colors (`#0a0a0a`, `#888`, `#333`, `#28a745`, `#ccc`, `text-white`,
`bg-green-600`), and colored Twitch/Kick platform badges that contradict the new
"one quiet green accent" philosophy.

**Goal:** bring `watch`, `player`, `transcript`, `player-test`, the video components,
and the error/404 pages up to the editorial standard already set by the VOD Diary —
reusing the existing tokens and patterns, not inventing new ones.

**This is a visual-only uplift — usability is unchanged.** Every interaction, route, player
control, data fetch, and state flow stays byte-for-byte identical. We only swap the
presentation layer (tokens, type, rules, spacing).

**Decisions confirmed with user:**
1. **Drop platform badges entirely** (no Twitch-purple / Kick-green).
2. **Uplift everything**, including the internal `player-test` sandbox.
3. **Lightweight editorial header** for secondary pages — upgrade `PageHeader`
   (Fraunces + hairline rules + mono kicker); reserve the big `Masthead` for the home/diary.
4. **Open ruled sections** on utility pages (transcript, player-test) — drop the boxed
   `bg-card` panels; separate sections with hairline rules + a small mono section label.
5. **Minimal accent-bar summary** — thin `border-l-2 border-accent-green/50 pl-3` + plain
   text, exactly like the VOD Diary card summaries. No box, no green gradient.
6. **Static / snappy** on secondary + utility pages — add **no** new entrance motion (no
   header rise, no staggered reveal); tools should feel instant. `VideoDetailView` keeps its
   existing subtle fade as-is (don't expand it). Motion stays the diary's showpiece.

## Design language to reuse (already in the codebase)

- **Tokens** (`app/globals.css`): `--accent-green`, `--ink-muted`, `--rule`, `--background`,
  `--foreground`, `--card`. Use Tailwind classes `text-accent-green`, `text-ink-muted`,
  `border-rule`, `bg-card`, `text-foreground` — **no hardcoded hex** in components.
- **Fonts**: `.font-display` (Fraunces) for titles; `font-mono` (Geist Mono) for
  kickers/metadata/hashes; default Hanken for body.
- **Patterns** (from `components/vod-diary/VideoCard.tsx` & `layout/Masthead.tsx`):
  - Mono kicker: `font-mono text-[0.65rem] uppercase tracking-[0.25em] text-ink-muted`
  - Hairline section dividers: `border-t border-rule` / `border-b border-rule`
  - Summary accent: left bar `border-l-2 border-accent-green/50 pl-3` (replaces the
    green-gradient summary card)
  - Tag hover (matches VideoCard:188): `hover:border-accent-green hover:bg-accent-green hover:text-white`
  - Framer Motion entry with `useReducedMotion`, ease `[0.22, 1, 0.36, 1]` (diary only)

## Changes

### 1. `components/layout/PageHeader.tsx` — make it editorial (shared by secondary pages)
Rework into a lightweight editorial header while keeping the existing `title`/`description`
API (so call sites don't break). Add optional `kicker?: string`.
- Top hairline + mono kicker (default e.g. `Archive · est. wubby.tv`)
- `.font-display text-3xl md:text-4xl` title (Fraunces)
- `text-ink-muted` description, bottom `border-b border-rule`
- **Static** — no entrance motion (decision 6). Plain markup; no Framer Motion.

### 2. `components/video/VideoDetailView.tsx` (rendered by `watch`) — biggest visual win
- Remove `getSolidBadgeVariant` + the platform `<Badge>` block (drop platform badges).
- Title `h1` → add `font-display`; original-filename row stays mono `text-ink-muted`.
- Back button: `text-[#888] hover:text-white` → `text-ink-muted hover:text-foreground`.
- Metadata row `text-[#888]` → `text-ink-muted`.
- Separator `bg-[#333]` → `bg-rule`.
- **Summary**: replace the `from-[#28a745]/10 … border-l-4 border-[#28a745]` Card with the
  **minimal accent bar** (decision 5) — `border-l-2 border-accent-green/50 pl-3`, plain text,
  no box/gradient; body text `text-[#ccc]` → `text-foreground/80`.
- Keep the existing subtle fade motion on this view as-is (decision 6) — do not add more.
- Tags: `hover:bg-[#28a745] hover:text-white` → `hover:bg-accent-green hover:text-white`;
  section heading `text-[#888]` → `text-ink-muted`.

### 3. `app/watch/page.tsx` — loading/error states
- `bg-[#0a0a0a]` → `bg-background` (both the loading and error wrappers and the page root).
- "Video Not Found" heading → `font-display`; keep token-based body text.

### 4. `app/player/page.tsx`
- Drop platform badge logic (`getSolidBadgeVariant`); topic tags keep `tag`/`tag-solid`
  but use the VideoCard tag hover. (No platform `<Badge>` rendered.)
- Replace generic `rounded-lg border border-border bg-card p-6` wrappers with **open ruled
  sections** (decision 4 — hairline rule + no box); title `h2` → `font-display`.
- Summary → minimal accent bar (decision 5).
- "Transcript loaded" notice: `text-green-600 dark:text-green-400` → `text-accent-green`.
- "No video selected" empty state → editorial (mono kicker, Fraunces heading, accent button).
- Static (decision 6) — no entrance motion.

### 5. `app/transcript/page.tsx`
- Uses the new editorial `PageHeader` automatically (pass an optional `kicker`).
- Replace each `rounded-lg border border-border bg-card` section with **open ruled sections**
  (decision 4 — hairline rule + mono section label instead of plain `text-xl font-semibold`;
  no box). The `<pre>` JSON keeps its own `bg-muted` for readability.
- "Video Status" block: drop the platform `<Badge>`; keep the `<pre>` JSON (mono).
- Status notices `text-green-600/text-yellow-600` → `text-accent-green` / `text-ink-muted`.
- Static (decision 6) — no entrance motion.

### 6. `app/player-test/page.tsx` (internal sandbox, still uplifted)
- New editorial `PageHeader`; **open ruled sections** (decision 4); `text-green-600`/
  `text-yellow-600` → `text-accent-green` / `text-ink-muted`. Keep the checklist/test controls
  functional. Static — no entrance motion.

### 7. `components/video/VideoSelector.tsx`
- Load button `className="bg-green-600 hover:bg-green-700"` → remove the override so it uses
  the default primary (which is already `--accent-green`), or set `bg-accent-green`.

### 8. `components/video/VideoMetadata.tsx`
- Drop the platform `<Badge>` (remove the `kick`/`twitch` branch usage); keep topic tags.
- Title → `font-display`; date → `text-ink-muted`.
- Summary block → minimal accent bar (decision 5), replacing the generic bordered card.

### 9. `components/video/HashDisplay.tsx`
- Status colors `text-green-600 / text-red-600` → `text-accent-green` / `text-destructive`.
- Keep mono; optionally swap `bg-muted` block for a hairline-ruled row to match the aesthetic.

### 10. Error / 404 / per-route files — light touch
Files: `app/error.tsx`, `app/not-found.tsx`, `app/transcript/error.tsx`,
`app/vod-diary/error.tsx`, `app/player/error.tsx`. These already use tokens (no hex), so:
- Headings → `font-display`; add a top `border-t border-rule` + mono kicker for editorial feel.
- Buttons already use `bg-primary` (= accent-green) — leave functional logic untouched.
- `loading.tsx` / per-route `loading.tsx` skeletons use tokens already — leave as-is
  (optional: a thin masthead-style skeleton bar). Low priority.

### 11. Cleanup (optional, non-breaking)
After platform badges are dropped site-wide, the `kick` / `kick-solid` / `twitch` /
`twitch-solid` variants in `components/ui/badge.tsx` and the `--kick` / `--kick-hover` /
`--twitch` tokens in `globals.css` become unused. Removing them is a tidy follow-up but
not required; note it rather than block on it.

## Out of scope
- No functional/logic changes (data fetching, hash logic, player behavior, storage stay identical).
- `VidstackPlayer.tsx` internals (player skin) — container styling only.

## Verification
1. **Hex sweep**: grep for `#[0-9a-fA-F]{3,6}|green-[0-9]|purple-[0-9]` under `web-new/app`
   and `web-new/components` — only intentional cases should remain (e.g. `bg-black` thumbnail
   fallback / `fill-white` play icon in `VideoCard`, the SVG grain data-URI in `globals.css`,
   and untouched shadcn primitives `button.tsx`/`sheet.tsx`/`loading-spinner.tsx`).
2. **Run app**: `cd web-new; npm run dev` and visually check each page against the VOD Diary:
   `/watch?id=<hash>`, `/player` (after clicking play on a diary card), `/transcript`,
   `/player-test`, plus a forced 404 and an error state. Confirm Fraunces titles, hairline
   rules, accent-green accents, and no colored platform badges.
3. **Lint/build**: `npm run lint` (ESLint clean) and `npm run build`.
4. **Tests**: `npm run test` (Vitest — `VideoCard`/`VideoSelector`/etc. must still pass;
   update assertions only if they checked the removed platform badge / old classes) and
   `npm run test:e2e` for `transcript`, `player`, `navigation`, `accessibility`.
5. Confirm `prefers-reduced-motion` is still respected by the diary masthead/`VideoList` and
   the `VideoDetailView` fade (secondary pages are static, so nothing new to gate there).

## Required reviews (user-requested)
- **`/frontend-design`** — invoke at the **start of implementation** to guide the editorial
  styling work (distinctive, production-grade UI; avoid generic AI aesthetics). Apply its
  guidance while reworking `PageHeader` and the page sections so the uplift matches the
  polish of the existing VOD Diary rather than defaulting to plain shadcn cards.
- **`/security-review`** — run **after implementation**, against the resulting branch diff,
  as the final gate before handing back. Expected to be low-risk (styling-only, no logic/
  data/auth changes), but run it regardless to confirm no `dangerouslySetInnerHTML`, unsafe
  `target="_blank"` (the existing GitHub link already has `rel="noopener noreferrer"`), or
  leaked internals were introduced.

## Critical files
- `components/layout/PageHeader.tsx` (central — drives transcript/player-test/error headers)
- `components/video/VideoDetailView.tsx`, `app/watch/page.tsx`
- `app/player/page.tsx`, `app/transcript/page.tsx`, `app/player-test/page.tsx`
- `components/video/VideoSelector.tsx`, `VideoMetadata.tsx`, `HashDisplay.tsx`
- `app/error.tsx`, `app/not-found.tsx` (+ per-route `error.tsx`)
- Reference (do not change): `components/layout/Masthead.tsx`, `components/vod-diary/VideoCard.tsx`, `app/globals.css`
