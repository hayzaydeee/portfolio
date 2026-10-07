"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { FxStage, type FxHandle } from "@/components/fx/FxStage";

const BOOT_KEY = "hzy:workshop-booted";
/** The log has had its moment: hold on the prompt this long, then power down */
const HOLD_MS = 650;
/** Never keep the workshop behind glass longer than this */
const SAFETY_MS = 7000;

function shouldBoot(): boolean {
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    return sessionStorage.getItem(BOOT_KEY) !== "1";
  } catch {
    return false;
  }
}

function markBooted() {
  try {
    sessionStorage.setItem(BOOT_KEY, "1");
  } catch {
    // storage blocked: it simply boots again next visit
  }
}

const noSubscribe = () => () => {};

/**
 * The boot greets the first entry into the room, whichever page that is: a visit that starts
 * on a project has already arrived, so /work never boots on it afterwards. Mounted in the
 * workshop layout.
 */
export function WorkshopEntry() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname !== "/work") markBooted();
  }, [pathname]);
  return null;
}

/**
 * The workshop's first-visit boot, once per session: a CRT types the boot log, holds on the
 * prompt, then powers off into a line and is gone, leaving the IDE. Any key or click skips it.
 * The server always renders without it; the client decides after hydration, so a returning
 * visitor never sees a flash of glass.
 */
export function useWorkshopBoot() {
  const wanted = useSyncExternalStore(noSubscribe, shouldBoot, () => false);
  const [finished, setFinished] = useState(false);
  return { booting: wanted && !finished, finish: () => setFinished(true) };
}

export function WorkshopBoot({ projects, onFinished }: { projects: number; onFinished: () => void }) {
  const crt = useRef<FxHandle>(null);
  const [phase, setPhase] = useState<"running" | "off">("running");
  const finishedRef = useRef(onFinished);
  useEffect(() => {
    finishedRef.current = onFinished;
  }, [onFinished]);

  useEffect(() => {
    let hold: ReturnType<typeof setTimeout> | undefined;
    const powerOff = () => setPhase("off");
    crt.current?.command("done", () => {
      hold = setTimeout(powerOff, HOLD_MS);
    });
    const safety = setTimeout(powerOff, SAFETY_MS);
    const skip = (e: Event) => {
      if (e instanceof KeyboardEvent && (e.key === "Tab" || e.metaKey || e.ctrlKey)) return;
      powerOff();
    };
    window.addEventListener("keydown", skip);
    window.addEventListener("pointerdown", skip);
    return () => {
      clearTimeout(hold);
      clearTimeout(safety);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, []);

  return (
    <div
      className="crt-boot absolute inset-0 z-20 bg-(--workshop-base)"
      data-workshop-boot={phase}
      aria-hidden="true"
      onAnimationEnd={(e) => {
        if (phase !== "off" || e.target !== e.currentTarget) return;
        markBooted();
        finishedRef.current();
      }}
    >
      <FxStage
        slot="workshop.boot"
        options={{ projects }}
        handle={crt}
        className="absolute inset-0"
        posterClassName="bg-(--workshop-base)"
        fade={false}
        // No glass to boot (no WebGL, switched off in the lab): straight to the IDE
        onStatusChange={(status) => {
          if (status === "error" || status === "disabled") setPhase("off");
        }}
      />
      <p className="absolute right-4 bottom-3 font-mono text-[10px] tracking-widest text-(--workshop-text-muted)">press any key to skip</p>
    </div>
  );
}
