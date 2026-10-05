import type { AudioFrame } from "@/lib/audio/frame";

export type RoomKey = "lobby" | "workshop" | "studio" | "notebook" | "wall";

/** sRGB components in 0..1, passed to shaders untouched (no colour-space conversion). */
export type RGB = [number, number, number];

/**
 * Semantic colour roles every effect draws from. Each room maps the roles to its own
 * :root tokens (see palette.ts), so one renderer recolours per room without filters.
 */
export type PaletteRole = "base" | "surface" | "text" | "muted" | "accent" | "glow" | "deep" | "warm";

export type RoomPalette = { room: RoomKey } & Record<PaletteRole, RGB>;

export type FxKind = "webgl" | "webgl2" | "2d";

/** 3 chrome (dock, portal) · 2 backdrop · 1 feature · 0 ornament / preview */
export type FxPriority = 0 | 1 | 2 | 3;

export type RangeControl = {
  kind: "range";
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
};

export type ChoiceControl = {
  kind: "choice";
  key: string;
  label: string;
  options: readonly { value: string; label: string }[];
};

export type ToggleControl = {
  kind: "toggle";
  key: string;
  label: string;
};

export type FxControl = RangeControl | ChoiceControl | ToggleControl;

export type FxOptionValue = number | string | boolean;
export type FxOptions = Record<string, FxOptionValue>;

export type FxMeta<O extends FxOptions = FxOptions> = {
  id: string;
  label: string;
  description: string;
  /** Where the port came from, for attribution in the lab and colophon */
  source: { name: string; url: string; license: "MIT" };
  kind: FxKind;
  priority: FxPriority;
  /** Max drawing-buffer megapixels; the stage lowers pixel ratio to stay under it */
  pixelBudget: number;
  defaults: O;
  controls: readonly FxControl[];
  /** Receives click commands from the window dispatcher when the pointer is over it */
  wantsClicks?: boolean;
  /** Reads the shared audio analyser when one exists */
  audio?: boolean;
  /** Rooms this effect has palette mappings tuned for */
  rooms: readonly RoomKey[];
  /** Buttons the lab offers for trying an effect's commands */
  demoCommands?: readonly { label: string; name: string; arg?: unknown }[];
};

export type LocalPointer = {
  /** CSS px relative to the stage host */
  x: number;
  y: number;
  /** Pointer currently over the stage */
  inside: boolean;
  /** Has moved at least once since load */
  seen: boolean;
};

export type FxContext = {
  canvas: HTMLCanvasElement;
  /** Layer the canvas lives in; renderers may append extra canvases here and must remove them */
  layer: HTMLElement;
  palette: RoomPalette;
  pointer: () => LocalPointer;
  audio: ((now: number) => AudioFrame | null) | null;
  reducedMotion: boolean;
};

export interface FxInstance<O extends FxOptions = FxOptions> {
  resize(cssWidth: number, cssHeight: number, pixelRatio: number): void;
  render(now: number, dt: number): void;
  update(opts: Partial<O>): void;
  setPalette?(palette: RoomPalette): void;
  /** Settle into a representative still frame for reduced motion */
  still?(): void;
  command?(name: string, arg?: unknown): void;
  /** Resolves once the first frame can be drawn without a hitch */
  ready?: Promise<void>;
  /** Free every GPU and DOM resource; the stage loses the context afterwards */
  dispose(): void;
}

export type FxModule<O extends FxOptions = FxOptions> = {
  create(ctx: FxContext, opts: O): FxInstance<O>;
};
