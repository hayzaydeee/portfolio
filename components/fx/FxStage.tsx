"use client";

import {
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type Ref,
} from "react";
import { cn } from "@/lib/utils";
import { readFrame } from "@/lib/audio/frame";
import { FX_SLOTS, type FxSlotId } from "@/lib/fx/slots";
import { FX_METAS, type FxId } from "./metas";
import { FX_LOADERS } from "./registry";
import { useSlotPreset } from "./FxConfig";
import { acquireLease, installDebugHandle, noteCreationAttempt, onLeaseFreed, type Lease } from "./runtime/budget";
import { loseContext } from "./runtime/gl";
import { usePrefersReducedMotion } from "./runtime/motion";
import { getRoomPalette } from "./runtime/palette";
import { onStageClick, readPointer } from "./runtime/pointer";
import { observeSize } from "./runtime/resize";
import { addToTicker, getRenderScale, onRenderScaleChange } from "./runtime/ticker";
import type { FxContext, FxInstance, FxModule, FxOptions, FxPriority, RoomKey } from "./runtime/types";

export type FxHandle = {
  /** Send a command (e.g. "rise", "tint", "strike"); queued until the effect is live */
  command: (name: string, arg?: unknown) => void;
};

type StageStatus = "poster" | "live" | "error";

type FxStageProps = {
  /** A tuned slot (preferred): effect, room and lab presets come from it */
  slot?: FxSlotId;
  /** Or an effect + room directly (lab, harness) */
  effect?: FxId;
  room?: RoomKey;
  options?: Partial<FxOptions>;
  priority?: FxPriority;
  /** Shown until the first frame and whenever the effect is disabled or evicted */
  poster?: string;
  /** Token class for the gradient poster when there's no image, e.g. "bg-(--studio-base)" */
  posterClassName?: string;
  className?: string;
  /** Observe a different element for visibility (e.g. a fixed backdrop's section) */
  observeRef?: React.RefObject<HTMLElement | null>;
  handle?: Ref<FxHandle>;
  label?: string;
};

const DEFAULT_ROOM: RoomKey = "lobby";

function pixelRatioFor(width: number, height: number, budgetMP: number) {
  const device = Math.min(window.devicePixelRatio || 1, 2) * getRenderScale();
  const budget = Math.sqrt((budgetMP * 1e6) / Math.max(1, width * height));
  return Math.max(0.35, Math.min(device, budget));
}

export function FxStage({
  slot,
  effect: effectProp,
  room: roomProp,
  options,
  priority: priorityProp,
  poster,
  posterClassName = "bg-(--lobby-surface)",
  className,
  observeRef,
  handle,
  label,
}: FxStageProps) {
  const effect: FxId = slot ? FX_SLOTS[slot].effect : (effectProp ?? "emerald-horizon");
  const room: RoomKey = slot ? FX_SLOTS[slot].room : (roomProp ?? DEFAULT_ROOM);
  const meta = FX_METAS[effect];
  const preset = useSlotPreset(slot);
  const enabled = preset?.enabled ?? true;
  const priority = priorityProp ?? meta.priority;
  const reducedMotion = usePrefersReducedMotion();

  const resolved = useMemo(
    () => ({ ...meta.defaults, ...(preset?.values ?? {}), ...(options ?? {}) }) as FxOptions,
    [meta, preset, options]
  );
  const resolvedKey = JSON.stringify(resolved);

  const id = useId();
  const hostRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<FxInstance | null>(null);
  const optionsRef = useRef(resolved);
  const pendingRef = useRef(new Map<string, unknown>());

  const [mod, setMod] = useState<{ effect: FxId; module: FxModule } | null>(null);
  const [status, setStatus] = useState<StageStatus>("poster");
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    optionsRef.current = resolved;
  }, [resolved]);

  useImperativeHandle(
    handle,
    () => ({
      command: (name, arg) => {
        const inst = instanceRef.current;
        if (inst?.command) inst.command(name, arg);
        else pendingRef.current.set(name, arg);
      },
    }),
    []
  );

  // Load the renderer module on demand
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    installDebugHandle();
    FX_LOADERS[effect]()
      .then((module) => {
        if (!cancelled) setMod({ effect, module });
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [effect, enabled]);

  // Create the instance: canvas made imperatively inside rAF, so StrictMode's synchronous
  // unmount cancels the first attempt instead of leaking a context
  useEffect(() => {
    const host = hostRef.current;
    const layer = layerRef.current;
    if (!enabled || !host || !layer || !mod || mod.effect !== effect) return;

    const isGL = meta.kind !== "2d";
    let canvas: HTMLCanvasElement | null = null;
    let instance: FxInstance | null = null;
    let lease: Lease | null = null;
    let visible = true;
    let observed = false;
    let disposing = false;
    // Set only when this stage is sitting on its poster for lack of a slot (denied, evicted,
    // context lost). Retries happen only from this state, never while creation is pending.
    let waiting = false;
    let stopWaiting: (() => void) | null = null;
    const cleanups: (() => void)[] = [];

    const retry = () => {
      if (!waiting || disposing || !visible) return;
      waiting = false;
      setGeneration((g) => g + 1);
    };

    const wait = () => {
      waiting = true;
      setStatus("poster");
      stopWaiting ??= onLeaseFreed(retry);
    };

    const teardown = () => {
      disposing = true;
      stopWaiting?.();
      stopWaiting = null;
      cleanups.splice(0).reverse().forEach((fn) => fn());
      instanceRef.current = null;
      try {
        instance?.dispose();
      } catch {
        // a lost context can throw on delete calls; the context is going away regardless
      }
      instance = null;
      if (canvas && isGL) {
        loseContext(canvas.getContext(meta.kind as "webgl") as WebGLRenderingContext | null);
      }
      canvas?.remove();
      canvas = null;
      lease?.release();
      lease = null;
    };

    const target = observeRef?.current ?? host;
    const io = new IntersectionObserver(
      ([entry]) => {
        // The first observation reports initial state; it never counts as "came back"
        const wasVisible = observed ? visible : true;
        observed = true;
        visible = entry?.isIntersecting ?? true;
        lease?.setVisible(visible);
        // A waiting stage retries when it comes back on screen (a slot may have freed meanwhile)
        if (visible && !wasVisible) retry();
      },
      { rootMargin: "25% 0px" }
    );
    io.observe(target);

    const raf = requestAnimationFrame(() => {
      noteCreationAttempt();
      if (isGL) {
        lease = acquireLease({
          id,
          priority,
          isVisible: () => visible,
          evict: () => {
            teardown();
            disposing = false;
            wait();
          },
        });
        if (!lease) {
          wait();
          return;
        }
      }

      canvas = document.createElement("canvas");
      canvas.className = "absolute inset-0 size-full";
      canvas.setAttribute("aria-hidden", "true");
      layer.appendChild(canvas);

      if (isGL) {
        // No preventDefault: a lost context is never restored in place. Recovery always builds a
        // fresh canvas through the waiter path (teardown releases the lease, which retries us).
        const lostCanvas = canvas;
        const onLost = () => {
          if (disposing) return;
          teardown();
          disposing = false;
          wait();
        };
        lostCanvas.addEventListener("webglcontextlost", onLost);
        cleanups.push(() => lostCanvas.removeEventListener("webglcontextlost", onLost));
      }

      const ctx: FxContext = {
        canvas,
        layer,
        palette: getRoomPalette(room),
        reducedMotion,
        audio: meta.audio ? readFrame : null,
        pointer: () => {
          const p = readPointer();
          const r = host.getBoundingClientRect();
          const x = p.clientX - r.left;
          const y = p.clientY - r.top;
          return { x, y, seen: p.seen, inside: x >= 0 && y >= 0 && x <= r.width && y <= r.height };
        },
      };

      try {
        instance = mod.module.create(ctx, optionsRef.current);
      } catch {
        teardown();
        disposing = false;
        setStatus("error");
        return;
      }
      instanceRef.current = instance;
      const created = instance;

      let size = { w: 0, h: 0 };
      const resize = () => {
        if (!size.w || !size.h) return;
        created.resize(size.w, size.h, pixelRatioFor(size.w, size.h, meta.pixelBudget));
      };
      cleanups.push(
        observeSize(host, (w, h) => {
          size = { w, h };
          resize();
        })
      );
      cleanups.push(onRenderScaleChange(resize));
      const r = host.getBoundingClientRect();
      size = { w: r.width, h: r.height };
      resize();

      pendingRef.current.forEach((arg, name) => created.command?.(name, arg));
      pendingRef.current.clear();

      if (meta.wantsClicks) {
        cleanups.push(
          onStageClick((e) => {
            const rect = host.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            if (x >= 0 && y >= 0 && x <= rect.width && y <= rect.height) created.command?.("click", { x, y });
          })
        );
      }

      // The layer (not the canvas) fades in, so every canvas a renderer appends is covered and
      // a renderer's own canvas opacity multiplies with the fade instead of overriding it
      const reveal = () => {
        if (instanceRef.current !== created) return;
        setStatus("live");
      };

      if (reducedMotion) {
        created.still?.();
        created.render(performance.now(), 0);
        void (created.ready ?? Promise.resolve()).then(reveal);
      } else {
        cleanups.push(addToTicker(id, created.render, () => visible));
        void (created.ready ?? Promise.resolve()).then(() => requestAnimationFrame(reveal));
      }
    });

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      teardown();
    };
    // optionsRef carries live options; observeRef is read once at creation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mod, effect, room, enabled, reducedMotion, priority, generation, id, meta]);

  // Live option updates without recreating the instance
  useEffect(() => {
    instanceRef.current?.update(JSON.parse(resolvedKey) as FxOptions);
  }, [resolvedKey]);

  return (
    <div
      ref={hostRef}
      className={cn("relative overflow-hidden", className)}
      data-fx={effect}
      data-fx-room={room}
      data-fx-state={enabled ? status : "disabled"}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-700",
          posterClassName,
          status === "live" && "opacity-0"
        )}
      >
        {poster && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt="" className="size-full object-cover" />
        )}
      </div>
      <div
        ref={layerRef}
        className={cn(
          "absolute inset-0 transition-opacity duration-700",
          status === "live" ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  );
}
