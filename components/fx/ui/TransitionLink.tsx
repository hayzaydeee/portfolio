"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { useFxGlobals } from "@/components/fx/FxConfig";
import { FX_LOADERS } from "@/components/fx/registry";
import { crossesRooms, portalGo } from "@/lib/fx/portalStore";
import type { TransitionStyle } from "@/lib/fx/presets";

type Props = Omit<ComponentProps<typeof Link>, "href"> & { href: string };

const EFFECT_FOR: Partial<Record<TransitionStyle, keyof typeof FX_LOADERS>> = {
  field: "portal-field",
  vortex: "glyph-vortex",
};

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * A Link that crosses rooms through the portal. Same-room links, modified clicks (Next skips
 * onNavigate for new tabs), reduced motion and the "none" style all navigate normally.
 */
export function TransitionLink({ href, onNavigate, onPointerEnter, onFocus, ...rest }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { transition } = useFxGlobals();

  const portals = () => transition !== "none" && crossesRooms(pathname, href) && !prefersReducedMotion();

  // Warm the transition's renderer chunk before the click so the cover starts on the first frame
  const preload = () => {
    const effect = EFFECT_FOR[transition];
    if (effect && portals()) void FX_LOADERS[effect]().catch(() => {});
  };

  return (
    <Link
      href={href}
      {...rest}
      onPointerEnter={(e) => {
        preload();
        onPointerEnter?.(e);
      }}
      onFocus={(e) => {
        preload();
        onFocus?.(e);
      }}
      onNavigate={(e) => {
        onNavigate?.(e);
        if (!portals()) return;
        e.preventDefault();
        portalGo(href, router);
      }}
    />
  );
}
