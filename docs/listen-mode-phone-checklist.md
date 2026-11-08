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

If check 1 or 2 fails, the background-playback approach (MSE in a locked tab) is the problem.
Stop and revisit the design; the fallback is a Blob-backed `<audio src>` built from the same
index and runs.
