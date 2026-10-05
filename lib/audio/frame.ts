import { getAnalyser, getEngine } from "./engine";

/**
 * Per-frame audio analysis, memoised by timestamp so any number of visuals reading the
 * same rAF tick cost one FFT read. Visuals call readFrame(now) inside their render loop;
 * nothing here touches React state.
 */
export type AudioFrame = {
  /** Raw byte spectrum (fftSize / 2 bins) */
  bins: Uint8Array;
  /** sub, bass, lowMid, mid, high: mean energy 0..1 */
  bands: Float32Array;
  /** Time-domain RMS 0..1 */
  rms: number;
  /** Half-wave rectified spectral flux over the kick range, frame-rate normalised */
  flux: number;
  /** 0 on most frames; the flux strength on a detected onset */
  onset: number;
  playing: boolean;
};

const BAND_EDGES_HZ: readonly [number, number][] = [
  [20, 60],
  [60, 250],
  [250, 500],
  [500, 2000],
  [2000, 8000],
];
const KICK_RANGE_HZ: [number, number] = [40, 160];
const HISTORY_MS = 1000;
const REFRACTORY_MS = 280;
const THRESHOLD_FLOOR = 0.015;

type Analysis = {
  analyser: AnalyserNode;
  bins: Uint8Array<ArrayBuffer>;
  prevBins: Uint8Array<ArrayBuffer>;
  wave: Float32Array<ArrayBuffer>;
  bandRanges: [number, number][];
  kick: [number, number];
  history: { t: number; flux: number }[];
  lastNow: number;
  lastOnset: number;
  prevFlux: number;
  frame: AudioFrame;
};

let analysis: Analysis | null = null;

/** Running counters for the verification suite (window.__fx.audio) */
const stats = { frames: 0, onsets: 0, binsMax: 0, rmsMax: 0 };
export function audioStats() {
  return { ...stats, analyser: getAnalyser() !== null };
}

function binFor(hz: number, analyser: AnalyserNode) {
  const binHz = analyser.context.sampleRate / analyser.fftSize;
  return Math.min(analyser.frequencyBinCount - 1, Math.max(0, Math.round(hz / binHz)));
}

function setup(analyser: AnalyserNode): Analysis {
  const n = analyser.frequencyBinCount;
  const bins = new Uint8Array(n);
  return {
    analyser,
    bins,
    prevBins: new Uint8Array(n),
    wave: new Float32Array(analyser.fftSize),
    bandRanges: BAND_EDGES_HZ.map(([lo, hi]) => [binFor(lo, analyser), binFor(hi, analyser)]),
    kick: [binFor(KICK_RANGE_HZ[0], analyser), binFor(KICK_RANGE_HZ[1], analyser)],
    history: [],
    lastNow: -1,
    lastOnset: -Infinity,
    prevFlux: 0,
    frame: { bins, bands: new Float32Array(BAND_EDGES_HZ.length), rms: 0, flux: 0, onset: 0, playing: false },
  };
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function readFrame(now: number): AudioFrame | null {
  const analyser = getAnalyser();
  if (!analyser) return null;
  if (!analysis || analysis.analyser !== analyser) analysis = setup(analyser);
  const a = analysis;
  if (now === a.lastNow) return a.frame;

  const dt = a.lastNow < 0 ? 16.67 : now - a.lastNow;
  a.lastNow = now;
  // A long gap means the tab was hidden; stale history would fire a false onset
  if (dt > 250) a.history.length = 0;

  a.prevBins.set(a.bins);
  a.analyser.getByteFrequencyData(a.bins);
  a.analyser.getFloatTimeDomainData(a.wave);

  for (let b = 0; b < a.bandRanges.length; b++) {
    const [lo, hi] = a.bandRanges[b];
    let sum = 0;
    for (let k = lo; k <= hi; k++) sum += a.bins[k];
    a.frame.bands[b] = sum / ((hi - lo + 1) * 255);
  }

  let sq = 0;
  for (let i = 0; i < a.wave.length; i++) sq += a.wave[i] * a.wave[i];
  a.frame.rms = Math.min(1, Math.sqrt(sq / a.wave.length));

  const [k0, k1] = a.kick;
  let rise = 0;
  for (let k = k0; k <= k1; k++) rise += Math.max(0, a.bins[k] - a.prevBins[k]);
  const flux = (rise / (255 * (k1 - k0 + 1))) * (16.67 / Math.max(dt, 1));
  a.frame.flux = flux;

  a.history.push({ t: now, flux });
  while (a.history.length && now - a.history[0].t > HISTORY_MS) a.history.shift();

  let onset = 0;
  if (a.history.length > 8) {
    const values = a.history.map((h) => h.flux);
    const med = median(values);
    const mad = median(values.map((v) => Math.abs(v - med)));
    const threshold = med + 1.5 * mad + THRESHOLD_FLOOR;
    const rising = flux > a.prevFlux;
    if (rising && flux > threshold && now - a.lastOnset > REFRACTORY_MS) {
      onset = flux;
      a.lastOnset = now;
    }
  }
  a.prevFlux = flux;
  a.frame.onset = onset;

  stats.frames += 1;
  if (onset > 0) stats.onsets += 1;
  stats.rmsMax = Math.max(stats.rmsMax, a.frame.rms);
  for (let k = 0; k < a.bins.length; k++) if (a.bins[k] > stats.binsMax) stats.binsMax = a.bins[k];

  const el = getEngine()?.el;
  a.frame.playing = !!el && !el.paused && !el.ended;
  return a.frame;
}

/** True once the graph exists and the media host allowed CORS. */
export function hasAnalyser(): boolean {
  return getAnalyser() !== null;
}
