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

type FrameSample = { at: number; dt: number };

type TickerState = {
  entries: Map<string, TickEntry>;
  raf: number;
  lastNow: number;
  /** Frames of the current judging window, oldest first */
  samples: FrameSample[];
  /** When the window's first frame landed; 0 while it holds none */
  windowStart: number;
  renderScale: number;
  scaleListeners: Set<(scale: number) => void>;
  lastScaleChange: number;
};

const GLOBAL_KEY = "__hzyFxTicker";
type G = typeof globalThis & { [GLOBAL_KEY]?: TickerState };

/** p90 over this much time, so a 5 fps device steps as soon as a 60 fps one does */
const WINDOW_MS = 2000;
/** Two seconds holds too few frames for a p90 below 6 fps, so the window never keeps fewer */
const MIN_SAMPLES = 12;
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
      samples: [],
      windowStart: 0,
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

function p90(samples: FrameSample[]) {
  const sorted = samples.map((f) => f.dt).sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * 0.9)] ?? 0;
}

function resetWindow(s: TickerState) {
  s.samples.length = 0;
  s.windowStart = 0;
}

function adaptScale(now: number, dt: number) {
  const s = state();
  if (!s.samples.length) s.windowStart = now;
  s.samples.push({ at: now, dt });
  while (s.samples.length > MIN_SAMPLES && now - s.samples[0].at > WINDOW_MS) s.samples.shift();
  // Judge only a full window: two seconds watched (as long at 60 fps as at 5), with frames enough for a p90
  if (now - s.windowStart < WINDOW_MS || s.samples.length < MIN_SAMPLES) return;
  if (now - s.lastScaleChange < SCALE_COOLDOWN_MS) return;

  const slow = p90(s.samples);
  let next = s.renderScale;
  if (slow > SLOW_P90_MS) next = Math.max(SCALE_FLOOR, s.renderScale * SCALE_STEP_DOWN);
  else if (slow < FAST_P90_MS && s.renderScale < 1) next = Math.min(1, s.renderScale * SCALE_STEP_UP);
  if (next !== s.renderScale) {
    s.renderScale = next;
    s.lastScaleChange = now;
    resetWindow(s);
    s.scaleListeners.forEach((cb) => cb(next));
  }
}

function tick(now: number) {
  const s = state();
  s.raf = 0;
  if (isDocumentHidden()) return;

  const dt = s.lastNow ? Math.min(now - s.lastNow, 100) : 16.67;
  s.lastNow = now;

  const active = [...s.entries].filter(([, entry]) => entry.isActive());
  // Before drawing: stages resized by a scale step draw this frame at the new size instead of presenting a cleared buffer
  if (active.length) adaptScale(now, dt);
  // Frames from before an idle spell say nothing about the ones after it
  else resetWindow(s);
  for (const [id, entry] of active) {
    if (s.entries.get(id) !== entry) continue; // removed earlier this frame
    const t0 = performance.now();
    entry.render(now, dt);
    entry.cpuMs += performance.now() - t0;
    entry.frames += 1;
  }
  if (s.entries.size > 0) s.raf = requestAnimationFrame(tick);
}

function start() {
  const s = state();
  if (s.raf || s.entries.size === 0 || isDocumentHidden()) return;
  s.lastNow = 0; // no giant dt after a pause
  resetWindow(s); // and no frames from before it
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
