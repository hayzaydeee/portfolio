"use client";

import { useEffect, useRef, type ElementType, type RefObject } from "react";
import { cn } from "@/lib/utils";

/**
 * Text that decodes into place, ported from ThreeUI's article heading decode (MIT, Meng To):
 * a reveal front eases across the text, a short window ahead of it scrambles, and the tail
 * flickers now and then.
 *
 * Three layers share one grid cell: an sr-only copy (what assistive tech reads), a hidden
 * copy that reserves the final box so nothing shifts, and an aria-hidden layer the loop
 * writes into directly. Server render, no JS and reduced motion all show the final text.
 */

export const DECODE_POOL = "#%&@$/\\<>*+=~ABCDEFGHKMNPRSTUVWXYZ0123456789";
export const DECODE_MONO_POOL = "01<>/\\{}[]=+*#$_:;.";

export type DecodeOptions = {
  duration?: number;
  delay?: number;
  /** Characters scrambled ahead of the reveal front */
  scramble?: number;
  /** Chance a scrambled slot shows its real character anyway */
  preserve?: number;
  /** Chance a not-yet-reached character flickers */
  tail?: number;
  pool?: string;
};

const DEFAULTS = { duration: 560, delay: 0, scramble: 10, preserve: 0.3, tail: 0.18, pool: DECODE_POOL };

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const pick = (pool: string) => pool[(Math.random() * pool.length) | 0];

/** Writes through the text node React rendered, so React keeps ownership of it */
function write(el: HTMLElement, value: string) {
  const node = el.firstChild;
  if (node instanceof Text && node === el.lastChild) node.nodeValue = value;
  else el.textContent = value;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Runs one decode into `el`, ending on `text`; returns a cancel that restores the final text */
export function runDecode(el: HTMLElement, text: string, options: DecodeOptions = {}): () => void {
  // An option passed as undefined (e.g. pool={cond ? x : undefined}) keeps its default
  const given = Object.fromEntries(Object.entries(options).filter(([, v]) => v !== undefined));
  const o = { ...DEFAULTS, ...given };
  if (prefersReducedMotion() || !text) {
    write(el, text);
    return () => {};
  }

  let raf = 0;
  const start = performance.now() + o.delay;
  const frame = (now: number) => {
    if (now < start) {
      raf = requestAnimationFrame(frame);
      return;
    }
    const t = Math.min(1, (now - start) / Math.max(1, o.duration));
    const revealed = Math.floor(easeOut(t) * text.length);
    let out = text.slice(0, revealed);
    const span = Math.min(text.length - revealed, Math.round(o.scramble));
    for (let i = 0; i < span; i++) {
      const ch = text[revealed + i];
      out += ch === " " || Math.random() < o.preserve ? ch : pick(o.pool);
    }
    out += text
      .slice(revealed + span)
      .replace(/\S/g, (ch) => (Math.random() < o.tail ? pick(o.pool) : ch));
    write(el, out);
    if (t < 1) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    write(el, text);
  };
}

type Trigger = "mount" | "visible";

function useTrigger(ref: RefObject<HTMLElement | null>, trigger: Trigger, run: () => () => void, key: string) {
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancel: (() => void) | null = null;
    if (trigger === "mount") {
      cancel = runRef.current();
      return () => cancel?.();
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        io.disconnect();
        cancel = runRef.current();
      },
      // Half in view rather than a margin, so text at the very end of a page still qualifies
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancel?.();
    };
  }, [ref, trigger, key]);
}

type DecodeProps = DecodeOptions & {
  text: string;
  as?: ElementType;
  /** "visible" waits until the text scrolls into view (once) */
  trigger?: Trigger;
  className?: string;
  id?: string;
};

export function Decode({ text, as: Tag = "span", trigger = "mount", className, id, ...options }: DecodeProps) {
  const liveRef = useRef<HTMLSpanElement>(null);
  useTrigger(
    liveRef,
    trigger,
    () => (liveRef.current ? runDecode(liveRef.current, text, options) : () => {}),
    text
  );

  return (
    <Tag className={cn("decode", className)} id={id} data-decode-text={text}>
      <span className="sr-only">{text}</span>
      <span className="decode__ghost" aria-hidden="true">
        {text}
      </span>
      <span ref={liveRef} className="decode__live" aria-hidden="true" data-decode-live="">
        {text}
      </span>
    </Tag>
  );
}

/**
 * Decodes every [data-decode] element inside `ref` in document order, `stagger` ms apart,
 * the way the source runs a page of headings. Each element's text is what it decodes to.
 */
export function useDecodeGroup(
  ref: RefObject<HTMLElement | null>,
  { stagger = 140, trigger = "mount", ...options }: DecodeOptions & { stagger?: number; trigger?: Trigger } = {}
) {
  useTrigger(
    ref,
    trigger,
    () => {
      const els = Array.from(ref.current?.querySelectorAll<HTMLElement>("[data-decode]") ?? []);
      const cancels = els.map((el, i) =>
        runDecode(el, el.dataset.decode ?? el.textContent ?? "", { ...options, delay: (options.delay ?? 0) + i * stagger })
      );
      return () => cancels.forEach((c) => c());
    },
    String(stagger)
  );
}
