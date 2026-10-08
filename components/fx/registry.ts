import type { FxModule, FxOptions } from "./runtime/types";
import type { FxId } from "./metas";

type Loader = () => Promise<FxModule<FxOptions>>;

/** Renderer modules load on demand, so no effect code ships in a route's first bundle. */
export const FX_LOADERS: Record<FxId, Loader> = {
  "bell-field": () => import("./effects/bell-field/renderer") as unknown as ReturnType<Loader>,
  "emerald-horizon": () => import("./effects/emerald-horizon/renderer") as unknown as ReturnType<Loader>,
  "dock-retro": () => import("./effects/dock-retro/renderer") as unknown as ReturnType<Loader>,
  "dock-glass": () => import("./effects/dock-glass/renderer") as unknown as ReturnType<Loader>,
  "portal-field": () => import("./effects/portal-field/renderer") as unknown as ReturnType<Loader>,
  "glyph-vortex": () => import("./effects/glyph-vortex/renderer") as unknown as ReturnType<Loader>,
  "hzy-orb": () => import("./effects/hzy-orb/renderer") as unknown as ReturnType<Loader>,
  "glyph-ball": () => import("./effects/glyph-ball/renderer") as unknown as ReturnType<Loader>,
  "generative-tree": () => import("./effects/generative-tree/renderer") as unknown as ReturnType<Loader>,
  "outline-typeflow": () => import("./effects/outline-typeflow/renderer") as unknown as ReturnType<Loader>,
  "dot-matrix": () => import("./effects/dot-matrix/renderer") as unknown as ReturnType<Loader>,
  "condensation": () => import("./effects/condensation/renderer") as unknown as ReturnType<Loader>,
  "ignition": () => import("./effects/ignition/renderer") as unknown as ReturnType<Loader>,
  "trace-border": () => import("./effects/trace-border/renderer") as unknown as ReturnType<Loader>,
  "crt-boot": () => import("./effects/crt-boot/renderer") as unknown as ReturnType<Loader>,
  "constellation-field": () => import("./effects/constellation-field/renderer") as unknown as ReturnType<Loader>,
  "warp-field": () => import("./effects/warp-field/renderer") as unknown as ReturnType<Loader>,
  "logic-core": () => import("./effects/logic-core/renderer") as unknown as ReturnType<Loader>,
  "structure-flow": () => import("./effects/structure-flow/renderer") as unknown as ReturnType<Loader>,
  "orbital-sphere": () => import("./effects/orbital-sphere/renderer") as unknown as ReturnType<Loader>,
  "warp-keycaps": () => import("./effects/warp-keycaps/renderer") as unknown as ReturnType<Loader>,
  "audio-wordmark": () => import("./effects/audio-wordmark/renderer") as unknown as ReturnType<Loader>,
  "neon-sign": () => import("./effects/neon-sign/renderer") as unknown as ReturnType<Loader>,
  "track-meter": () => import("./effects/track-meter/renderer") as unknown as ReturnType<Loader>,
  "shader-toggle": () => import("./effects/shader-toggle/renderer") as unknown as ReturnType<Loader>,
  "studio-gallery": () => import("./effects/studio-gallery/renderer") as unknown as ReturnType<Loader>,
};
