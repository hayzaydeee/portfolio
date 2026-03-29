type StatusBadgeProps = {
  status:
    | "published"
    | "draft"
    | "staged"
    | "archived"
    | "scheduled"
    | "in_progress"
    | "in_the_lab";
};

const CONFIG: Record<
  StatusBadgeProps["status"],
  { label: string; bg: string; text: string }
> = {
  published:  { label: "Published",   bg: "bg-accent/10", text: "text-accent" },
  draft:      { label: "Draft",       bg: "bg-black/6",       text: "text-(--color-text-muted)" },
  staged:     { label: "Staged",      bg: "bg-[#B87A00]/10", text: "text-[#B87A00]" },
  archived:   { label: "Archived",    bg: "bg-black/5",       text: "text-[#6B6B67]" },
  scheduled:  { label: "Scheduled",   bg: "bg-[#1E4A6B]/10", text: "text-[#1E4A6B]" },
  in_progress:{ label: "In progress", bg: "bg-[#8B1F35]/10", text: "text-[#8B1F35]" },
  in_the_lab: { label: "In the lab",  bg: "bg-[#8B1F35]/10", text: "text-[#8B1F35]" },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const { label, bg, text } = CONFIG[status] ?? CONFIG.draft;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${bg} ${text}`}
    >
      {label}
    </span>
  );
}
