"use client";

import { useEffect, type RefObject } from "react";

/**
 * Proximity magnification from ThreeUI's AnimatedTopDock controller (MIT, Meng To): items
 * near the pointer grow on a damped spring and drop toward the page; keyboard focus lifts
 * the focused item and nudges its neighbours.
 *
 * Changes from the original: the spring runs only while something is moving instead of an
 * endless rAF loop, steps at a fixed 60 Hz so feel doesn't depend on refresh rate, reads its
 * axis from the nav's flex direction (the glass rail flips at md), and "grow" mode spreads
 * extra flex-grow instead of rewriting widths for fitted strips (retro).
 */

export type MagnifyMode = "size" | "grow";

const CONFIG = {
  proximity: 122,
  spring: 0.19,
  damping: 0.7,
  widthGrowth: 17,
  heightGrowth: 16,
  drop: 3.5,
  growBoost: 0.55,
};

const STEP_MS = 1000 / 60;

type Item = { el: HTMLElement; baseW: number; baseH: number; value: number; velocity: number; target: number };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

type Options = {
  mode: MagnifyMode;
  /** Pin the nav's width so a centred bar doesn't slide under the pointer as items grow */
  lockTrack?: boolean;
  /** Re-measure whenever the items change */
  resetKey: string;
};

export function useDockMagnify(navRef: RefObject<HTMLElement | null>, { mode, lockTrack = false, resetKey }: Options) {
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    let items: Item[] = [];
    let enabled = false;
    let vertical = false;
    let raf = 0;
    let last = 0;
    let carry = 0;

    const clearStyles = (el: HTMLElement) => {
      el.style.width = "";
      el.style.height = "";
      el.style.transform = "";
      el.style.flexGrow = "";
      el.dataset.dockNear = "false";
    };

    const measure = () => {
      nav.style.width = "";
      items = Array.from(nav.querySelectorAll<HTMLElement>("[data-dock-item]")).map((el) => {
        clearStyles(el);
        const r = el.getBoundingClientRect();
        return { el, baseW: r.width, baseH: r.height, value: 0, velocity: 0, target: 0 };
      });
      vertical = getComputedStyle(nav).flexDirection.startsWith("column");
      enabled = !reduced.matches && finePointer.matches && window.innerWidth > 600 && nav.clientWidth > 0;
      if (enabled && lockTrack && !vertical) nav.style.width = `${nav.getBoundingClientRect().width.toFixed(2)}px`;
      nav.dataset.dockState = enabled ? "idle" : "static";
    };

    const apply = () => {
      for (const item of items) {
        const v = clamp(item.value, 0, 1.08);
        const { el } = item;
        if (mode === "grow") {
          el.style.flexGrow = (1 + v * CONFIG.growBoost).toFixed(3);
          continue;
        }
        if (vertical) {
          el.style.height = `${(item.baseH + CONFIG.heightGrowth * v).toFixed(2)}px`;
          el.style.transform = `translateX(${(v * CONFIG.drop).toFixed(2)}px)`;
          continue;
        }
        const isMark = el.dataset.dockMark === "true";
        const grow = isMark ? CONFIG.widthGrowth * (14 / 17) : Math.min(CONFIG.widthGrowth, item.baseW * 0.24);
        const lift = isMark ? CONFIG.heightGrowth * (14 / 16) : CONFIG.heightGrowth;
        el.style.width = `${(item.baseW + grow * v).toFixed(2)}px`;
        el.style.height = `${(item.baseH + lift * v).toFixed(2)}px`;
        el.style.transform = `translateY(${(v * CONFIG.drop).toFixed(2)}px)`;
      }
    };

    const step = () => {
      let moving = false;
      for (const item of items) {
        item.velocity += (item.target - item.value) * CONFIG.spring;
        item.velocity *= CONFIG.damping;
        item.value += item.velocity;
        if (Math.abs(item.target - item.value) < 1e-3 && Math.abs(item.velocity) < 1e-3) {
          item.value = item.target;
          item.velocity = 0;
        } else moving = true;
      }
      return moving;
    };

    const frame = (now: number) => {
      carry += Math.min(100, now - (last || now));
      last = now;
      let moving = true;
      while (carry >= STEP_MS) {
        moving = step();
        carry -= STEP_MS;
      }
      apply();
      if (moving) raf = requestAnimationFrame(frame);
      else {
        raf = 0;
        last = 0;
        carry = 0;
        if (items.every((i) => i.target === 0)) nav.dataset.dockState = "idle";
      }
    };

    const kick = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };

    const setTargets = (fn: (item: Item, index: number) => number, state: string) => {
      items.forEach((item, i) => {
        item.target = fn(item, i);
        item.el.dataset.dockNear = item.target > 0.08 ? "true" : "false";
      });
      nav.dataset.dockState = state;
      kick();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!enabled) return;
      const at = vertical ? e.clientY : e.clientX;
      setTargets((item) => {
        const r = item.el.getBoundingClientRect();
        const centre = vertical ? r.top + r.height / 2 : r.left + r.width / 2;
        const x = clamp(1 - Math.abs(at - centre) / CONFIG.proximity, 0, 1);
        return x * x * (3 - 2 * x);
      }, "active");
    };

    const release = () => {
      if (!enabled) return;
      setTargets(() => 0, "settling");
    };

    const onFocusIn = (e: FocusEvent) => {
      if (!enabled) return;
      const target = (e.target as Element | null)?.closest<HTMLElement>("[data-dock-item]");
      const index = items.findIndex((i) => i.el === target);
      if (index < 0) return;
      setTargets((_, i) => (i === index ? 1 : Math.abs(i - index) === 1 ? 0.24 : 0), "focus");
    };

    const onFocusOut = () =>
      requestAnimationFrame(() => {
        if (!nav.contains(document.activeElement)) release();
      });

    const reset = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      measure();
    };

    let disposed = false;
    void document.fonts?.ready.then(() => {
      if (!disposed) reset();
    });
    // Window resizes only: observing the bar itself would feed its own growth back into a reset
    window.addEventListener("resize", reset);

    nav.addEventListener("pointermove", onPointerMove);
    nav.addEventListener("pointerleave", release);
    nav.addEventListener("focusin", onFocusIn);
    nav.addEventListener("focusout", onFocusOut);
    nav.addEventListener("click", release);
    reduced.addEventListener("change", reset);
    finePointer.addEventListener("change", reset);
    reset();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", reset);
      nav.style.width = "";
      nav.removeEventListener("pointermove", onPointerMove);
      nav.removeEventListener("pointerleave", release);
      nav.removeEventListener("focusin", onFocusIn);
      nav.removeEventListener("focusout", onFocusOut);
      nav.removeEventListener("click", release);
      reduced.removeEventListener("change", reset);
      finePointer.removeEventListener("change", reset);
      items.forEach((i) => clearStyles(i.el));
    };
  }, [navRef, mode, lockTrack, resetKey]);
}
