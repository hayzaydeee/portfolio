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
| `lib/fx/slots.ts`, `lib/fx/presets.ts` | Named placements on the site and the lab-tuned values for each; `__global` holds site-wide choices (the room transition) |
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
3. Register it in `metas.ts` and `registry.ts`; give it a slot in `lib/fx/slots.ts` if it renders on the site.
4. Add harness routes to `scripts/fx-verify.mjs` and run the suite.

## Verify

```bash
npm run build && FX_HARNESS=1 npx next start -p 3100
FX_BASE=http://localhost:3100 node scripts/fx-verify.mjs
```

Effects render at `/fx-harness/<id>?room=<room>` (add `&source=1` for original colours, `&audio=1` for the kick fixture, `&demo=<room>` on the transition effects for a trip button). `/fx-harness/dock?room=<room>&hide=wall,studio` renders one dock with rooms switched off. `/fx-harness/primitives?room=<room>` lays out every primitive (all rooms without `room`). The harness 404s in production unless `FX_HARNESS=1`.

A backdrop slot (`*.backdrop`) holds the portal's reveal until its first frame, so a room never opens on a blank poster; rooms without one reveal as soon as their route renders.
