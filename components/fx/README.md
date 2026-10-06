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

Effects render at `/fx-harness/<id>?room=<room>` (add `&source=1` for original colours, `&audio=1` for the kick fixture, `&demo=<room>` on the transition effects for a trip button). `/fx-harness/dock?room=<room>&hide=wall,studio` renders one dock with rooms switched off. The harness 404s in production unless `FX_HARNESS=1`.

A backdrop slot (`*.backdrop`) holds the portal's reveal until its first frame, so a room never opens on a blank poster; rooms without one reveal as soon as their route renders.
