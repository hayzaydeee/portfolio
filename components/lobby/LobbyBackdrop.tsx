"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { FxStage, type FxHandle, type StageStatus } from "@/components/fx/FxStage";

/**
 * The lobby's one persistent backdrop: EmeraldHorizon, mounted once at the LobbyPage root so
 * it lives through the splash, the sequence and the resting page. Those phases drive it
 * through this context instead of mounting their own canvases.
 */

type LobbyBackdropValue = {
  /** Send a command to the horizon: "rise", "tint" or "slide" (queued until it's live) */
  command: (name: string, arg?: unknown) => void;
  /** The first frame is in (or the stage settled on its poster): the splash may finish counting */
  ready: boolean;
};

const LobbyBackdropContext = createContext<LobbyBackdropValue>({ command: () => {}, ready: true });

export function useLobbyBackdrop() {
  return useContext(LobbyBackdropContext);
}

type Props = {
  /** 0 keeps the horizon below the frame (under the splash) until a "rise" command; 1 starts at rest */
  initialRise: 0 | 1;
  /** Mirrored onto the host for tests: which lobby phase is showing */
  phase: string;
  children: ReactNode;
};

export function LobbyBackdropProvider({ initialRise, phase, children }: Props) {
  const handle = useRef<FxHandle>(null);
  const [ready, setReady] = useState(false);
  // The commanded rise target, mirrored for tests (the shader eases toward it)
  const [rise, setRise] = useState<number>(initialRise);
  const [options] = useState(() => ({ rise: initialRise }));
  // Under the opaque splash the horizon draws its first frame, then holds until it rises
  const [covered, setCovered] = useState(initialRise === 0);

  const command = useCallback((name: string, arg?: unknown) => {
    if (name === "rise") {
      setRise((arg as { to?: number } | undefined)?.to ?? 1);
      setCovered(false);
    }
    handle.current?.command(name, arg);
  }, []);

  const onStatusChange = useCallback((status: StageStatus | "disabled") => {
    // Poster, error and disabled are all final answers: nothing more is coming, so stop waiting
    if (status !== "poster") setReady(true);
  }, []);

  const value = useMemo(() => ({ command, ready }), [command, ready]);

  return (
    <LobbyBackdropContext.Provider value={value}>
      <div
        className="pointer-events-none fixed inset-0 z-(--z-backdrop)"
        aria-hidden="true"
        data-lobby-backdrop=""
        data-lobby-phase={phase}
        data-rise={rise}
      >
        <FxStage
          slot="lobby.backdrop"
          options={options}
          handle={handle}
          paused={covered}
          className="absolute inset-0"
          onStatusChange={onStatusChange}
        />
      </div>
      {children}
    </LobbyBackdropContext.Provider>
  );
}
