/**
 * Where the horizon sits behind each lobby section. Sent as the backdrop's "slide" command by
 * the sequence (per slide) and by the resting page (per section in view). Text-heavy sections
 * lower the glow out of the reading line; the showpieces lift it behind them.
 */
export const LOBBY_SECTIONS = ["hero", "about", "seedling", "techstack", "projects", "cta", "tour"] as const;

export type LobbySection = (typeof LOBBY_SECTIONS)[number];

export type HorizonPose = { lift: number; glow: number; wave: number };

export const POSES: Record<LobbySection, HorizonPose> = {
  hero: { lift: 0, glow: 1, wave: 1 },
  about: { lift: -0.2, glow: 0.7, wave: 0.7 },
  seedling: { lift: -0.32, glow: 0.55, wave: 0.55 },
  techstack: { lift: 0.1, glow: 1.1, wave: 1.25 },
  projects: { lift: 0.14, glow: 1.1, wave: 1.45 },
  cta: { lift: 0.04, glow: 0.9, wave: 0.85 },
  tour: { lift: 0.18, glow: 1.4, wave: 1.1 },
};
