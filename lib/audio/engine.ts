/**
 * Framework-free audio engine shared by the player and every audio-reactive visual.
 *
 * One HTMLAudioElement for the whole site, created lazily on the client and kept on
 * globalThis so Fast Refresh never builds a second element or a second Web Audio graph
 * (createMediaElementSource throws if called twice for the same element).
 *
 *   element ─▶ MediaElementSource ─▶ Analyser ─▶ Gain (volume) ─▶ destination
 *
 * The analyser sits before the gain so visuals keep reacting at low volume. Volume goes
 * through the gain because HTMLMediaElement.volume is read-only on iOS.
 */

type Graph = {
  ctx: AudioContext;
  source: MediaElementAudioSourceNode;
  analyser: AnalyserNode;
  gain: GainNode;
};

type EngineState = {
  el: HTMLAudioElement;
  graph: Graph | null;
  /** The media host refused CORS; playback continues without analysis. */
  corsBroken: boolean;
  /** At least one source has reached canplay with crossOrigin set. */
  corsProven: boolean;
  volume: number;
  events: EventTarget;
};

export const ENGINE_EVENTS = [
  "timeupdate",
  "loadedmetadata",
  "durationchange",
  "seeked",
  "emptied",
  "play",
  "pause",
  "ended",
  "error",
] as const;

export type EngineEvent = (typeof ENGINE_EVENTS)[number];

const GLOBAL_KEY = "__hzyAudio";
type GlobalWithEngine = typeof globalThis & { [GLOBAL_KEY]?: EngineState };

function forward(state: EngineState, el: HTMLAudioElement) {
  for (const type of ENGINE_EVENTS) {
    el.addEventListener(type, () => state.events.dispatchEvent(new Event(type)));
  }
  el.addEventListener("canplay", () => {
    if (el.crossOrigin) state.corsProven = true;
  });
  el.addEventListener("error", () => handleError(state, el));
}

function createElement(withCors: boolean): HTMLAudioElement {
  const el = new Audio();
  // Must be set before any src, or the analyser reads silence from cross-origin media
  if (withCors) el.crossOrigin = "anonymous";
  el.preload = "metadata";
  return el;
}

/**
 * With crossOrigin set, a host without CORS headers makes the element fail to load
 * (better than the silent analyser you'd get otherwise). If that happens before any
 * source has ever loaded, fall back to a plain element so music still plays.
 */
function handleError(state: EngineState, el: HTMLAudioElement) {
  if (el !== state.el || !el.crossOrigin || state.corsProven || state.corsBroken) return;
  const src = el.currentSrc || el.src;
  if (!src) return;
  state.corsBroken = true;
  const plain = createElement(false);
  plain.volume = state.volume;
  plain.loop = el.loop;
  forward(state, plain);
  state.el = plain;
  plain.src = src;
  plain.play().catch(() => {});
}

export function getEngine(): EngineState | null {
  if (typeof window === "undefined") return null;
  const g = globalThis as GlobalWithEngine;
  if (!g[GLOBAL_KEY]) {
    const state: EngineState = {
      el: createElement(true),
      graph: null,
      corsBroken: false,
      corsProven: false,
      volume: 0.8,
      events: new EventTarget(),
    };
    state.el.volume = state.volume;
    forward(state, state.el);
    g[GLOBAL_KEY] = state;
  }
  return g[GLOBAL_KEY]!;
}

/**
 * Build the Web Audio graph. Call synchronously at the top of a click handler, before
 * any await, so the AudioContext is created and resumed inside the user gesture.
 */
export function ensureGraph(): Graph | null {
  const state = getEngine();
  if (!state || state.corsBroken) return null;

  if (!state.graph) {
    const Ctor =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;

    // iOS: without this, Web Audio output obeys the hardware silent switch
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = "playback";

    try {
      const ctx = new Ctor({ latencyHint: "playback" });
      const source = ctx.createMediaElementSource(state.el);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0;
      const gain = ctx.createGain();
      gain.gain.value = state.volume;
      source.connect(analyser).connect(gain).connect(ctx.destination);
      // The gain now owns volume; the element stays at unity
      state.el.volume = 1;
      state.graph = { ctx, source, analyser, gain };

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && ctx.state !== "running") {
          void ctx.resume();
        }
      });
    } catch {
      return null;
    }
  }

  // Covers "suspended" and Safari's "interrupted"
  if (state.graph.ctx.state !== "running") void state.graph.ctx.resume();
  return state.graph;
}

export function setEngineVolume(v: number) {
  const state = getEngine();
  if (!state) return;
  state.volume = v;
  if (state.graph && !state.corsBroken) state.graph.gain.gain.value = v;
  else state.el.volume = v;
}

export function getAnalyser(): AnalyserNode | null {
  const state = getEngine();
  if (!state || state.corsBroken || !state.graph) return null;
  return state.graph.analyser;
}

export function subscribeEngine(types: readonly EngineEvent[], cb: () => void): () => void {
  const state = getEngine();
  if (!state) return () => {};
  for (const t of types) state.events.addEventListener(t, cb);
  return () => {
    for (const t of types) state.events.removeEventListener(t, cb);
  };
}
