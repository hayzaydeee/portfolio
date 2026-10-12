# components/fx

The WebGL / Canvas effect runtime behind the rooms. Effects are adapted from [ThreeUI Community](https://github.com/MengTo/threeui) (MIT, see `THREEUI_LICENSE`) and rewritten as framework-free renderers that draw in the room palettes.

## Pieces

| File | Job |
|---|---|
| `FxStage.tsx` | The only React host. Renders a poster on the server, lazy-loads the renderer, creates the canvas imperatively (StrictMode-safe), leases a WebGL slot, wires resize, pointer, clicks, audio and reduced motion, and exposes `handle.command()` |
| `runtime/ticker.ts` | One rAF loop for every effect: pauses while the tab is hidden, adapts a global render scale from p90 frame time |
| `runtime/budget.ts` | WebGL context leases (max 6, priority-aware eviction). `window.__fx` debug handle |
| `runtime/palette.ts` | Maps colour roles (`base`, `glow`, `warm`...) to each room's `:root` tokens. The only place effects get colour from |
| `runtime/pointer.ts` | One window pointer store; canvases stay `pointer-events: none` |
| `metas.ts` / `registry.ts` | Server-safe metadata vs. lazily imported renderer code |
| `lib/fx/slots.ts`, `lib/fx/presets.ts` | Named placements on the site and the lab-tuned values for each; `__global` holds site-wide choices (the room transition, each journal's entry plate) |
| `ui/Dock.tsx` | The house navigation in four AnimatedTopDock variants: sable (lobby, edges), modern (notebook, wall), retro (embedded in the workshop IDE bar), glass (studio rail). Styles in `app/styles/dock.css`; magnification in `ui/useDockMagnify.ts` |
| `ui/RoomChrome.tsx` | Root-layout mount that picks the dock for the current room (`lib/rooms.ts` maps URLs to rooms) |
| `ui/TransitionLink.tsx` | A `Link` whose `onNavigate` sends cross-room clicks through the portal; same-room, modified clicks and reduced motion navigate normally |
| `ui/PortalHost.tsx`, `lib/fx/portalStore.ts` | The room transition: cover → push → hold until the new room's backdrop paints (capped) → reveal. Back/forward never covers |
| `ui/RoomLoading.tsx` | Each room's `loading.tsx`: an orb and a decoded line. It holds the portal's reveal while shown, so quick rooms open straight onto content and slow ones onto this; focus moves to the room's `h1` once it gives way |

## UI primitives

Rebuilt from ThreeUI's RectangleButtons, CircleButtons, ArticleHeadings and Brand Orbs (MIT, Meng To). Each takes an optional `room` and otherwise colours itself from the room the URL is in (`ui/usePrimRoom.ts`); the room sets `--prim-*` variables in `app/styles/primitives.css`, so nothing carries a hex value or an inline style. Every hover state also answers `:focus-visible`, and under reduced motion nothing loops or travels.

| Piece | Use |
|---|---|
| `ui/Cta.tsx` | `variant`: `slide`, `beam`, `spin`, `trace`, `keycap` (`emphasis="primary"` for the filled key). With `href` it renders a `TransitionLink` for in-site rooms and a plain `<a>` for mail, files and other origins; without, a `<button>`. Decorative layers are `aria-hidden`, so the label is the name, once |
| `ui/CircleButton.tsx` | `variant`: `glass`, `key`, `trace`. `label` is required (the accessible name); `pressed` sets `aria-pressed` for toggles |
| `ui/Decode.tsx` | `<Decode as="h2" text=… trigger="visible" />` (`trigger` is `mount` by default, or `visible` to wait until it scrolls into view). An sr-only copy is what assistive tech reads, a hidden copy reserves the final box, and the loop writes into an `aria-hidden` layer. `useDecodeGroup(ref)` staggers every `[data-decode]` inside a container |
| `ui/HzyOrb.tsx` | The HZY mark as a 2D dot lattice (`effects/hzy-orb`, no WebGL slot). `size`: `sm` 20px, `md` 56px, `lg` 120px; `handle.command("pulse")` sends a ring out from the centre |
| `ui/IconOrb.tsx` | Any simple-icons glyph as an hzy-orb lattice: the flat icon is the poster, and its own path data (read from the DOM) is what the orb samples (`path` / `viewBox` options) |

## Lobby effects

All 2D, so none of them takes a WebGL slot; the lobby's only context is its horizon.

| Effect | Source | On the site |
|---|---|---|
| `glyph-ball` | Text Path Studies, "Ball" | About: a sphere spun from the bio's letters. A click knocks the facing letters loose; they grow back in the glow (`data-loose` counts them) |
| `generative-tree` | Generative Tree | Seedling: grown from a seed up front with the original's rules, each branch scheduled, so `command("progress", 0..1)` grows it either way with the scroll or the sequence. `command("anchors", { targets, onFrame })` reports tip positions every frame for DOM labels. Left alone it grows, holds and regrows |
| `outline-typeflow` | Text Path Studies II, "Outline Typeflow" | Footer emblem: a phrase running the HZY outline; the pointer lights the type under it, a click shoves it outward |

## Workshop effects

| Effect | Source | In the workshop |
|---|---|---|
| `dot-matrix` | Dot Matrix | The room backdrop (`workshop.backdrop`, mounted in `app/work/layout.tsx`, so it survives moving between pages); panels sit over it slightly translucent |
| `crt-boot` | CRT Background, terminal style | First visit per session: types the workshop's boot log through the CRT shader, then powers off into the IDE (`components/workshop/WorkshopBoot.tsx`). Any key skips it; reduced motion never sees it. Its context goes when it does |
| `condensation` | Condensation | Glass behind `.debug/life.log`, whose lines decode in |
| `ignition` | Ignition Button | The ask terminal's run key, in 2D: a star tunnel that primes on hover or focus (`warp`) and flashes on press (`flash`) |
| `trace-border` | Thinking Button | A comet lapping the ask input while an answer streams |
| `constellation-field`, `warp-field`, `logic-core` | Constellation Field; Warp Field (letters); Platform Core | Project identity fields, picked per project in the admin (`visual_variant`) and drawn in its `visual_accent` token. Warp flies the project's own letters. Unported choices fall back to the constellation (`lib/fx/projectVisuals.ts`) |

`warp-field` and `logic-core` are raw WebGL with `runtime/mat4.ts` for their cameras. `ui/Toggle.tsx` is ThreeUI's modern skeuomorphic toggle as a room primitive (a real `role="switch"`), and the workshop's `loading.tsx` is an uplink loader (`components/workshop/UplinkLoader.tsx`) whose bar eases toward 99 and never claims 100. `/fx-harness/project?variant=…&accent=…` renders a project page from a fixture.

### Written in three

The ThreeUI sources that were built on three are ported to three (pinned at 0.186.1) rather than rewritten by hand. Each is an identity field the admin can pick:

| Effect | Source | On the page |
|---|---|---|
| `structure-flow` | Structure Flow | 15,000 points on a dome below the horizon, fading in from the top. A frame wider than 16:9 shows a strip of the 16:9 view, so a banner gets the dome's shoulders |
| `orbital-sphere` | Orbital Sphere | A wave-shaped sphere of points with tilted orbits and haloed moons, set to the right of a wide frame |
| `warp-keycaps` | Warp Field (keycaps) | Lit, tapered keycaps carrying the project's letters through streaks and glow. A key under the pointer dips (`data-pressed` counts them), a click surges the field (`data-surge`) |

All three lean toward the pointer. Rules on top of the ones below:

- import from `"three"` only inside `effects/<id>/renderer.ts` and the modules only it imports (and `runtime/three.ts`), so three loads with those renderers and never in a route's first bundle; the suite checks the lobby, `/work` and the raw-WebGL identity fields load no three chunk
- `kind: "webgl2"`: three draws through WebGL2, and the stage loses that context after `dispose()`
- build the renderer with `createRenderer(ctx)` and size it with `sizeRenderer()`. Colours go in through `raw()`: the sources target r128, which did no colour management, and a linear output colour space reproduces that while keeping palette RGB untouched
- r128 multiplied ambient and punctual lights by PI (legacy lighting, removed in r165), so lit ports multiply their intensities by PI to match
- `createPointsMaterial()` gives additive points sized like `PointsMaterial` that keep their light below a pixel, with an optional top fade
- `dispose()` frees every geometry, material and texture, then calls `renderer.dispose()`

## Studio effects

| Effect | Source | In the studio |
|---|---|---|
| `bell-field` | Bell Field | The room backdrop (`studio.backdrop`, mounted in `app/music/layout.tsx`): strikes follow kick onsets while music plays |
| `audio-wordmark` | Audio Wordmark (the bar mark) | Beside the featured project: both discs' bars follow 22 and 16 log-spaced spectrum bands while music plays (`data-audio`), and breathe on the original's loop when it's silent |
| `studio-gallery` | Gallery (three) | The projects as a helix of strips (artwork, title, meta). Projects arrive with `command("items", GalleryItem[])`; `drag`/`release` spin it, `pick` raycasts and dispatches `fx:pick` from the canvas, `focus` turns and lifts a project to the front (`data-focus` once it's there), `select` keeps it lit. `components/studio/ProjectsGrid.tsx` pairs it with a list of project buttons, the keyboard and screen-reader twin |
| `track-meter` | the wordmark's bar idiom | The playing track's row: five bars on the analyser bands (`data-peak`) |
| `shader-toggle` | Skeuomorphic Toggle (shader) | Draws the tracks/analysis switch behind a real `role="switch"`; option `on` springs the thumb (`data-on`) |
| `neon-sign` | Neon Typography (Glassblown) | "IN THE LAB" in glass tubes over the works in progress. I, T, H and E are added to the original's glyphs in the same hand |
| `liquid-metal` | Liquid Metal Button (play) | The player bar's play key on the studio's routes (`components/studio/LiquidKey.tsx`), raw WebGL2 in the original's five passes. The button sends `hover`, `focus`, `press {x, y}` and `release`; music lights the metal and kicks throw softer ripples (`data-lit`, `data-audio`, `data-ripples`). The studio claims the key with `useClaimStudioPlayer()` (`lib/audio/studioPlayer.ts`), since the bar lives in the root layout |
| `player-glow` | the wordmark's analyser idiom | 2D light rising off the player bar on every route: five lobes on the analyser bands, brightness on the loudness (`data-loud`), a flare on each kick |
| `stream-convergence` | Stream Convergence | A faint band behind an essay's header; each strand takes a room colour where the original used one channel each |
| `dock-glass` | Animated Top Dock (glass) | The rail's field, now in three as the original was: glass spheres, an icosahedron and a torus over a bloom backdrop rendered to a target. The layout is drawn in the visible frame, so the tall rail and the phone's bar each get a full field (`data-shapes`) |
| `liquid-form` | Liquid Form (Velox) | Slot `studio.about`, off until the lab switches it on: a chrome form behind the about, in three as a displaced icosphere where the original ray-marched; the music swells it |

`/fx-harness/studio` renders the tracks view from fixtures (artwork from `public/fx-test/sleeve.png`, every track the kick fixture, two essays), and `/fx-harness/essay` one essay. A slot entry with `off: true` in `lib/fx/slots.ts` starts dark: its stage shows the poster without loading the effect until a preset enables it.

## Notebook effects

| Effect | Source | In the notebook |
|---|---|---|
| `bookshelf` | Bookshelf (three) | The desk (`notebook.shelf`): the six journals as cloth-bound volumes on a walnut shelf, ported from r165 with the original's construction, light rig and gestures. Volumes arrive with `command("volumes", ShelfVolume[])` (cloth in each journal's token, foil type, the leaves printed with the latest six entries); `step`, `select`, `inspect`, `book`, `page`, `close` and `reset` drive it, and it reports `fx:shelf` events (`select`, `hover`, `mode`, `book`, `entry` for a click on a printed page). The page hands it an interaction surface (`surface`) and the side panel's left edge (`panel`). It draws only while something moves and holds its last frame otherwise (`data-draws`). `components/notebook/Shelf.tsx` owns every control as DOM, with a list of the journals as the keyboard and screen-reader twin |
| `cloth-study` | Text Path Studies II, "Cloth" | The banner on the shelf's wall (`notebook.cloth`): the journals' names woven through a sheet of letters on six pegs. `grab`/`pull`/`drop` come from the page's pointer layer (`data-held`); `tug` throws a gust |
| `woven-cloth` | Woven Cloth (washi noren) | A journal's heading (`notebook.noren`): a three-panel noren dyed in the journal's token before a shoji in the page's own paper, with the journal's name, its motif as a crest and its numeral on a seal resisted out of the dye. The panels sway in a draft and part where the pointer passes; `gust` throws one. The verlet cloth is settled before the first frame, so it never drops into place |
| `engraved-plate` | Engraved Certificate (Kinetic Lathe) | An entry plate (`notebook.plate.engraved`): a wave-ruled ground in a guilloché border and a medallion whose rosettes are seeded by the entry's slug, so no two entries share one. The medallion sits beside the header on a wide plate and fades to a watermark on a narrow one; only its inner ring turns, repainting its own square |
| `particle-drift` | Particle Drift | An entry plate (`notebook.plate.drift`): the entry's own letters (code glyphs in the build log) drifting down through rising beams in the journal's ink, dark on the page; the pointer catches the nearest |

Entry plates are chosen per journal in the lab (engraved, drift or none; `components/notebook/EntryPlate.tsx` reads them from the globals). The page turn between entries (`components/notebook/PageCurl.tsx`, styles in `app/styles/notebook.css`) is ThreeUI's Sketchbook leaf rebuilt as DOM: a chain of fourteen nested strips, each turned a little further than its parent so the page bends as it goes over, lit per strip by the angle it faces. The leaf carries a snapshot of the page sliced per strip, with the neighbour's head waiting underneath; the corner drag, the arrow keys and the links at the end of an entry all turn it, and reduced motion navigates straight away. Entry bodies are sanitized on the server (`lib/notebook/entryHtml.ts`), so DOMPurify never ships to the browser. `/fx-harness/notebook/<journal>` and `/fx-harness/notebook/<journal>/<slug>` render a journal and its entries from fixtures.

Two notes on the shelf beyond the rules for effects in three: it is an r165 port, so it renders the way the original does (sRGB output, ACES at a lower exposure for a cream room, lights in physical units with no PI factor) rather than through `createRenderer()`; and its leaves are printed only when a volume is first taken down. `/fx-harness/notebook` renders the desk from fixtures (`?exposure=`, `?environment=` and `?tint=` override the lab values).

## Wall effects

| Effect | Source | On the wall |
|---|---|---|
| `gallery-ring` | Gallery Heading ("One Wall, Twelve Plates") | The heading (`wall.heading`): "the wall" ringed by twelve 4:3 plates on a tilted ring, passing behind the type and in front of it. The plates take the pieces' colours (`plates` command, from `components/wall/usePieceColours.ts`; the original's palette until they're read, `data-plate-source`), each shaded on a halftone screen. It rests until the pointer is over it, then eases up to a turn every fifteen seconds, and it arrives turning so it's seen to move once (`data-turning`). It draws only while it turns |
| `dust-motes` | after Particle Drift | The room's backdrop (`wall.backdrop`, mounted in `app/wall/layout.tsx`): afternoon light through a four-pane window, a beam to a patch on the wall with the mullions in both, and dust drifting through it, lit only where the beam catches it. The pointer stirs it |
| `ember-seal` | Spark Badge (its technique) | A sealed piece (`wall.seal`): a wax seal drawn in embers thrown off its scalloped edge, its carved ring and its lettering, bent by shared curl fields, with rain across the dark plate. Seeded by the piece, so no two burn alike |

A polaroid's lean toward the pointer and the way its photo develops (tiles of undeveloped film clearing left to right, then the colour coming up) are Koi Studies' tilt and pixel reveal, in `components/wall/polaroidMotion.ts` and `app/styles/wall.css`; the veil is in the server's markup so a photo already in view never flashes first. `/fx-harness/wall` renders the wall from fixtures (`?empty=1` for the placeholders, `?sealed=0` without seals).

`--z-backdrop` is negative, so a fixed backdrop paints under any in-flow element with a background. A light room that keeps its colour on the layout (the wall, unlike the studio) makes that wrapper its own stacking context (`isolate`), so the backdrop lands between the colour and the page.

The lobby sections share one progress source (`components/lobby/sectionProgress.ts`): scroll in the resting page, a timed 0 to 1 per slide in the sequence. Each section poses the horizon (`components/lobby/poses.ts`), and `data-gesture-capture="x"` (or `"all"`) on an element keeps the sequence's wheel, swipe and arrow handling off the gestures it needs.

## Adding an effect

1. `effects/<id>/meta.ts`: options type, defaults, controls (they drive the lab UI and preset validation), kind, priority, pixel budget.
2. `effects/<id>/renderer.ts`: export `create(ctx, opts): FxInstance`. Rules:
   - never call `requestAnimationFrame`; the ticker calls `render(now, dt)`
   - advance time from `dt`, not wall clock, so pausing doesn't jump
   - colours come from `ctx.palette` roles, passed as sRGB `[r, g, b]` with no colour-space conversion; keep the authored colours behind `sourcePalette` for fidelity checks
   - you may set `style.opacity` on canvases you own, never on `ctx.layer` (the stage fades the layer in)
   - implement `still()` for reduced motion and `dispose()` that frees every GPU object and any extra DOM it appended to `ctx.layer`
   - no CDN scripts, GSAP, Tailwind Play or remote media from the original document
   - a 2D effect that strokes dense paths (thousands of segments in one path) asks for `getContext("2d", { willReadFrequently: true })`: the CPU rasters them in milliseconds where the GPU path renderer can take seconds, and the canvas copies cheaply
3. Register it in `metas.ts` and `registry.ts`; give it a slot in `lib/fx/slots.ts` if it renders on the site.
4. Add harness routes to `scripts/fx-verify.mjs` and run the suite.

## Verify

```bash
npm run build && FX_HARNESS=1 npx next start -p 3100
FX_BASE=http://localhost:3100 node scripts/fx-verify.mjs
```

Effects render at `/fx-harness/<id>?room=<room>` (add `&source=1` for original colours, `&audio=1` for the kick fixture, `&demo=<room>` on the transition effects for a trip button). `/fx-harness/dock?room=<room>&hide=wall,studio` renders one dock with rooms switched off. `/fx-harness/primitives?room=<room>` lays out every primitive (all rooms without `room`). The harness 404s in production unless `FX_HARNESS=1`.

A backdrop slot (`*.backdrop`) holds the portal's reveal until its first frame, so a room never opens on a blank poster; rooms without one reveal as soon as their route renders.
