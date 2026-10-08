"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * The player bar lives in the root layout, above every page, so it can't read a context the
 * studio provides. The studio claims it instead while it is mounted, and the bar dresses its
 * play key in liquid metal for as long as a claim stands.
 */

let claims = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Mount in the studio: the player wears its studio key while this is mounted */
export function useClaimStudioPlayer() {
  useEffect(() => {
    claims += 1;
    emit();
    return () => {
      claims -= 1;
      emit();
    };
  }, []);
}

export function useStudioPlayer(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => claims > 0,
    () => false
  );
}
