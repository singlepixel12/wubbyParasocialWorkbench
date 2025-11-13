# Quick Start Roadmap
## Mobile-First Transformation - Priority Matrix

**Total Estimated Time:** 5-7 weeks (130-190 hours)
**Recommended Team Size:** 1-2 developers
**Start Date:** TBD
**Target Completion:** 5-7 weeks from start

---

## Priority Matrix

```
          ┌────────────────────────────────────────┐
🎯 HERO!  │ 0. DIFFERENTIATORS (AI, Tags, Titles!) │ WEEK 0-1
          │    Make unique features visible!       │
          ├────────────────────────────────────────┤
CRITICAL  │ 1. Breakpoints   2. Touch Targets      │ WEEK 1-2
          │ 3. Bottom Nav    4. Pull-to-Refresh   │
          ├────────────────────────────────────────┤
HIGH      │ 5. Video Cards   6. Loading States     │ WEEK 3
          │ 7. Lazy Loading  8. React Query        │ WEEK 4
          ├────────────────────────────────────────┤
MEDIUM    │ 9. Filter Sheet  10. Keyboard Shortcuts│ WEEK 5-6
          │ 11. Gestures     12. Animations        │
          ├────────────────────────────────────────┤
LOW       │ 13. Advanced Features                  │ WEEK 7+
          │ 14. Personalization (Future)           │
          └────────────────────────────────────────┘
```

---

## Week-by-Week Breakdown

### Week 0-1: Two-Tier UX + Differentiators (🎯 HERO!)

**Goal:** Scannable browse → Detailed watch page (Progressive disclosure of AI features)
**Success Criteria:** Browse page scannable, detail page shows full AI context
**Design Principle:** "Scan first, read later" (from designer feedback)

| Task | Priority | Effort | Files |
|------|----------|--------|-------|
| 0.1 Extract hook function (1-2 lines) | 🎯 HERO | 1-2h | video-helpers.ts |
| 0.2 Update VideoCard to show hook | 🎯 HERO | 2-3h | VideoCard.tsx |
| 0.3 Create /watch/[id] route | 🎯 HERO | 3-4h | app/watch/[id]/page.tsx |
| 0.4 Create VideoDetailView component | 🎯 HERO | 4-6h | VideoDetailView.tsx |
| 0.5 Add Framer Motion transitions | 🟡 MEDIUM | 2-3h | Layout, VideoCard |
| 0.6 Create home page Rails (optional) | 🟢 LOW | 4-6h | app/page.tsx |

**Deliverables:**
- ✅ Browse cards show 1-2 line hook (scannable!)
- ✅ AI badges visible on browse cards
- ✅ 3 tag preview on browse cards
- ✅ "Read more →" CTA on each card
- ✅ /watch/[id] route with full player
- ✅ Full 200-word AI summary on detail page
- ✅ All tags clickable on detail page
- ✅ Chapters section (if available)
- ✅ Related videos section
- ✅ Smooth Framer Motion transitions

**Why Two-Tier:**
- Browse: Scan 50+ videos quickly (1-2 line hooks)
- Detail: Full AI summary feels like a REWARD
- Impact: "Other sites: nothing. You: 200 words" contrast is MORE impressive

**Testing:**
- [ ] Browse page: Can scan 50+ cards without fatigue
- [ ] Hook is compelling (1-2 sentences)
- [ ] Click card → smooth transition to watch page
- [ ] Detail page: Full summary visible in green accent card
- [ ] All tags clickable, search works
- [ ] Related videos show up
- [ ] Back button returns to same scroll position

---

### Week 1-2: Foundation (CRITICAL)

**Goal:** App works excellently on mobile devices
**Success Criteria:** No horizontal scroll, all touch targets ≥44px

| Task | Priority | Effort | Files |
|------|----------|--------|-------|
| 1. Reverse Tailwind Breakpoints | 🔴 CRITICAL | 16-24h | All .tsx files |
| 2. Touch Target Optimization | 🔴 CRITICAL | 8-12h | VideoCard, Button, Badge |
| 3. Bottom Navigation | 🔴 CRITICAL | 12-16h | BottomNav.tsx (new), Header.tsx |
| 4. Pull-to-Refresh | 🟡 MEDIUM | 4-8h | vod-diary/page.tsx |

**Deliverables:**
- ✅ App fully responsive (320px - 1920px)
- ✅ Bottom nav functional on mobile
- ✅ Top nav functional on desktop
- ✅ All interactive elements meet touch standards
- ✅ Pull-to-refresh working on VOD list

**Testing:**
- [ ] Test on iPhone SE (375x667)
- [ ] Test on iPhone 14 Pro (390x844)
- [ ] Test on Android (360x800)
- [ ] Test on iPad (768x1024)
- [ ] Test on Desktop (1920x1080)

---

### Week 3: Visual Polish (HIGH)

**Goal:** App looks professional and polished on all devices
**Success Criteria:** Video cards beautiful, loading states smooth

| Task | Priority | Effort | Files |
|------|----------|--------|-------|
| 5. Enhanced Video Cards | 🟠 HIGH | 12-16h | VideoCard.tsx, PlayButton.tsx (new) |
| 6. Progressive Loading States | 🟠 HIGH | 4-8h | SkeletonVideoCard.tsx, OptimizedImage.tsx |
| 7. Page Transitions | 🟡 MEDIUM | 4-6h | PageTransition.tsx (new) |

**Deliverables:**
- ✅ Video cards with gradient overlays
- ✅ Platform-specific glow effects
- ✅ Duration badges on thumbnails
- ✅ Smooth skeleton loading
- ✅ Fade-in page transitions

**Testing:**
- [ ] Visual regression testing
- [ ] Animation performance (60fps)
- [ ] Loading states feel fast
- [ ] Hover states work on desktop

---

### Week 4: Performance (HIGH)

**Goal:** Fast, efficient app with smart caching
**Success Criteria:** Lighthouse mobile score ≥90

| Task | Priority | Effort | Files |
|------|----------|--------|-------|
| 8. Dynamic Imports (Code Splitting) | 🟠 HIGH | 6-10h | player/page, vod-diary/page |
| 9. Image Optimization | 🟠 HIGH | 10-16h | OptimizedImage.tsx, next.config.js |
| 10. React Query Integration | 🟠 HIGH | 10-14h | useVideos.ts, QueryProvider.tsx |
| 11. Bundle Analysis & Optimization | 🟡 MEDIUM | 4-6h | next.config.js, package.json |

**Deliverables:**
- ✅ Video player lazy loaded
- ✅ Date picker lazy loaded
- ✅ React Query caching implemented
- ✅ Bundle size reduced 30%+
- ✅ Lighthouse score ≥90

**Testing:**
- [ ] Run Lighthouse audit
- [ ] Test on 3G network
- [ ] Check bundle size
- [ ] Verify caching works

---

### Week 5-6: Advanced Features (MEDIUM)

**Goal:** Excellent mobile UX with modern patterns
**Success Criteria:** Filter sheet works great, shortcuts functional

| Task | Priority | Effort | Files |
|------|----------|--------|-------|
| 12. Filter Bottom Sheet (Mobile) | 🟡 MEDIUM | 16-24h | FilterSheet.tsx (new) |
| 13. Keyboard Shortcuts (Desktop) | 🟡 MEDIUM | 8-16h | useKeyboardShortcuts.ts, ShortcutsModal.tsx |
| 14. Enhanced Gestures | 🟢 LOW | 6-10h | VidstackPlayer.tsx |

**Deliverables:**
- ✅ Bottom sheet for filters (mobile)
- ✅ Quick date presets
- ✅ Keyboard shortcuts (/, Ctrl+K, 1-4)
- ✅ Swipe gestures in player
- ✅ Help modal for shortcuts

**Testing:**
- [ ] Bottom sheet UX smooth
- [ ] Keyboard shortcuts work
- [ ] Gestures feel natural
- [ ] No conflicts with native gestures

---

### Week 7+: Polish & Future (LOW)

**Goal:** Nice-to-have features, long-term improvements

| Task | Priority | Effort | Status |
|------|----------|--------|--------|
| Offline Support (Service Worker) | 🟢 LOW | 20-30h | Future |
| User Preferences (LocalStorage) | 🟢 LOW | 8-12h | Future |
| Smart Recommendations | 🟢 LOW | 40-60h | Future |
| Advanced Search Operators | 🟢 LOW | 16-24h | Future |

---

## Decision Tree: Where to Start?

```
Do you have < 2 weeks?
├─ YES → Focus on Week 1-2 only (Foundation)
│         This gives you mobile support
│
└─ NO → Full implementation
    │
    ├─ Have 3-4 weeks?
    │  └─ Do Weeks 1-3 (Foundation + Visual)
    │     Skip Week 4-6 for now
    │
    └─ Have 5+ weeks?
       └─ Full implementation (Weeks 1-6)
          Excellent mobile + desktop experience
```

---

## Task Prioritization Guide

### Must Have (Ship Blockers)
1. ✅ Mobile-first breakpoints
2. ✅ Touch target compliance
3. ✅ Bottom navigation (mobile)
4. ✅ Enhanced video cards

### Should Have (Quality)
5. ✅ React Query caching
6. ✅ Code splitting
7. ✅ Loading states
8. ✅ Image optimization

### Nice to Have (Polish)
9. ⚪ Filter bottom sheet
10. ⚪ Keyboard shortcuts
11. ⚪ Advanced gestures
12. ⚪ Page transitions

### Future (Post-Launch)
13. ⚪ Offline support
14. ⚪ Personalization
15. ⚪ Advanced search
16. ⚪ Analytics

---

## Implementation Order

### Option A: Waterfall (Safer)
Complete each week fully before moving to next.

```
Week 1-2: Foundation     ████████████████████ 100%
Week 3:   Visual         ░░░░░░░░░░░░░░░░░░░░   0%
Week 4:   Performance    ░░░░░░░░░░░░░░░░░░░░   0%
Week 5-6: Features       ░░░░░░░░░░░░░░░░░░░░   0%
```

**Pros:** Lower risk, easier to test
**Cons:** Slower initial results

### Option B: Parallel (Faster)
Work on multiple phases simultaneously.

```
Week 1-2:
  Developer 1: Foundation (Tasks 1-3)  ████████████ 100%
  Developer 2: Visual (Task 5)         ████████████ 100%

Week 3-4:
  Developer 1: Performance (Tasks 8-9) ████████████ 100%
  Developer 2: Features (Task 12)      ████████████ 100%
```

**Pros:** Faster completion
**Cons:** Higher coordination overhead

### Option C: MVP Focus (Recommended)
Do only critical tasks first, iterate.

```
Week 1:   Tasks 1, 2, 3  ████████████████████ 100%
Week 2:   Task 5         ████████████████████ 100%
Week 3:   Tasks 8, 10    ████████████████████ 100%
Week 4:   Polish & Test  ████████████████████ 100%
---
MVP Launch ✅
---
Week 5+:  Tasks 12, 13 (Post-launch)
```

**Pros:** Fastest to value, reduce risk
**Cons:** Some features delayed
**Recommended:** ✅ YES

---

## Dependency Graph

```
Foundation
├── Breakpoints (1) ──┐
├── Touch Targets (2) ├─→ Video Cards (5) ──→ Gestures (14)
└── Bottom Nav (3) ───┘

Performance
├── Code Split (8) ────→ Bundle Analysis (11)
├── Images (9) ────────→ Video Cards (5)
└── React Query (10) ──→ All API calls

Features
├── Filter Sheet (12) ─→ Requires Bottom Nav (3)
└── Keyboard (13) ─────→ Independent
```

**Key Dependencies:**
- Video Cards (5) requires Breakpoints (1) and Touch Targets (2)
- Filter Sheet (12) requires Bottom Nav (3) pattern
- Bundle Analysis (11) requires Code Splitting (8) first

---

## Quick Start Checklist

### Before You Start
- [ ] Read `PARASOCIAL_STYLE_GUIDE.md` (15 min)
- [ ] Read `MOBILE_FIRST_IMPLEMENTATION_PLAN.md` (30 min)
- [ ] Review `COMPONENT_RECOMMENDATIONS.md` (20 min)
- [ ] Set up mobile testing devices/emulators
- [ ] Create feature branch: `git checkout -b mobile-first-refactor`
- [ ] Install dependencies: `npm install`

### Week 1 - Day 1
- [ ] Task 1.1: Audit responsive classes (`grep -r "sm:" components/`)
- [ ] Create spreadsheet of all files to update
- [ ] Start with `VideoCard.tsx` refactor
- [ ] Test on mobile device after each change

### Week 1 - Day 2-3
- [ ] Continue breakpoint refactoring
- [ ] Update `VideoList.tsx`
- [ ] Update `vod-diary/page.tsx`
- [ ] Test all breakpoints (320, 375, 768, 1024, 1920)

### Week 1 - Day 4
- [ ] Task 1.2: Update Button component with `touch` size
- [ ] Refactor all button usages
- [ ] Measure touch targets with DevTools
- [ ] Fix any < 44px targets

### Week 1 - Day 5
- [ ] Task 1.3: Create `BottomNav.tsx`
- [ ] Update `Header.tsx` to hide on mobile
- [ ] Update root layout with nav
- [ ] Test navigation on mobile

### Week 2 - Day 1-2
- [ ] Task 1.4: Add pull-to-refresh
- [ ] Install `react-simple-pull-to-refresh`
- [ ] Wrap VOD list
- [ ] Test pull gesture

### Week 2 - Day 3-5
- [ ] Final testing of Week 1-2 work
- [ ] Fix any bugs found
- [ ] Manual testing on real devices
- [ ] E2E tests pass
- [ ] Commit and push: `git commit -m "feat: mobile-first foundation"`

---

## Progress Tracking Template

Copy this to your project management tool:

```markdown
## Mobile-First Transformation

### Week 1-2: Foundation ⏳ In Progress
- [x] Task 1: Reverse breakpoints (16h) - DONE
- [ ] Task 2: Touch targets (8h) - In Progress (60%)
- [ ] Task 3: Bottom navigation (12h) - Not Started
- [ ] Task 4: Pull-to-refresh (4h) - Not Started

### Week 3: Visual Polish ⏸️ Not Started
- [ ] Task 5: Video cards (12h)
- [ ] Task 6: Loading states (4h)
- [ ] Task 7: Transitions (4h)

### Week 4: Performance ⏸️ Not Started
- [ ] Task 8: Code splitting (6h)
- [ ] Task 9: Images (10h)
- [ ] Task 10: React Query (10h)
- [ ] Task 11: Bundle analysis (4h)

### Week 5-6: Features ⏸️ Not Started
- [ ] Task 12: Filter sheet (16h)
- [ ] Task 13: Keyboard shortcuts (8h)
- [ ] Task 14: Gestures (6h)

**Overall Progress:** ██░░░░░░░░░░░░░░░░░░ 10%
**Estimated Completion:** TBD
**Blockers:** None
```

---

## Success Metrics Dashboard

Track these metrics before/after:

| Metric | Before | Target | After | Status |
|--------|--------|--------|-------|--------|
| Lighthouse Mobile | ? | ≥90 | ? | ⏳ |
| Lighthouse Desktop | ? | ≥95 | ? | ⏳ |
| Lighthouse Accessibility | ? | 100 | ? | ⏳ |
| Bundle Size (gzip) | ? | <100KB | ? | ⏳ |
| LCP (3G) | ? | <2.5s | ? | ⏳ |
| TTI (3G) | ? | <3.5s | ? | ⏳ |
| Touch Target Compliance | ? | 100% | ? | ⏳ |
| Mobile Conversion Rate | ? | +20% | ? | ⏳ |

**How to Measure:**
```bash
# Lighthouse
npm install -g lighthouse
lighthouse http://localhost:3000 --view --preset=desktop
lighthouse http://localhost:3000 --view --preset=mobile --throttling.cpuSlowdownMultiplier=4

# Bundle size
npm run build
ls -lh .next/static/chunks/*.js | awk '{print $5, $9}'

# Touch targets
# Use Chrome DevTools > More Tools > Rendering > Highlight ad frames
# Manually verify all interactive elements ≥44px
```

---

## Risk Mitigation

### High Risk Items

1. **Breaking Existing Functionality**
   - **Mitigation:** Comprehensive testing, feature flags
   - **Rollback:** Git revert, keep old code in comments temporarily

2. **Performance Degradation**
   - **Mitigation:** Lighthouse CI, performance budgets
   - **Rollback:** Remove lazy loading, revert code splitting

3. **Accessibility Regression**
   - **Mitigation:** Automated a11y testing, screen reader testing
   - **Rollback:** Keep ARIA attributes, test before merge

### Medium Risk Items

1. **Design Inconsistencies**
   - **Mitigation:** Design review, component library
   - **Fix:** Iterate on feedback

2. **Mobile Browser Compatibility**
   - **Mitigation:** Test on real devices (iOS Safari, Chrome Android)
   - **Fix:** Polyfills, graceful degradation

---

## Communication Plan

### Weekly Standups
- **Monday:** Plan week, assign tasks
- **Wednesday:** Mid-week check-in, unblock issues
- **Friday:** Demo progress, get feedback

### Stakeholder Updates
- **Week 2:** Foundation complete, demo mobile nav
- **Week 3:** Visual polish demo, video cards
- **Week 4:** Performance numbers, Lighthouse scores
- **Week 6:** Final demo, launch readiness review

---

## Launch Checklist

### Pre-Launch (1 week before)
- [ ] All critical tasks complete
- [ ] Lighthouse scores meet targets
- [ ] E2E tests passing
- [ ] Manual testing on 5+ devices
- [ ] Accessibility audit complete
- [ ] Performance budget met
- [ ] Stakeholder approval

### Launch Day
- [ ] Merge to main branch
- [ ] Deploy to production
- [ ] Monitor error logs
- [ ] Monitor performance metrics
- [ ] Gather user feedback

### Post-Launch (1 week after)
- [ ] Review analytics
- [ ] Fix any critical bugs
- [ ] Iterate on user feedback
- [ ] Plan next phase (Week 5-6 features)

---

## Resources & Links

### Documentation
- [Parasocial Style Guide](./PARASOCIAL_STYLE_GUIDE.md)
- [Implementation Plan](./MOBILE_FIRST_IMPLEMENTATION_PLAN.md)
- [Component Recommendations](./COMPONENT_RECOMMENDATIONS.md)
- [CLAUDE.md](./CLAUDE.md) - Project overview

### External Resources
- [Material Design 3](https://m3.material.io/)
- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [Next.js Docs](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Radix UI](https://www.radix-ui.com/)
- [React Query](https://tanstack.com/query/latest)

### Tools
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/)
- [Bundle Analyzer](https://www.npmjs.com/package/@next/bundle-analyzer)
- [Contrast Checker](https://webaim.org/resources/contrastchecker/)

---

## FAQ

**Q: Can I skip Week 1-2 and go straight to visual polish?**
A: No. Foundation is critical. Without mobile-first breakpoints and touch targets, the app won't work well on mobile.

**Q: What if I only have 1 week?**
A: Do Tasks 1, 2, 3 (breakpoints, touch targets, bottom nav). This gives you basic mobile support.

**Q: Should I do waterfall or parallel?**
A: If solo dev: Waterfall. If 2+ devs: Parallel with good communication.

**Q: When can I launch?**
A: After Week 4 (Foundation + Visual + Performance). Weeks 5-6 are optional polish.

**Q: How do I handle merge conflicts?**
A: Work in small batches, commit often, communicate with team.

**Q: What if Lighthouse score doesn't improve?**
A: Check bundle size, lazy loading, image optimization. Use Chrome DevTools Performance tab to profile.

---

**Document Version:** 1.0
**Last Updated:** 2025-11-13
**Next Review:** Weekly during implementation
