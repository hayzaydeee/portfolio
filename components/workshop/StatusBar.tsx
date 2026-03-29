interface StatusBarProps {
  activeSlug: string | null;
}

const SLUG_PATH: Record<string, string> = {
  readme: "hayzaydee/README.md",
  stack: "hayzaydee/stack.json",
  "life-log": "hayzaydee/.debug/life.log",
  vrrbose: "hayzaydee/projects/vrrbose/",
  "bito-works": "hayzaydee/projects/bito.works/",
  gaff3r: "hayzaydee/projects/gaff3r/",
  "predictions-league": "hayzaydee/projects/predictionsLeague/",
};

export function StatusBar({ activeSlug }: StatusBarProps) {
  const path = activeSlug ? SLUG_PATH[activeSlug] ?? activeSlug : "";

  return (
    <div
      className="flex items-center justify-between px-4 py-1 text-[10px] font-mono shrink-0"
      style={{
        background: "var(--workshop-accent)",
        color: "rgba(212,232,216,0.7)",
      }}
    >
      <span>{path}</span>
      <span style={{ color: "rgba(212,232,216,0.5)" }}>hayzaydee.me</span>
    </div>
  );
}
