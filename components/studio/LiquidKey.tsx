"use client";

import { useRef, type ReactNode } from "react";
import { FxStage, type FxHandle } from "@/components/fx/FxStage";

/** The bloom's room around the key, in CSS px: matches the stage's -inset-8 */
const BLOOM_PX = 32;
const KEY_PX = 44;

/**
 * The player's play key in liquid metal, on the studio's routes. A real button sits on a
 * dark plate; the metal is drawn behind it on a larger stage, so its bloom can spill into the
 * bar. The button tells the effect what the pointer, keyboard and focus are doing: hover
 * and keyboard focus light the metal, a press throws a ripple from where it landed.
 */
export function LiquidKey({ label, icon, onClick }: { label: string; icon: ReactNode; onClick: () => void }) {
  const fx = useRef<FxHandle>(null);

  const pressAt = (e: React.PointerEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    fx.current?.command("press", {
      x: (e.clientX - (r.left + r.width / 2)) / r.height,
      y: (e.clientY - (r.top + r.height / 2)) / r.height,
    });
  };

  return (
    <div className="liquid-key relative size-11 shrink-0" data-liquid-key="">
      <span className="liquid-key__plate" aria-hidden="true" />
      <FxStage
        effect="liquid-metal"
        room="studio"
        handle={fx}
        options={{ pad: BLOOM_PX / KEY_PX }}
        className="pointer-events-none absolute -inset-8"
        posterClassName="bg-transparent"
      />
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className="liquid-key__button"
        onPointerEnter={(e) => e.pointerType === "mouse" && fx.current?.command("hover", true)}
        onPointerLeave={(e) => e.pointerType === "mouse" && fx.current?.command("hover", false)}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          pressAt(e);
        }}
        onPointerUp={() => fx.current?.command("release")}
        onPointerCancel={() => fx.current?.command("release")}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !e.repeat) fx.current?.command("press", { x: 0, y: 0 });
        }}
        onKeyUp={(e) => {
          if (e.key === "Enter" || e.key === " ") fx.current?.command("release");
        }}
        onFocus={(e) => fx.current?.command("focus", e.currentTarget.matches(":focus-visible"))}
        onBlur={() => fx.current?.command("focus", false)}
      >
        {icon}
      </button>
    </div>
  );
}
