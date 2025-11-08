# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - link "Skip to main content" [ref=e2] [cursor=pointer]:
    - /url: "#main-content"
  - banner [ref=e3]:
    - generic [ref=e4]:
      - heading "Parasocial Workbench" [level=1] [ref=e5]
      - navigation "Main navigation" [ref=e6]:
        - menubar [ref=e7]:
          - menuitem "Go to Transcription Details page" [ref=e8] [cursor=pointer]: Transcription Details
          - menuitem "Go to Get Transcript page" [ref=e9] [cursor=pointer]: Get Transcript
          - menuitem "Go to VOD Diary page" [ref=e10] [cursor=pointer]: VOD Diary
          - menuitem "Go to Video Player page" [ref=e11] [cursor=pointer]: Player
  - main [ref=e12]:
    - generic [ref=e13]:
      - generic [ref=e14]:
        - heading "VOD Diary" [level=2] [ref=e15]
        - paragraph [ref=e16]: Browse and filter Wubby VODs by platform, date range, and search terms.
      - generic [ref=e17]:
        - button "01/11/2025 - 08/11/2025" [ref=e20]:
          - img
          - text: 01/11/2025 - 08/11/2025
        - radiogroup "Platform filter" [ref=e21] [cursor=pointer]:
          - generic: both
          - generic: twitch
          - generic: kick
          - radio "both platform selected" [checked] [ref=e22]:
            - generic [ref=e23]: both
        - button "Toggle search" [ref=e25]:
          - img
      - paragraph [ref=e27]: No videos found.
  - region "Notifications alt+T"
```