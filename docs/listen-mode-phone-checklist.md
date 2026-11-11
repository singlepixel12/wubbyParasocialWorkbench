# Listen mode: real-phone checklist (Android, Chrome)

Automated tests can't prove these. Run them on the phone before trusting a Listen change.

- **Deployed site:** open `https://singlepixel12.github.io/wubbyParasocialWorkbench/` on the
  phone.
- **A branch, before merging:** connect the phone by USB, open `chrome://inspect#devices` on the
  laptop, and set Port forwarding `3000 → localhost:3000`. Then open `http://localhost:3000` on the
  phone.
  - That address counts as a secure context.
  - A `http://192.168…` LAN address doesn't, so streaming (MSE) and Media Session would mislead
    there.

| # | Check | Pass? |
|---|-------|-------|
| 1 | Listen, 1.5×, lock the screen for 15 min: audio never stops | |
| 2 | Switch to another app for 5 min: audio continues | |
| 3 | Notification shows title + thumbnail; play/pause and ±30 s work | |
| 4 | Lock-screen seek bar moves at 1.5× speed; still 1.5× after pause/resume from the lock screen | |
| 5 | Data: Settings → Network → Data usage → Chrome, before/after 30 min at 1.5× ≈ 25–40 MB (plus a one-off ~24 MB the first time a VOD is opened) | |
| 6 | Airplane mode for 30 s mid-listen: audio continues from the buffer, "Reconnecting…" shows, then recovers | |
| 7 | Reopen the VOD later: Listen shows "from h:mm:ss" and resumes there; the diary card shows "Resume …" | |
| 8 | Tap targets are easy one-handed; the status line is readable outdoors | |
| 9 | Listen → Watch → Listen keeps the timestamp both ways | |
| 10 | **Download** a long VOD on Wi-Fi, lock the phone: Android's notification shows progress and it completes (~1 h for 6 h of audio) | ❌ 2026-11-10, S22 with battery saver on: stuck at 10% overnight. Retry with the settings below |
| 11 | Close Chrome mid-download: it keeps going (or resumes) and finishes; reopening shows "Saved offline" | |
| 12 | Cancel from the notification: the watch page shows "Resume · x%", and Resume finishes it | |
| 13 | Airplane mode with the site already open: a downloaded VOD plays via Listen ("Playing from your phone · 0 MB used") | |
| 14 | Diary chip shows count and size; deleting in the sheet frees space (Settings → Apps → Chrome → Storage) | |
| 15 | Finish a downloaded VOD (last 2 min): it disappears from the list | |
| 16 | On mobile data, Download asks first ("You're on mobile data…") | |
| 17 | **Flaky network:** listen on a train or in a lift (or toggle airplane mode 20–60 s while locked): audio carries on from the buffer, then recovers **with no tap** | |
| 18 | A download interrupted by a dead zone (or airplane mode mid-download) finishes by itself once signal returns, with the site open | |
| 19 | Open a VOD with weak signal: it loads, or shows "Connection problem" with Retry, never "Video Not Found" | |
| 20 | **Install:** the site's menu (☰) → **Install app** (or Chrome ⋮ → Add to Home screen → Install): "Wubby Archive" lands on the home screen with the green W icon | |
| 21 | Open it from the home screen: full screen, no address bar; tapping a card opens the VOD inside the app, not in Chrome | |
| 22 | **Airplane mode**, swipe the app away, open it from the home screen: the diary shows "Saved on your phone"; a saved VOD opens with its summary and Listen plays | |
| 23 | Airplane mode: a VOD that isn't saved says "You're offline" with Retry (never "Loading" forever); back on signal, the live diary returns by itself | |
| 24 | **After a deploy:** open the app online, close and reopen it: the new version shows; an app left open on the old version keeps working | |

**Row 10 on a Samsung (S22).** Chrome's background downloads run at Chrome's default
priority, which Android may hold while the phone is locked. Before an overnight download:
- Settings → Battery → **Power saving off**.
- Settings → Apps → Chrome → Battery → **Unrestricted**.
- Settings → Battery → Background usage limits: Chrome is **not** in Sleeping or Deep sleeping apps.
- To see what happened next morning: before starting, plug into the laptop, `chrome://inspect`,
  inspect the site → Application → Background services → **Background fetch → Record**. It
  keeps logging for 3 days with DevTools closed. `chrome://download-internals` on the phone
  shows whether Chrome thinks a download is running, paused or waiting.
- If it's stuck when you open the app, leave it open for ~2 min: the watchdog restarts it.

If check 1 or 2 fails, the background-playback approach (MSE in a locked tab) is the problem.
Stop and revisit the design; the fallback is a Blob-backed `<audio src>` built from the same
index and runs.
