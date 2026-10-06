"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FxStage, type FxHandle } from "@/components/fx/FxStage";
import { FX_METAS } from "@/components/fx/metas";
import { ROOM_POSTER_CLASS } from "@/components/fx/posters";
import { ROOM_KEYS } from "@/components/fx/runtime/palette";
import type { FxControl, FxOptions, FxOptionValue, RoomKey } from "@/components/fx/runtime/types";
import { saveFxPreset, saveTransitionStyle } from "@/app/actions/fx";
import { TRANSITION_STYLES, type FxGlobals, type FxPresets, type SlotPreset, type TransitionStyle } from "@/lib/fx/presets";
import { FX_SLOTS, FX_SLOT_IDS, type FxSlotId } from "@/lib/fx/slots";
import { cn } from "@/lib/utils";

function ControlRow({
  control,
  value,
  onChange,
}: {
  control: FxControl;
  value: FxOptionValue;
  onChange: (v: FxOptionValue) => void;
}) {
  if (control.kind === "range") {
    return (
      <label className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
        <span className="text-xs text-base-dark">{control.label}</span>
        <span className="font-mono text-[11px] text-text-muted tabular-nums">
          {Number(value).toFixed(control.step < 1 ? 2 : 0)}
        </span>
        <input
          type="range"
          min={control.min}
          max={control.max}
          step={control.step}
          value={Number(value)}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="col-span-2 w-full accent-accent"
        />
      </label>
    );
  }
  if (control.kind === "toggle") {
    return (
      <label className="flex items-center justify-between gap-3">
        <span className="text-xs text-base-dark">{control.label}</span>
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
          className="size-4 accent-accent"
        />
      </label>
    );
  }
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-xs text-base-dark">{control.label}</span>
      <select
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-black/10 px-2 py-1 text-xs"
      >
        {control.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Site-wide room transition: which effect PortalHost plays between rooms */
function TransitionPicker({ saved }: { saved: FxGlobals }) {
  const router = useRouter();
  const [style, setStyle] = useState<TransitionStyle>(saved.transition);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, startSaving] = useTransition();

  const save = () =>
    startSaving(async () => {
      const result = await saveTransitionStyle(style);
      setMessage(result.success ? { ok: true, text: "saved" } : { ok: false, text: result.error ?? "failed" });
      if (result.success) router.refresh();
    });

  return (
    <div className="space-y-2 rounded-xl bg-white p-4">
      <p className="text-sm text-base-dark">room transition</p>
      <p className="text-[11px] leading-snug text-text-muted">
        tune the two effects in their slots below, then pick the one that plays between rooms.
      </p>
      <select
        value={style}
        onChange={(e) => setStyle(e.target.value as TransitionStyle)}
        className="w-full rounded-md border border-black/10 px-2 py-1.5 text-xs text-base-dark"
        aria-label="room transition"
      >
        {TRANSITION_STYLES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={save}
        disabled={saving || style === saved.transition}
        className="rounded-md bg-accent px-3 py-1.5 text-sm text-white disabled:opacity-40"
      >
        {saving ? "saving…" : "save"}
      </button>
      {message && (
        <p className={cn("text-xs", message.ok ? "text-accent" : "text-red-600")} role="status">
          {message.text}
        </p>
      )}
    </div>
  );
}

export function LabClient({ saved, savedGlobals }: { saved: FxPresets; savedGlobals: FxGlobals }) {
  const router = useRouter();
  const [slot, setSlot] = useState<FxSlotId>(FX_SLOT_IDS[0]);
  const def = FX_SLOTS[slot];
  const meta = FX_METAS[def.effect];

  const [drafts, setDrafts] = useState<Partial<Record<FxSlotId, SlotPreset>>>({});
  const draft = drafts[slot] ?? saved[slot];
  const [previewRoom, setPreviewRoom] = useState<RoomKey | null>(null);
  const room = previewRoom ?? def.room;
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, startSaving] = useTransition();
  const handle = useRef<FxHandle>(null);

  const values = useMemo(
    () => ({ ...meta.defaults, ...draft.values }) as FxOptions,
    [meta, draft.values]
  );
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved[slot]);

  const setDraft = (next: SlotPreset) => setDrafts((d) => ({ ...d, [slot]: next }));
  const setValue = (key: string, v: FxOptionValue) =>
    setDraft({ ...draft, values: { ...draft.values, [key]: v } });

  const save = () =>
    startSaving(async () => {
      const result = await saveFxPreset(slot, draft);
      setMessage(result.success ? { ok: true, text: "saved" } : { ok: false, text: result.error ?? "failed" });
      if (result.success) {
        setDrafts((d) => ({ ...d, [slot]: undefined }));
        router.refresh();
      }
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-sans text-(--lobby-text)">lab</h1>
        <p className="mt-1 text-sm text-text-muted">
          tune each effect slot live, then save. a disabled slot shows its poster and loads no effect code.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr_300px]">
        {/* Slots */}
        <div className="space-y-4">
          <TransitionPicker saved={savedGlobals} />
          <nav className="flex flex-col gap-1" aria-label="effect slots">
            {FX_SLOT_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setSlot(id);
                  setPreviewRoom(null);
                  setMessage(null);
                }}
                className={cn(
                  "rounded-md px-3 py-2 text-left text-sm transition-colors",
                  id === slot ? "bg-white text-base-dark shadow-sm" : "text-text-muted hover:bg-white/60 hover:text-base-dark"
                )}
              >
                <span className="block">{FX_SLOTS[id].label}</span>
                <span className="block font-mono text-[10px] opacity-70">
                  {id} · {saved[id].enabled ? "on" : "off"}
                </span>
              </button>
            ))}
          </nav>
        </div>

        {/* Preview */}
        <section className="space-y-3">
          <div className="relative h-105 overflow-hidden rounded-xl border border-black/10">
            {draft.enabled ? (
              <FxStage
                key={`${def.effect}-${room}`}
                effect={def.effect}
                room={room}
                options={values}
                priority={0}
                handle={handle}
                className="absolute inset-0"
                posterClassName={ROOM_POSTER_CLASS[room]}
              />
            ) : (
              <div className={cn("absolute inset-0 grid place-items-center", ROOM_POSTER_CLASS[room])}>
                <span className="font-mono text-xs text-text-muted">disabled: poster only</span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs text-text-muted">palette</span>
            {ROOM_KEYS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setPreviewRoom(r === def.room ? null : r)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors",
                  r === room ? "border-accent bg-accent text-white" : "border-white/15 text-text-muted hover:text-(--lobby-text)"
                )}
              >
                {r}
                {r === def.room && " ·"}
              </button>
            ))}
          </div>
          {meta.demoCommands && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs text-text-muted">try</span>
              {meta.demoCommands.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => handle.current?.command(c.name, c.arg)}
                  className="rounded-md border border-white/15 px-2.5 py-1 font-mono text-[11px] text-(--lobby-text) hover:border-white/30"
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}
          <div className="rounded-xl bg-white/5 p-4 text-xs leading-relaxed text-text-muted">
            <p className="text-(--lobby-text)">{meta.label}</p>
            <p className="mt-1">{meta.description}</p>
            <p className="mt-2 font-mono text-[10px]">
              ported from {meta.source.name} ({meta.source.license}) · {meta.kind} · priority {meta.priority} · ≤
              {meta.pixelBudget}MP
            </p>
          </div>
        </section>

        {/* Controls */}
        <aside className="space-y-4 rounded-xl bg-white p-5">
          <label className="flex items-center justify-between">
            <span className="text-sm text-base-dark">enabled</span>
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
              className="size-4 accent-accent"
            />
          </label>
          <hr className="border-black/10" />
          {meta.controls.map((control) => (
            <ControlRow
              key={control.key}
              control={control}
              value={values[control.key]}
              onChange={(v) => setValue(control.key, v)}
            />
          ))}
          <hr className="border-black/10" />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving || !dirty}
              className="rounded-md bg-accent px-3 py-1.5 text-sm text-white disabled:opacity-40"
            >
              {saving ? "saving…" : "save"}
            </button>
            <button
              type="button"
              onClick={() => setDrafts((d) => ({ ...d, [slot]: undefined }))}
              disabled={!dirty}
              className="rounded-md border border-black/10 px-3 py-1.5 text-sm text-base-dark disabled:opacity-40"
            >
              revert
            </button>
            <button
              type="button"
              onClick={() => setDraft({ enabled: draft.enabled, values: {} })}
              className="rounded-md border border-black/10 px-3 py-1.5 text-sm text-base-dark"
            >
              defaults
            </button>
          </div>
          {message && (
            <p className={cn("text-xs", message.ok ? "text-accent" : "text-red-600")} role="status">
              {message.text}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
