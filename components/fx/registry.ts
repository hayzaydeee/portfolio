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
};
