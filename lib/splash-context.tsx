"use client";

import { createContext, useContext, useState, useCallback } from "react";

interface SplashContextValue {
  splashActive: boolean;
  setSplashActive: (active: boolean) => void;
}

const SplashContext = createContext<SplashContextValue>({
  splashActive: false,
  setSplashActive: () => {},
});

export function SplashProvider({ children }: { children: React.ReactNode }) {
  const [splashActive, setSplashActiveState] = useState(false);
  const setSplashActive = useCallback((active: boolean) => {
    setSplashActiveState(active);
  }, []);

  return (
    <SplashContext.Provider value={{ splashActive, setSplashActive }}>
      {children}
    </SplashContext.Provider>
  );
}

/** Returns whether the splash is currently active. */
export function useSplashActive(): boolean {
  return useContext(SplashContext).splashActive;
}

/** Set the splash active state. Called by LobbyPage. */
export function useSetSplashActive(): (active: boolean) => void {
  return useContext(SplashContext).setSplashActive;
}
