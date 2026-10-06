/**
 * One requestAnimationFrame loop for every effect on the page. Renderers never schedule
 * their own frames: the ticker pauses everything while the document is hidden, resumes
 * on return, and adapts a global render scale from frame-time percentiles.
 */

type TickEntry = {
  render: (now: number, dt: number) => void;
  /** Visible, live and not reduced-motion */
  isActive: () => boolean;
  frames: number;
  cpuMs: number;
};

type TickerState = {
  entries: Map<string, TickEntry>;
  raf: number;
  lastNow: number;
  frameTimes: number[];
  renderScale: number;
  scaleListeners: Set<(scale: number) => void>;
  lastScaleChange: number;
};

const GLOBAL_KEY = "__hzyFxTicker";
type G = typeof globalThis & { [GLOBAL_KEY]?: TickerState };

const FRAME_WINDOW = 120;
const SLOW_P90_MS = 22;
const FAST_P90_MS = 14;
const SCALE_STEP_DOWN = 0.85;
const SCALE_STEP_UP = 1.1;
const SCALE_FLOOR = 0.5;
const SCALE_COOLDOWN_MS = 2000;

/** Single seam for visibility so tests can override document.hidden */
export function isDocumentHidden(): boolean {
  return typeof document !== "undefined" && document.hidden;
}

function state(): TickerState {
  const g = globalThis as G;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = {
      entries: new Map(),
      raf: 0,
      lastNow: 0,
      frameTimes: [],
      renderScale: 1,
      scaleListeners: new Set(),
      lastScaleChange: 0,
    };
    document.addEventListener("visibilitychange", () => {
      if (isDocumentHidden()) stop();
      else start();
    });
  }
  return g[GLOBAL_KEY]!;
}

function p90(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * 0.9)] ?? 0;
}

function adaptScale(now: number, dt: number) {
  const s = state();
  s.frameTimes.push(dt);
  if (s.frameTimes.length > FRAME_WINDOW) s.frameTimes.shift();
  if (s.frameTimes.length < FRAME_WINDOW || now - s.lastScaleChange < SCALE_COOLDOWN_MS) return;

  const slow = p90(s.frameTimes);
  let next = s.renderScale;
  if (slow > SLOW_P90_MS) next = Math.max(SCALE_FLOOR, s.renderScale * SCALE_STEP_DOWN);
  else if (slow < FAST_P90_MS && s.renderScale < 1) next = Math.min(1, s.renderScale * SCALE_STEP_UP);
  if (next !== s.renderScale) {
    s.renderScale = next;
    s.lastScaleChange = now;
    s.frameTimes.length = 0;
    s.scaleListeners.forEach((cb) => cb(next));
  }
}

function tick(now: number) {
  const s = state();
  s.raf = 0;
  if (isDocumentHidden()) return;

  const dt = s.lastNow ? Math.min(now - s.lastNow, 100) : 16.67;
  s.lastNow = now;

  let anyActive = false;
  for (const entry of s.entries.values()) {
    if (!entry.isActive()) continue;
    anyActive = true;
    const t0 = performance.now();
    entry.render(now, dt);
    entry.cpuMs += performance.now() - t0;
    entry.frames += 1;
  }
  if (anyActive) adaptScale(now, dt);
  if (s.entries.size > 0) s.raf = requestAnimationFrame(tick);
}

function start() {
  const s = state();
  if (s.raf || s.entries.size === 0 || isDocumentHidden()) return;
  s.lastNow = 0; // no giant dt after a pause
  s.raf = requestAnimationFrame(tick);
}

function stop() {
  const s = state();
  if (s.raf) cancelAnimationFrame(s.raf);
  s.raf = 0;
}

export function addToTicker(
  id: string,
  render: TickEntry["render"],
  isActive: TickEntry["isActive"]
): () => void {
  const s = state();
  s.entries.set(id, { render, isActive, frames: 0, cpuMs: 0 });
  start();
  return () => {
    s.entries.delete(id);
    if (s.entries.size === 0) stop();
  };
}

export function getRenderScale(): number {
  return typeof window === "undefined" ? 1 : state().renderScale;
}

export function onRenderScaleChange(cb: (scale: number) => void): () => void {
  const s = state();
  s.scaleListeners.add(cb);
  return () => s.scaleListeners.delete(cb);
}

export function tickerStats() {
  const s = state();
  return {
    running: s.raf !== 0,
    renderScale: s.renderScale,
    stages: [...s.entries.entries()].map(([id, e]) => ({
      id,
      active: e.isActive(),
      frames: e.frames,
      cpuMsPerFrame: e.frames ? +(e.cpuMs / e.frames).toFixed(3) : 0,
    })),
  };
}
