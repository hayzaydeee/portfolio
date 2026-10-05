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
| `lib/fx/slots.ts`, `lib/fx/presets.ts` | Named placements on the site and the lab-tuned values for each |

## Adding an effect

1. `effects/<id>/meta.ts`: options type, defaults, controls (they drive the lab UI and preset validation), kind, priority, pixel budget.
2. `effects/<id>/renderer.ts`: export `create(ctx, opts): FxInstance`. Rules:
   - never call `requestAnimationFrame`; the ticker calls `render(now, dt)`
   - advance time from `dt`, not wall clock, so pausing doesn't jump
   - colours come from `ctx.palette` roles, passed as sRGB `[r, g, b]` with no colour-space conversion; keep the authored colours behind `sourcePalette` for fidelity checks
   - implement `still()` for reduced motion and `dispose()` that frees every GPU object and any extra DOM it appended to `ctx.layer`
   - no CDN scripts, GSAP, Tailwind Play or remote media from the original document
3. Register it in `metas.ts` and `registry.ts`; give it a slot in `lib/fx/slots.ts` if it renders on the site.
4. Add harness routes to `scripts/fx-verify.mjs` and run the suite.

## Verify

```bash
npm run build && FX_HARNESS=1 npx next start -p 3100
FX_BASE=http://localhost:3100 node scripts/fx-verify.mjs
```

Effects render at `/fx-harness/<id>?room=<room>` (add `&source=1` for original colours, `&audio=1` for the kick fixture). The harness 404s in production unless `FX_HARNESS=1`.
