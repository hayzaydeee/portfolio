"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

// Root client providers. Motion honours prefers-reduced-motion for every transform/layout animation.
export function Providers({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
