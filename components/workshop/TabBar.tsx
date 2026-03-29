"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_TABS = 5;
const STORAGE_KEY = "hzy-workshop-tabs";

interface TabBarProps {
  activeSlug: string | null;
  onSelect: (slug: string) => void;
  onClose: (slug: string) => void;
  openTabs: string[];
}

function slugToLabel(slug: string): string {
  const MAP: Record<string, string> = {
    readme: "README.md",
    stack: "stack.json",
    "life-log": "life.log",
    vrrbose: "vrrbose/",
    "bito-works": "bito.works/",
    gaff3r: "gaff3r/",
    "predictions-league": "predictionsLeague/",
  };
  return MAP[slug] ?? slug;
}

export function TabBar({ activeSlug, onSelect, onClose, openTabs }: TabBarProps) {
  return (
    <div
      className="flex items-stretch overflow-x-auto scrollbar-none border-b"
      style={{
        background: "var(--workshop-tab)",
        borderColor: "var(--workshop-tree-border)",
        minHeight: "36px",
      }}
    >
      {openTabs.map((slug) => {
        const isActive = slug === activeSlug;
        return (
          <div
            key={slug}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-xs font-mono border-r cursor-pointer shrink-0 group transition-colors",
              isActive
                ? "text-(--workshop-text) border-b-2 border-b-(--workshop-syntax)"
                : "text-(--workshop-text-muted) hover:text-(--workshop-text) hover:bg-(--workshop-panel)"
            )}
            style={{ borderRightColor: "var(--workshop-tree-border)" }}
            onClick={() => onSelect(slug)}
          >
            {/* Modified dot (aesthetic) */}
            <span className="w-1.5 h-1.5 rounded-full bg-(--workshop-syntax) opacity-0 group-hover:opacity-60 transition-opacity" />
            <span>{slugToLabel(slug)}</span>
            <button
              type="button"
              aria-label={`close ${slugToLabel(slug)}`}
              onClick={(e) => { e.stopPropagation(); onClose(slug); }}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-(--workshop-text-muted) hover:text-(--workshop-text) cursor-pointer"
            >
              <X size={11} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// Hook: persist open tabs to localStorage
export function useTabState(initialSlug?: string) {
  // Always start with deterministic SSR-safe value; hydrate from localStorage after mount
  const [openTabs, setOpenTabs] = useState<string[]>(
    initialSlug ? [initialSlug] : []
  );
  const [activeSlug, setActiveSlug] = useState<string | null>(
    initialSlug ?? null
  );

  // Restore persisted tabs after first client render (avoids SSR/client mismatch)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const tabs = JSON.parse(stored) as string[];
        if (tabs.length > 0) {
          setOpenTabs(tabs);
          setActiveSlug((prev) =>
            prev && tabs.includes(prev) ? prev : tabs[tabs.length - 1]
          );
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(openTabs));
  }, [openTabs]);

  function openTab(slug: string) {
    setActiveSlug(slug);
    setOpenTabs((prev) => {
      if (prev.includes(slug)) return prev;
      const next = [...prev, slug];
      // Drop oldest if over limit
      return next.length > MAX_TABS ? next.slice(next.length - MAX_TABS) : next;
    });
  }

  function closeTab(slug: string) {
    setOpenTabs((prev) => {
      const next = prev.filter((s) => s !== slug);
      if (activeSlug === slug) {
        setActiveSlug(next[next.length - 1] ?? null);
      }
      return next;
    });
  }

  return { openTabs, activeSlug, openTab, closeTab, setActiveSlug };
}
