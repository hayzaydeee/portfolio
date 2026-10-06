"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { FxConfigProvider } from "@/components/fx/FxConfig";
import type { FxPresets } from "@/lib/fx/presets";

// Root client providers. Motion honours prefers-reduced-motion for every transform/layout animation.
export function Providers({ presets, children }: { presets: FxPresets; children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <FxConfigProvider presets={presets}>{children}</FxConfigProvider>
    </MotionConfig>
  );
}
