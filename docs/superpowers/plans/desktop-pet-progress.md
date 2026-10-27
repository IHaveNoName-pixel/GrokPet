# Desktop pet execution ledger

Plan: 2026-10-27-desktop-pet.md

Ruling: Work in the user-selected clean checkout, with additions and no commits or publishing. Original animation files remain unchanged.

Pre-flight: Main consumes core and settings; renderer consumes PetBrain via a browser-compatible export. IPC payload validation belongs to main, not renderer.

Dependency: sandbox DNS cannot resolve npm; network dependency installation requested through normal escalation. Cached Electron 41.10.6 runtime exists as fallback.

Task 1: complete — 7 initial behavior/storage tests passed after implementing the missing core. The roaming test now explicitly selects idle from the deterministic random fixture.

Task 2: complete — real Electron smoke passed; click and dragging event lifecycle, native-window roaming, autonomous sleep, hide/pause/resume, settings and offscreen recovery verified.

Ruling: npm downloads reset twice outside sandbox; use the existing local Electron 41.10.6 cache and pin the package to the runtime actually tested.

Ruling: desktop capture of the transparent window was rejected because unrelated desktop content could be visible. Use only own-page capturePage output; native mouse drag and tray menu manual acceptance remain explicitly unverified.

Review: independent reviewer found an extra 12 DIP input-blocking margin. Extracted hitTest, reproduced true-versus-false failure, removed the expansion, 8/8 tests passed. Follow-up independent review found no additional important issues.

Task 3: complete — packaged BlobPet.exe smoke passed, including a fresh process restoring appearance, position and preferences. See docs/desktop-pet-verification.md for evidence and limits. No commits, push or publication performed.
