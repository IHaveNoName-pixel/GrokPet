# Read-only Assistant Implementation Plan

**Goal:** Implement the user-approved spec alongside existing features.
**Architecture:** Dedicated App Server connection and chat window; validated IPC. Pure HUD visibility and URL helpers. Transient event animations keep load lowest.
**Tech:** Electron41, CommonJS, native bridge unchanged.
**Spec:** ../specs/2026-10-28-assistant-design.md

- [x] HUD/action task: effective data visibility and URL/settings tests, renderer collapse, 39 previews and lifecycle/focus/notice actions.
- [x] Assistant task: readonly session controller, bounded messages, cancel/context/disconnect; local schema and two real readonly rounds; project fixture unchanged.
- [x] UI task: independent input window, engine configuration, directory picker, stream/cancel/new/error. Actual IPC and screenshot checks passed with fake server/opener.
- [x] Final verification: Node48, native10 fixtures, packaged full smoke/restart, readonly review and fixes, documentation.
- [x] Preserve reports at root artifacts, remove isolated packaged test data, and launch final0.6 with input panel. Existing uncommitted work preserved; no commits.
