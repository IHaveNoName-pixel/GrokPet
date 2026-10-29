# Cult UI and styling

CollabToolbar source: https://www.cult-ui.com/r/collab-toolbar.json, retrieved 2026-10-28.
Repository: https://github.com/nolly-studio/cult-ui. Its original MIT notice is in CULT-UI-LICENSE.txt.
The unchanged source is vendored at ui/vendor/cult/collab-toolbar.tsx. scripts/build-ui.cjs uses React DOM Server to render its chat/compass/desktop groups with no avatars and compiles local Tailwind CSS. The renderer receives static HTML/CSS, not a React runtime. Labels/events and surface styling are adapted locally.
Tailwind's license is included in TAILWIND-LICENSE.txt. React/esbuild are build dependencies only. No paid AI SDK Agents blocks, shader packages, external fonts or avatar resources are shipped or fetched at runtime.

Expandable, Halo Progress, Morph Surface and Speech Bubble registry sources are also retained in ui/vendor/cult/ for reference (retrieved 2026-10-28). The pet system card uses a DOM/CSS adaptation of the expandable and progress patterns in pet/hud-card.js and pet/pet.css, rather than adding React/Motion/Base UI to the renderer. It uses native aria-expanded, inert and progressbar semantics; actual telemetry drives the rings and bars.

Halo Search and Popover Form original MIT sources are vendored in ui/vendor/cult (retrieved from https://www.cult-ui.com/r/halo-search.json and https://www.cult-ui.com/r/popover-form.json). The pet input bundles React, Motion, lucide-react, and the shader dependency locally; see package-lock.json for versions.


Timer, Halo Select and Floating Panel registry JSON sources were retrieved from https://www.cult-ui.com/r/{timer,halo-select,floating-panel}.json on 2026-10-29 and retained in ui/vendor/cult/reference/. pet/ui-controls.css, pet/halo-select.js and pet/radial.js adapt their clock, frosted dropdown, selection feedback and trigger-to-panel motion to the existing DOM/Electron hit-testing lifecycle. No additional React/Motion runtime is mounted in the pet. The timer display uses the existing persistent backend countdown instead of a second independent useTimer clock. The old Halo Search React bundle mentioned above is retained as an earlier experiment and is not loaded by current pet/index.html.
