# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - link "Skip to main content" [ref=e2] [cursor=pointer]:
    - /url: "#main-content"
  - banner [ref=e3]:
    - generic [ref=e5]:
      - link "Wubby Parasocial Workbench" [ref=e6] [cursor=pointer]:
        - /url: /
      - button "Open menu" [ref=e7]:
        - img
  - main [ref=e8]:
    - generic [ref=e9]:
      - generic [ref=e10]:
        - heading "VOD Diary" [level=2] [ref=e11]
        - paragraph [ref=e12]: Browse and filter Wubby VODs by platform, date range, and search terms.
      - generic [ref=e13]:
        - button "09/11/2025 - 16/11/2025" [ref=e16]:
          - img
          - text: 09/11/2025 - 16/11/2025
        - radiogroup "Platform filter" [ref=e17] [cursor=pointer]:
          - generic: both
          - generic: twitch
          - generic: kick
          - radio "both platform selected" [checked] [ref=e18]:
            - generic [ref=e19]: both
        - button "Toggle search" [ref=e21]:
          - img
      - generic [ref=e22]:
        - img [ref=e24]
        - heading "No videos available" [level=3] [ref=e26]
        - paragraph [ref=e27]: No videos found for the selected date range and filters.
  - region "Notifications alt+T"
```