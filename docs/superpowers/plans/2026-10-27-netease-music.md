# NetEase Music Plan

Approved scope: specs/2026-10-27-netease-music-design.md. Execute inline using TDD and verification-before-completion.

- [x] Native read-only media probe; actual NetEase 3.1.41 metadata/state available, timeline unavailable. User-approved 5-second playback test restored pause.
- [x] Tests first for media position/rate/pause, missing timeline, track binding, LRC parsing/offset/seek.
- [x] Implement desktop/music-core.cjs and lyrics-store.cjs, native/BlobPetBridge/MediaMonitor.cs.
- [x] Integrate bounded media child lifecycle, settings, music panel/HUD and low-priority lyric bubbles. User approved explicit manual lyric calibration fallback.
- [x] 32 Node tests, native build (0 warnings/errors), actual media probe, packaged Electron music/lyrics smoke and process restart, independent review. Screenshots visually inspected.
- [x] Preserve smoke evidence at root artifacts and remove isolated packaged test artifacts; launch final 0.4.0 package with settings panel.

No network lyric scraping, media playback controls, browser extension installation or account/cache access. Existing worktree has user changes; preserve them and do not commit.
