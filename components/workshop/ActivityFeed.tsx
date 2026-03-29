const COMMITS = [
  { repo: "vrrbose", message: "add windowsHide flag to daemon spawn", age: "2d ago" },
  { repo: "bito.works", message: "compass AI plan-builder endpoint", age: "5d ago" },
];

interface ActivityFeedProps {
  currently?: { verb: string; content: string } | null;
}

export function ActivityFeed({ currently }: ActivityFeedProps) {
  return (
    <div
      className="flex-1 overflow-y-auto p-6 font-mono text-xs"
      style={{ color: "var(--workshop-text-muted)" }}
    >
      {/* Header */}
      <div className="mb-6" style={{ color: "var(--workshop-syntax-dim)" }}>
        // hayzaydee — live
      </div>

      <div className="flex flex-col gap-3">
        {COMMITS.map((c) => (
          <div key={`${c.repo}-${c.message}`} className="flex items-start gap-4">
            <span className="w-20 shrink-0" style={{ color: "var(--workshop-syntax-dim)" }}>
              last commit
            </span>
            <span className="w-32 shrink-0" style={{ color: "var(--workshop-text)" }}>
              {c.repo}
            </span>
            <span className="flex-1" style={{ color: "var(--workshop-text-muted)" }}>
              &quot;{c.message}&quot;
            </span>
            <span className="shrink-0">{c.age}</span>
          </div>
        ))}

        {currently && (
          <div className="flex items-start gap-4">
            <span className="w-20 shrink-0" style={{ color: "var(--workshop-syntax-dim)" }}>
              {currently.verb}
            </span>
            <span className="flex-1" style={{ color: "var(--workshop-text)" }}>
              {currently.content}
            </span>
          </div>
        )}
      </div>

      {/* Status hint */}
      <div className="mt-10 text-[10px]" style={{ color: "var(--workshop-syntax-dim)" }}>
        select a file from the tree to begin
      </div>
    </div>
  );
}
