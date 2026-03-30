"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useInView } from "motion/react";
import { cn } from "@/lib/utils";
import {
  SiJavascript,
  SiTypescript,
  SiReact,
  SiNodedotjs,
  SiExpress,
  SiMongodb,
  SiPython,
  SiKotlin,
} from "@icons-pack/react-simple-icons";

const ICON_SIZE = 20;

// Words that map to icons
const WORDS: Array<{
  word: string;
  Icon?: React.ComponentType<{ size: number; className?: string }>;
  keep?: boolean; // non-icon words — fade to muted
}> = [
  { word: "I", keep: false },
  { word: "work", keep: false },
  { word: "primarily", keep: false },
  { word: "in", keep: false },
  { word: "JavaScript", Icon: SiJavascript },
  { word: "—" , keep: false },
  { word: "React,", Icon: SiReact },
  { word: "Node,", Icon: SiNodedotjs },
  { word: "Express,", Icon: SiExpress },
  { word: "MongoDB", Icon: SiMongodb },
  { word: "—", keep: false },
  { word: "with", keep: false },
  { word: "experience", keep: false },
  { word: "in", keep: false },
  { word: "Kotlin,", Icon: SiKotlin },
  { word: "C++,", keep: true }, // no icon, but keep
  { word: "TypeScript,", Icon: SiTypescript },
  { word: "and", keep: false },
  { word: "Python.", Icon: SiPython },
];

export function TechStack() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (isInView) {
      const t = setTimeout(() => setSettled(true), 1200);
      return () => clearTimeout(t);
    }
  }, [isInView]);

  return (
    <section ref={ref} className="bg-(--lobby-surface) py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
          {WORDS.map((item, i) => {
            const hasIcon = !!item.Icon;
            const fadeOut = !hasIcon && item.keep !== true;

            return (
              <motion.span
                key={`${item.word}-${i}`}
                initial={{ opacity: 0, y: 6 }}
                animate={isInView ? { opacity: fadeOut && settled ? 0.3 : 1, y: 0 } : {}}
                transition={{
                  delay: i * 0.04,
                  duration: 0.3,
                  ease: "easeOut",
                  opacity: { delay: i * 0.04 + (settled ? 0.1 : 0), duration: 0.4 },
                }}
                className="inline-flex items-center gap-1"
              >
                {hasIcon && settled && item.Icon ? (
                  <item.Icon size={ICON_SIZE} className="text-(--lobby-text)" />
                ) : (
                  <span
                    className={cn(
                      "text-base font-sans transition-colors duration-300",
                      fadeOut && settled
                        ? "text-text-muted"
                        : "text-(--lobby-text)"                   )}
                  >
                    {item.word}
                  </span>
                )}
              </motion.span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
