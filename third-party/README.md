# Cult UI and styling

CollabToolbar source: https://www.cult-ui.com/r/collab-toolbar.json, retrieved 2026-10-28.
Repository: https://github.com/nolly-studio/cult-ui. Its original MIT notice is in CULT-UI-LICENSE.txt.
The unchanged source is vendored at ui/vendor/cult/collab-toolbar.tsx. scripts/build-ui.cjs uses React DOM Server to render its chat/compass/desktop groups with no avatars and compiles local Tailwind CSS. The renderer receives static HTML/CSS, not a React runtime. Labels/events and surface styling are adapted locally.
Tailwind's license is included in TAILWIND-LICENSE.txt. React/esbuild are build dependencies only. No paid AI SDK Agents blocks, shader packages, external fonts or avatar resources are shipped or fetched at runtime.

Expandable, Halo Progress, Morph Surface and Speech Bubble registry sources are also retained in ui/vendor/cult/ for reference (retrieved 2026-10-28). The pet system card uses a DOM/CSS adaptation of the expandable and progress patterns in pet/hud-card.js and pet/pet.css, rather than adding React/Motion/Base UI to the renderer. It uses native aria-expanded, inert and progressbar semantics; actual telemetry drives the rings and bars.

Halo Search and Popover Form original MIT sources are vendored in ui/vendor/cult (retrieved from https://www.cult-ui.com/r/halo-search.json and https://www.cult-ui.com/r/popover-form.json). The pet input bundles React, Motion, lucide-react, and the shader dependency locally; see package-lock.json for versions.


Timer, Halo Select and Floating Panel registry JSON sources were retrieved from https://www.cult-ui.com/r/{timer,halo-select,floating-panel}.json on 2026-10-29 and retained in ui/vendor/cult/reference/. pet/ui-controls.css, pet/halo-select.js and pet/radial.js adapt their clock, frosted dropdown, selection feedback and trigger-to-panel motion to the existing DOM/Electron hit-testing lifecycle. No additional React/Motion runtime is mounted in the pet. The timer display uses the existing persistent backend countdown instead of a second independent useTimer clock. The old Halo Search React bundle mentioned above is retained as an earlier experiment and is not loaded by current pet/index.html.


# UIArc runtime controls (2026-10-29)

The current renderer loads the locally bundled React UIArc controls in pet/arc-controls.js and pet/arc-controls.css. This supersedes the historical no-React control descriptions above; the old Halo Search bundle remains unloaded. No component CDN, external font or shader engine is loaded.

Sources: https://uiarc.dev/r/{dropdown-menu,split-button,icon-morph,number-field,elastic-slider,time-picker,expandable-card,tooltip,countdown,arc-foundation,arc-motion-tokens}.json. Original registry JSON is retained under ui/vendor/arc/reference, with working TypeScript/CSS under ui/vendor/arc/registry. Free components use the MIT license, Copyright (c) 2026 Elia Kuratli; see UIARC-LICENSE.txt and https://uiarc.dev/license.

Local changes: controlled open/expanded state; non-modal dropdowns; portal overlays with native click-region reporting; Chinese countdown/labels; virtualized minute options with viewport placement; animated chevrons. ui/arc-controls.tsx preserves existing DOM IDs, validation, command/chat/voice events and backend countdown state. React, React DOM, Motion, Radix and lucide are bundled locally; package-lock.json records versions.

Swipe Actions source retrieved from https://uiarc.dev/r/swipe-actions.json on 2026-10-30; original JSON retained in reference/. Uses existing Motion/Radix dependencies. Local adaptation adds non-modal portals/native overlay reporting and Chinese labels. Reminder actions use the existing validated IPC, with full-swipe commit disabled and duplicate submissions locked.

Carousel and Timeline retrieved from https://uiarc.dev/r/{carousel,timeline}.json on 2026-10-30. Sources/reference JSON retained under ui/vendor/arc/. Local changes: Chinese labels, existing DOM card slots, non-destructive layout switching, and controls excluded from carousel drags. Swipe Actions supports immediate removal for externally owned DOM cards; reminder row animations remain enabled.
