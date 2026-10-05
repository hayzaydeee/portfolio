import type { FxModule, FxOptions } from "./runtime/types";
import type { FxId } from "./metas";

/** Renderer modules load on demand, so no effect code ships in a route's first bundle. */
export const FX_LOADERS: Record<FxId, () => Promise<FxModule<FxOptions>>> = {
  "bell-field": () => import("./effects/bell-field/renderer") as unknown as Promise<FxModule<FxOptions>>,
  "emerald-horizon": () => import("./effects/emerald-horizon/renderer") as unknown as Promise<FxModule<FxOptions>>,
};
