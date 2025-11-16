# Wubby Parasocial Workbench

Web tool for analyzing Wubby stream content with video transcription, VOD diary, and content analysis.

## 📚 Documentation

**Start Here:**
- **[UI_IMPLEMENTATION_GUIDE.md](./UI_IMPLEMENTATION_GUIDE.md)** - Complete design & implementation reference (all-in-one)
- **[CLAUDE.md](./CLAUDE.md)** - Project overview & migration status

**Archived:**
- See `archive/` folder for old design documents (now consolidated)

## 🚀 Quick Start

```bash
cd web-new
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## ✅ Current Status

**Week 0-1: Two-Tier UX** - ✅ COMPLETE (2025-11-16)
- Browse cards show 1-2 line hooks (scannable!)
- "Read more →" navigates to full detail view
- Full AI summary on `/watch/[hash]` pages
- Tag count badges, clickable tags (6 visible)
- Platform-specific play button glows
- Green accent bars for summaries

**Next:** Phase 1 - Mobile-First Foundation (2-3 weeks)

See [UI_IMPLEMENTATION_GUIDE.md](./UI_IMPLEMENTATION_GUIDE.md) for the complete roadmap.

## 🎯 Key Features

1. **AI-Generated Summaries** - 200+ word summaries for instant video understanding
2. **Intelligent Tagging** - Lightning-fast search by topics/guests/games
3. **Title Renaming** - AI-cleaned titles + original filenames preserved
4. **Two-Tier UX** - Scan first (browse), read later (detail page)

## 📁 Project Structure

```
wubbyParasocialWorkbench/
├── web-new/                 # Next.js 16 app (current)
│   ├── app/                 # App router pages
│   ├── components/          # React components
│   ├── lib/                 # Utilities & API clients
│   └── types/               # TypeScript types
├── archive/                 # Old design docs (consolidated)
├── UI_IMPLEMENTATION_GUIDE.md  # ⭐ Main design reference
├── CLAUDE.md               # Project overview
└── README.md               # This file
```

## 🛠️ Tech Stack

- **Framework:** Next.js 16 (App Router)
- **UI:** React 19 + shadcn/ui + Tailwind CSS 4
- **Video:** Vidstack Player
- **Backend:** Supabase (PostgreSQL + Storage)
- **Animations:** tw-animate-css (CSS animations)
- **Testing:** Playwright (E2E) + Vitest (Unit)

## 📱 Platform Support

- Twitch VODs
- Kick VODs
- Platform-specific filtering & color theming

---

**Last Updated:** 2025-11-16
**Status:** Week 0-1 Complete, Phase 1 Next
