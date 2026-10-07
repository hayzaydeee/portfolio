"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { FxStage, type FxHandle, type StageStatus } from "@/components/fx/FxStage";

/**
 * The lobby's one persistent backdrop: EmeraldHorizon, mounted once at the LobbyPage root so
 * it lives through the splash, the sequence and the resting page. Those phases drive it
 * through this context instead of mounting their own canvases.
 */

type LobbyBackdropValue = {
  /** Drive the horizon: "rise" (kept as state, so it survives recreation), "tint" or "slide" */
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
  // Rise travels as an option, not a one-off command, so an instance recreated after a context
  // loss or eviction starts where the horizon was
  const options = useMemo(() => ({ rise }), [rise]);
  // Under the opaque splash the horizon draws its first frame, then holds until it rises
  const [covered, setCovered] = useState(initialRise === 0);
  // Tint and pose mirrored for tests, like rise
  const [tint, setTint] = useState<string>("home");
  const [lift, setLift] = useState(0);

  // Tint and pose are one-off commands, so a recreated instance (context loss, eviction) would
  // drop them; the last of each is replayed whenever the stage comes back live
  const sticky = useRef(new Map<string, unknown>());

  const command = useCallback((name: string, arg?: unknown) => {
    if (name === "tint" || name === "slide") sticky.current.set(name, arg);
    if (name === "rise") {
      setRise((arg as { to?: number } | undefined)?.to ?? 1);
      setCovered(false);
      return;
    }
    if (name === "tint") setTint((arg as string | null) ?? "home");
    if (name === "slide") setLift((arg as { lift?: number } | undefined)?.lift ?? 0);
    handle.current?.command(name, arg);
  }, []);

  const onStatusChange = useCallback((status: StageStatus | "disabled") => {
    // Poster, error and disabled are all final answers: nothing more is coming, so stop waiting
    if (status !== "poster") setReady(true);
    if (status === "live") sticky.current.forEach((arg, name) => handle.current?.command(name, arg));
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
        data-tint={tint}
        data-lift={lift}
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
