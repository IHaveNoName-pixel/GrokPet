# GrokPet development conventions

## Scope and stack
- Incrementally extend this Electron 41 / Node CommonJS / Windows .NET 10 project; retain replica/src SVG character engine.
- Current controls use locally bundled React 19 / Motion / Radix UIArc components in ui/arc-controls.tsx; Cult sources and historical adaptations remain. Do not assume a complete React SPA.
- Source root is grok-icon-study. Production runtime is dist/BlobPet-win32-x64/BlobPet.exe; production user data is its data/ directory. Source data is .runtime/user-data. Smoke data is isolated under artifacts.

## Verification
- npm test: Node test runner.
- node scripts/build-ui.cjs: local UI build including scripts/build-arc.cjs.
- npm run smoke: Electron base smoke and reopen; specialized --pet-*-smoke flags are in desktop/main.cjs.
- npm run package builds an output directory; use BLOBPET_PACKAGE_OUTPUT for a fresh staging child under dist. Never package over a running production executable.
- npm run release performs staging, smoke and data-preserving swap; inspect and back up before updating the running installation.
- Native changes require scripts/build-bridge.ps1 and native integration validation.
- State exactly which checks ran. Chromium events, synthetic speech and fake devices do not prove physical mouse, microphone, multi-monitor or DPI acceptance.

## Boundaries
- Preserve existing uncommitted/untracked work and user configuration. Never reset, clean, forcibly merge, auto-push, or replace data/.
- Do not modify global Codex hooks or login without explicit user action. Reuse existing hook listener and Companion.
- Explicit commands and buttons share command-executor.cjs. Launch by registered whitelist IDs, never execute model-authored shell strings.
- Keep contextIsolation and sandbox enabled; expose named preload methods with main-process sender, parameter and bounds validation.
- Do not add a second character scheduler: work state feeds existing Activity/selectAnimation priority path. A completed turn is not verified task success.
- Project memory must be explicit, scoped, editable/deletable and excluded from model input until selected and previewed. Do not save credentials or unconfirmed full chat transcripts.
- Screen capture is opt-in, initiated by the user, previewed and cancellable; never background capture or upload.
- Pause/stop/cancel/timeout and shutdown cleanup are part of any new watcher or voice/capture service.
- New controls must preserve transparent-window native hit regions, scroll and rapid open/close behavior.

- Work events flow through desktop/work/WorkController into the existing Activity. Keep source/project/session/turn scope, terminal dedupe and TTL checks; do not publish task.verified from untrusted renderer, model text or raw hook messages. Work history is bounded RAM only.
