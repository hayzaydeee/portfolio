import type { RoomKey } from "@/components/fx/runtime/types";

/** What PortalHost sends both transition effects: the phase and when it started */
export type PortalPhaseCommand = {
  name: "cover" | "hold" | "reveal";
  /** performance.now() at phase start; render(now) times are on the same clock */
  at: number;
  ms: number;
  from: RoomKey | null;
  to: RoomKey | null;
};

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t: number) => t * t * t;

export function phaseProgress(cmd: PortalPhaseCommand | null, now: number): number {
  if (!cmd || cmd.ms <= 0) return 1;
  return Math.min(1, Math.max(0, (now - cmd.at) / cmd.ms));
}

export function isPortalPhase(arg: unknown): arg is PortalPhaseCommand {
  if (!arg || typeof arg !== "object") return false;
  const name = (arg as { name?: unknown }).name;
  return name === "cover" || name === "hold" || name === "reveal";
}
