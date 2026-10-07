"use client";

import { FxStage } from "@/components/fx/FxStage";
import type { FxOptions } from "@/components/fx/runtime/types";
import { isAccentToken, resolveVisual } from "@/lib/fx/projectVisuals";

type Props = {
  variant: string | null;
  accent: string | null;
  title: string;
  /** Lab and admin preview: render on a poster-friendly ornament budget */
  preview?: boolean;
  className?: string;
};

/**
 * A project's identity field: the visual chosen for it in the admin (falling back to the
 * constellation while a choice is still unported), drawn in its accent token. The warp field
 * flies the project's own letters.
 */
export function ProjectIdentity({ variant, accent, title, preview = false, className }: Props) {
  const effect = resolveVisual(variant);
  const options: Partial<FxOptions> = { accent: isAccentToken(accent) ? accent : "" };
  if (effect === "warp-field") options.text = title;

  return (
    <FxStage
      effect={effect}
      room="workshop"
      options={options}
      priority={preview ? 0 : undefined}
      className={className}
      posterClassName="bg-(--workshop-base)"
    />
  );
}
