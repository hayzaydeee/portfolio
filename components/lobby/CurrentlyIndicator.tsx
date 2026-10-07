"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { FxHandle } from "@/components/fx/FxStage";
import { HzyOrb } from "@/components/fx/ui/HzyOrb";
import type { Currently } from "@/lib/data/currently";

interface CurrentlyIndicatorProps {
  data: Currently | null;
}

const LINK = "underline decoration-accent-muted underline-offset-2 transition-colors hover:text-(--lobby-text)";

export function CurrentlyIndicator({ data }: CurrentlyIndicatorProps) {
  const orb = useRef<FxHandle>(null);

  // A ring of light when the indicator first appears, and again whenever it's pointed at
  useEffect(() => {
    if (data) orb.current?.command("pulse");
  }, [data]);

  if (!data) return null;

  const content = data.link ? (
    <a href={data.link} target="_blank" rel="noopener noreferrer" className={LINK}>
      {data.content}
    </a>
  ) : data.type === "thought" ? (
    <Link href="/notebook" className={LINK}>
      {data.content}
    </Link>
  ) : (
    <span>{data.content}</span>
  );

  return (
    <div
      className="fixed bottom-6 left-6 z-(--z-indicator) max-w-60"
      data-currently=""
      onPointerEnter={() => orb.current?.command("pulse")}
    >
      <div className="flex items-start gap-2 font-sans text-xs text-text-muted">
        <HzyOrb size="sm" room="lobby" motion="sweep" handle={orb} className="-mt-0.5" />
        <span className="leading-relaxed">
          <span className="text-(--lobby-text)" data-currently-verb="">
            {data.verb}
          </span>
          {" · "}
          {content}
        </span>
      </div>
    </div>
  );
}
