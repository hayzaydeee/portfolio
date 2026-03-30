"use client";

type Mode = "tracks" | "analysis";

type Props = {
  mode: Mode;
  onChange: (mode: Mode) => void;
};

export function ModeToggle({ mode, onChange }: Props) {
  return (
    <div
      className="inline-flex rounded-full p-0.5"
      style={{ background: "var(--studio-panel)", border: "1px solid var(--studio-border)" }}
    >
      {(["tracks", "analysis"] as Mode[]).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className="relative px-5 py-1.5 rounded-full text-sm font-medium transition-colors duration-200"
          style={
            mode === m
              ? { background: "var(--studio-accent)", color: "var(--studio-text)" }
              : { background: "transparent", color: "var(--studio-text-muted)" }
          }
        >
          {m}
        </button>
      ))}
    </div>
  );
}
