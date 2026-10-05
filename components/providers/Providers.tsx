"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { FxConfigProvider } from "@/components/fx/FxConfig";
import type { FxGlobals, FxPresets } from "@/lib/fx/presets";
import { SplashProvider } from "@/lib/splash-context";

// Root client providers. Motion honours prefers-reduced-motion for every transform/layout animation.
export function Providers({
  presets,
  globals,
  children,
}: {
  presets: FxPresets;
  globals: FxGlobals;
  children: ReactNode;
}) {
  return (
    <MotionConfig reducedMotion="user">
      <FxConfigProvider presets={presets} globals={globals}>
        <SplashProvider>{children}</SplashProvider>
      </FxConfigProvider>
    </MotionConfig>
  );
}
