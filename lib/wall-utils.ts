/**
 * Pure client-safe utilities for wall scatter and image URLs.
 * No server imports — safe to use in Client Components.
 */

export type ScatterProps = {
  rotation: number;
  offsetX: number;
  offsetY: number;
};

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function idToSeed(id: string): number {
  return id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
}

export function getScatterProps(id: string): ScatterProps {
  const seed = idToSeed(id);
  return {
    rotation: seededRandom(seed) * 12 - 6,
    offsetX: seededRandom(seed + 1) * 40,
    offsetY: seededRandom(seed + 2) * 60,
  };
}

export function getImageUrl(path: string | null): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/${path}`;
}
