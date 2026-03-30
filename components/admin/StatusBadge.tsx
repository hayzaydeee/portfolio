type StatusBadgeProps = {
  status:
    | "published"
    | "draft"
    | "staged"
    | "archived"
    | "scheduled"
    | "hidden"
    | "in_progress"
    | "in_the_lab";
};

const CONFIG: Record<
  StatusBadgeProps["status"],
  { label: string; bg: string; text: string }
> = {
  published:  { label: "Published",   bg: "bg-accent/10",          text: "text-accent" },
  draft:      { label: "Draft",        bg: "bg-black/6",            text: "text-text-muted" },
  staged:     { label: "Staged",       bg: "bg-(--admin-status-staged)/10",     text: "text-(--admin-status-staged)" },
  archived:   { label: "Archived",     bg: "bg-black/5",            text: "text-(--admin-status-archived)" },
  scheduled:  { label: "Scheduled",    bg: "bg-(--admin-status-scheduled)/10", text: "text-(--admin-status-scheduled)" },
  hidden:     { label: "Hidden",       bg: "bg-black/5",            text: "text-text-muted" },
  in_progress:{ label: "In progress",  bg: "bg-(--admin-accent-studio)/10", text: "text-(--admin-accent-studio)" },
  in_the_lab: { label: "In the lab",   bg: "bg-(--admin-accent-studio)/10", text: "text-(--admin-accent-studio)" },
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
