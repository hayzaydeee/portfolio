"use client";

import { FxStage } from "@/components/fx/FxStage";
import { cn } from "@/lib/utils";

type Mode = "tracks" | "analysis";

type Props = {
  mode: Mode;
  onChange: (mode: Mode) => void;
};

/**
 * The studio's view switch: one real role="switch" (on = analysis) drawn by the shader toggle,
 * with each view's name either side. The captions are pointer conveniences that set their own
 * view; the switch is the control assistive tech and the keyboard use.
 */
export function ModeToggle({ mode, onChange }: Props) {
  const analysis = mode === "analysis";
  return (
    <div className="flex items-center gap-3 font-mono text-xs tracking-widest uppercase" data-studio-mode={mode}>
      <span
        aria-hidden="true"
        className={cn("studio-mode__label", analysis ? "text-(--studio-text-muted)" : "text-(--studio-text)")}
        onClick={() => onChange("tracks")}
      >
        tracks
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={analysis}
        aria-label="analysis view"
        className="studio-switch"
        onClick={() => onChange(analysis ? "tracks" : "analysis")}
      >
        <FxStage
          effect="shader-toggle"
          room="studio"
          options={{ on: analysis }}
          className="absolute inset-0 overflow-hidden rounded-full"
          posterClassName={cn("studio-switch-poster", analysis && "is-on")}
        />
      </button>
      <span
        aria-hidden="true"
        className={cn("studio-mode__label", analysis ? "text-(--studio-text)" : "text-(--studio-text-muted)")}
        onClick={() => onChange("analysis")}
      >
        analysis
      </span>
    </div>
  );
}
