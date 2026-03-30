"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import type { Track, MusicProject } from "@/app/actions/studio";

export type PlayableTrack = Track & {
  artworkPath?: string | null;
  projectTitle?: string;
};

type AudioState = {
  currentTrack: PlayableTrack | null;
  playlist: PlayableTrack[];
  isPlaying: boolean;
  volume: number;
  loop: boolean;
  progress: number;
  duration: number;
  currentTime: number;
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

type AudioContextValue = AudioState & AudioActions;

const AudioContext = createContext<AudioContextValue | null>(null);

export function AudioProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<AudioState>({
    currentTrack: null,
    playlist: [],
    isPlaying: false,
    volume: 0.8,
    loop: false,
    progress: 0,
    duration: 0,
    currentTime: 0,
  });

  // Create audio element once
  useEffect(() => {
    const audio = new Audio();
    audio.volume = 0.8;
    audioRef.current = audio;

    const onTimeUpdate = () => {
      const dur = audio.duration || 0;
      setState((s) => ({
        ...s,
        currentTime: audio.currentTime,
        progress: dur > 0 ? audio.currentTime / dur : 0,
        duration: dur,
      }));
    };

    const onLoadedMetadata = () => {
      setState((s) => ({ ...s, duration: audio.duration || 0 }));
    };

    const onEnded = () => {
      setState((s) => {
        if (s.loop) {
          audio.play().catch(() => {});
          return { ...s, isPlaying: true };
        }
        const idx = s.playlist.findIndex((t) => t.id === s.currentTrack?.id);
        const next = s.playlist[idx + 1];
        if (next) {
          audio.src = next.audio_path ?? "";
          audio.play().catch(() => {});
          return { ...s, currentTrack: next, isPlaying: true, progress: 0, currentTime: 0 };
        }
        return { ...s, isPlaying: false, progress: 0, currentTime: 0 };
      });
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
      audio.pause();
      audio.src = "";
    };
  }, []);

  const play = useCallback((track: PlayableTrack, playlist?: PlayableTrack[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = track.audio_path ?? "";
    audio.play().catch(() => {});
    setState((s) => ({
      ...s,
      currentTrack: track,
      playlist: playlist ?? s.playlist,
      isPlaying: true,
      progress: 0,
      currentTime: 0,
    }));
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setState((s) => ({ ...s, isPlaying: false }));
  }, []);

  const resume = useCallback(() => {
    audioRef.current?.play().catch(() => {});
    setState((s) => ({ ...s, isPlaying: true }));
  }, []);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seconds;
  }, []);

  const next = useCallback(() => {
    setState((s) => {
      const idx = s.playlist.findIndex((t) => t.id === s.currentTrack?.id);
      const nextTrack = s.playlist[idx + 1];
      if (!nextTrack) return s;
      const audio = audioRef.current;
      if (audio) {
        audio.src = nextTrack.audio_path ?? "";
        audio.play().catch(() => {});
      }
      return { ...s, currentTrack: nextTrack, isPlaying: true, progress: 0, currentTime: 0 };
    });
  }, []);

  const prev = useCallback(() => {
    setState((s) => {
      const audio = audioRef.current;
      // If past 3 seconds, restart; otherwise go to previous
      if (audio && audio.currentTime > 3) {
        audio.currentTime = 0;
        return s;
      }
      const idx = s.playlist.findIndex((t) => t.id === s.currentTrack?.id);
      const prevTrack = s.playlist[idx - 1];
      if (!prevTrack) {
        if (audio) audio.currentTime = 0;
        return s;
      }
      if (audio) {
        audio.src = prevTrack.audio_path ?? "";
        audio.play().catch(() => {});
      }
      return { ...s, currentTrack: prevTrack, isPlaying: true, progress: 0, currentTime: 0 };
    });
  }, []);

  const setVolume = useCallback((v: number) => {
    const audio = audioRef.current;
    if (audio) audio.volume = v;
    setState((s) => ({ ...s, volume: v }));
  }, []);

  const toggleLoop = useCallback(() => {
    setState((s) => {
      if (audioRef.current) audioRef.current.loop = !s.loop;
      return { ...s, loop: !s.loop };
    });
  }, []);

  return (
    <AudioContext.Provider
      value={{ ...state, play, pause, resume, seek, next, prev, setVolume, toggleLoop }}
    >
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio(): AudioContextValue {
  const ctx = useContext(AudioContext);
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
