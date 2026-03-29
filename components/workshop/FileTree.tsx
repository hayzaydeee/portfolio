"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, FileText, Folder, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

type TreeNode = {
  name: string;
  type: "file" | "dir";
  slug?: string;
  children?: TreeNode[];
  isNew?: boolean;
  hidden?: boolean;
};

export type WorkshopProject = {
  name: string;
  slug: string;
  isNew?: boolean;
};

const STATIC_FILE_NODES: TreeNode[] = [
  { name: "experience", type: "dir", children: [] },
  { name: "education", type: "dir", children: [] },
  { name: "stack.json", type: "file", slug: "stack" },
  { name: "README.md", type: "file", slug: "readme" },
];

const DEBUG_NODES: TreeNode[] = [
  {
    name: ".debug",
    type: "dir",
    hidden: true,
    children: [{ name: "life.log", type: "file", slug: "life-log" }],
  },
];

interface FileTreeProps {
  activeSlug: string | null;
  onSelect: (slug: string) => void;
  projects: WorkshopProject[];
}

function TreeItem({
  node,
  depth,
  activeSlug,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  activeSlug: string | null;
  onSelect: (slug: string) => void;
}) {
  const [open, setOpen] = useState(depth === 0);
  const isDir = node.type === "dir";
  const isActive = node.slug === activeSlug;

  function handleClick() {
    if (isDir) {
      setOpen((v) => !v);
    } else if (node.slug) {
      onSelect(node.slug);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "w-full flex items-center gap-1.5 px-2 py-0.75 text-xs font-mono text-left cursor-pointer transition-colors rounded-[3px]",
          isActive
            ? "bg-(--workshop-accent)/20 text-(--workshop-text) border-l-2 border-(--workshop-syntax) pl-1.5"
            : "text-(--workshop-text-muted) hover:bg-(--workshop-panel) hover:text-(--workshop-text)"
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        aria-expanded={isDir ? open : undefined}
      >
        {/* Expand chevron for dirs */}
        {isDir ? (
          open ? (
            <ChevronDown size={12} className="shrink-0 text-(--workshop-text-muted)" />
          ) : (
            <ChevronRight size={12} className="shrink-0 text-(--workshop-text-muted)" />
          )
        ) : (
          <span className="w-3 shrink-0" />
        )}

        {/* Icon */}
        {isDir ? (
          open ? (
            <FolderOpen size={13} className="shrink-0 text-(--workshop-syntax-dim)" />
          ) : (
            <Folder size={13} className="shrink-0 text-(--workshop-syntax-dim)" />
          )
        ) : (
          <FileText size={13} className="shrink-0 text-(--workshop-text-muted)" />
        )}

        <span className="truncate">{node.name}</span>

        {/* New file indicator */}
        {node.isNew && (
          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-(--workshop-syntax) shrink-0" />
        )}
      </button>

      {isDir && open && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeItem
              key={child.name}
              node={child}
              depth={depth + 1}
              activeSlug={activeSlug}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileTree({ activeSlug, onSelect, projects }: FileTreeProps) {
  const [showHidden, setShowHidden] = useState(false);

  const rootTree: TreeNode[] = [
    {
      name: "hayzaydee",
      type: "dir",
      children: [
        {
          name: "projects",
          type: "dir",
          children: projects.map((p) => ({
            name: p.name,
            type: "dir" as const,
            slug: p.slug,
            isNew: p.isNew,
            children: [],
          })),
        },
        ...STATIC_FILE_NODES,
      ],
    },
  ];

  const allNodes = showHidden ? [...rootTree, ...DEBUG_NODES] : rootTree;

  return (
    <div
      className="flex flex-col h-full overflow-y-auto py-3 select-none"
      style={{ background: "var(--workshop-tree)" }}
    >
      <div className="flex-1">
        {allNodes.map((node) => (
          <TreeItem
            key={node.name}
            node={node}
            depth={0}
            activeSlug={activeSlug}
            onSelect={onSelect}
          />
        ))}
      </div>

      {/* Hidden files hint */}
      <div className="mt-4 px-3">
        <button
          type="button"
          onClick={() => setShowHidden((v) => !v)}
          className="text-[10px] font-mono text-(--workshop-syntax-dim) hover:text-(--workshop-text-muted) transition-colors cursor-pointer"
        >
          {showHidden ? "// hide hidden files" : "// try showing hidden files"}
        </button>
      </div>
    </div>
  );
}
