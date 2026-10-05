"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { Track, MusicProject } from "@/app/actions/studio";
import { ensureGraph, getEngine, setEngineVolume, subscribeEngine } from "./engine";

export type PlayableTrack = Track & {
  artworkPath?: string | null;
  projectTitle?: string;
};

type AudioControlState = {
  currentTrack: PlayableTrack | null;
  playlist: PlayableTrack[];
  isPlaying: boolean;
  volume: number;
  loop: boolean;
};

type AudioActions = {
  play: (track: PlayableTrack, playlist?: PlayableTrack[]) => void;
  pause: () => void;
  resume: () => void;
  seek: (seconds: number) => void;
  next: () => void;
  prev: () => void;
  setVolume: (v: number) => void;
  toggleLoop: () => void;
};

type AudioControlValue = AudioControlState & AudioActions;

export type AudioTime = {
  currentTime: number;
  duration: number;
  progress: number;
};

const AudioControlContext = createContext<AudioControlValue | null>(null);

// ── Time store: high-frequency state lives outside React context ──────────────

const ZERO_TIME: AudioTime = { currentTime: 0, duration: 0, progress: 0 };
let timeSnapshot: AudioTime = ZERO_TIME;

// The snapshot only changes when the element reports time, so getSnapshot stays stable
// between events (reading el.currentTime directly would differ on every call)
function captureTime() {
  const el = getEngine()?.el;
  if (!el) return;
  const duration = Number.isFinite(el.duration) ? el.duration : 0;
  const currentTime = el.currentTime;
  if (currentTime === timeSnapshot.currentTime && duration === timeSnapshot.duration) return;
  timeSnapshot = { currentTime, duration, progress: duration > 0 ? currentTime / duration : 0 };
}

const TIME_EVENTS = ["timeupdate", "loadedmetadata", "durationchange", "seeked", "emptied"] as const;

function subscribeTime(cb: () => void) {
  return subscribeEngine(TIME_EVENTS, () => {
    captureTime();
    cb();
  });
}

function getTimeSnapshot() {
  return timeSnapshot;
}

/** Playback position, re-rendering only its own subscribers (about 4 times a second). */
export function useAudioTime(): AudioTime {
  return useSyncExternalStore(subscribeTime, getTimeSnapshot, () => ZERO_TIME);
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function AudioProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AudioControlState>({
    currentTrack: null,
    playlist: [],
    isPlaying: false,
    volume: 0.8,
    loop: false,
  });

  // Side effects read the latest playlist from refs, never from inside setState updaters
  // (StrictMode double-invokes updaters, which used to double-play the next track)
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const load = useCallback((track: PlayableTrack, playlist: PlayableTrack[]) => {
    const engine = getEngine();
    if (!engine) return;
    engine.el.src = track.audio_path ?? "";
    engine.el.play().catch(() => setState((s) => ({ ...s, isPlaying: !getEngine()!.el.paused })));
    setState((s) => ({ ...s, currentTrack: track, playlist, isPlaying: true }));
  }, []);

  useEffect(() => {
    const engine = getEngine();
    if (!engine) return;

    const unsubscribeEnded = subscribeEngine(["ended"], () => {
      const { playlist, currentTrack, loop } = stateRef.current;
      const el = getEngine()!.el;
      if (loop) {
        el.play().catch(() => {});
        return;
      }
      const idx = playlist.findIndex((t) => t.id === currentTrack?.id);
      const nextTrack = playlist[idx + 1];
      if (nextTrack) load(nextTrack, playlist);
      else setState((s) => ({ ...s, isPlaying: false }));
    });
    // Reconcile from whichever element is current: play() calls are optimistic, and a CORS
    // fallback can swap the element or have its play() blocked outside the gesture
    const unsubscribePlayState = subscribeEngine(["play", "pause", "playblocked", "error"], () => {
      const playing = !getEngine()!.el.paused;
      setState((s) => (s.isPlaying === playing ? s : { ...s, isPlaying: playing }));
    });

    return () => {
      unsubscribeEnded();
      unsubscribePlayState();
    };
  }, [load]);

  const play = useCallback(
    (track: PlayableTrack, playlist?: PlayableTrack[]) => {
      ensureGraph(); // inside the click gesture, before any await
      load(track, playlist ?? stateRef.current.playlist);
    },
    [load]
  );

  const pause = useCallback(() => {
    getEngine()?.el.pause();
    setState((s) => ({ ...s, isPlaying: false }));
  }, []);

  const resume = useCallback(() => {
    ensureGraph();
    getEngine()?.el.play().catch(() => setState((s) => ({ ...s, isPlaying: !getEngine()!.el.paused })));
    setState((s) => ({ ...s, isPlaying: true }));
  }, []);

  const seek = useCallback((seconds: number) => {
    const el = getEngine()?.el;
    if (el && Number.isFinite(seconds)) el.currentTime = seconds;
  }, []);

  const next = useCallback(() => {
    const { playlist, currentTrack } = stateRef.current;
    const idx = playlist.findIndex((t) => t.id === currentTrack?.id);
    const nextTrack = playlist[idx + 1];
    if (!nextTrack) return;
    ensureGraph();
    load(nextTrack, playlist);
  }, [load]);

  const prev = useCallback(() => {
    const el = getEngine()?.el;
    if (!el) return;
    // Past three seconds, restart the current track; otherwise step back
    if (el.currentTime > 3) {
      el.currentTime = 0;
      return;
    }
    const { playlist, currentTrack } = stateRef.current;
    const idx = playlist.findIndex((t) => t.id === currentTrack?.id);
    const prevTrack = playlist[idx - 1];
    if (!prevTrack) {
      el.currentTime = 0;
      return;
    }
    ensureGraph();
    load(prevTrack, playlist);
  }, [load]);

  const setVolume = useCallback((v: number) => {
    setEngineVolume(v);
    setState((s) => ({ ...s, volume: v }));
  }, []);

  const toggleLoop = useCallback(() => {
    const loop = !stateRef.current.loop;
    const el = getEngine()?.el;
    if (el) el.loop = loop;
    setState((s) => ({ ...s, loop }));
  }, []);

  const value = useMemo<AudioControlValue>(
    () => ({ ...state, play, pause, resume, seek, next, prev, setVolume, toggleLoop }),
    [state, play, pause, resume, seek, next, prev, setVolume, toggleLoop]
  );

  return <AudioControlContext.Provider value={value}>{children}</AudioControlContext.Provider>;
}

/** Track, playlist, play state and actions. Position lives in useAudioTime(). */
export function useAudio(): AudioControlValue {
  const ctx = useContext(AudioControlContext);
  if (!ctx) throw new Error("useAudio must be used within AudioProvider");
  return ctx;
}

/** Build a playlist from a MusicProject's tracks */
export function buildPlaylist(project: MusicProject): PlayableTrack[] {
  return (project.tracks ?? []).map((t) => ({
    ...t,
    artworkPath: project.artwork_path,
    projectTitle: project.title,
  }));
}
