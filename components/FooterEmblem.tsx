"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { FxStage } from "@/components/fx/FxStage";
import { HzyMark } from "@/components/nav/HzyMark";

/** The HZY outline written in a running line of type; the flat mark holds its place until then */
export function FooterEmblem({ className }: { className?: string }) {
  const [live, setLive] = useState(false);
  return (
    <div className={cn("relative shrink-0 cursor-crosshair", className)} data-footer-emblem="">
      <HzyMark
        mode="dark"
        className={cn("absolute inset-[10%] transition-opacity duration-500", live ? "opacity-0" : "opacity-30")}
      />
      <FxStage
        slot="site.emblem"
        className="absolute inset-0"
        posterClassName="bg-transparent"
        onStatusChange={(status) => setLive(status === "live")}
      />
    </div>
  );
}
