"use client";

import { useActionState, useState } from "react";
import {
  updateRoomVisibility,
  regenerateBitoSecret,
  triggerRedeploy,
} from "@/app/actions/settings";
import type { SiteSettings, SettingsActionState } from "@/app/actions/settings";
import { QuickEditCurrently } from "@/components/admin/QuickEditCurrently";
import type { Currently } from "@/lib/data/currently";

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({
  name,
  defaultChecked,
  label,
}: {
  name: string;
  defaultChecked: boolean;
  label: string;
}) {
  const [on, setOn] = useState(defaultChecked);
  return (
    <label className="flex items-center justify-between py-3 cursor-pointer group">
      <span className="text-sm text-(--color-base-dark)">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-xs text-(--color-text-muted)">{on ? "● visible" : "○ hidden"}</span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          onClick={() => setOn(!on)}
          className={[
            "relative w-10 h-5 rounded-full transition-colors",
            on ? "bg-accent" : "bg-black/15",
          ].join(" ")}
        >
          <span
            className={[
              "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform",
              on ? "translate-x-5" : "translate-x-0.5",
            ].join(" ")}
          />
        </button>
        <input type="hidden" name={name} value={on ? "true" : "false"} />
      </div>
    </label>
  );
}

// ─── Settings page client ─────────────────────────────────────────────────────

type SettingsClientProps = {
  settings: SiteSettings;
  current: Currently | null;
};

export function SettingsClient({ settings, current }: SettingsClientProps) {
  const [visibilityState, visibilityAction, visibilityPending] = useActionState<
    SettingsActionState,
    FormData
  >(updateRoomVisibility, { success: false });

  const [secretRevealed, setSecretRevealed] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);

  const [showDeploy, setShowDeploy] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<string | null>(null);

  async function handleRegenerate() {
    setRegenerating(true);
    setRegenerateError(null);
    const result = await regenerateBitoSecret();
    setRegenerating(false);
    if (result.success && result.secret) {
      setNewSecret(result.secret);
    } else {
      setRegenerateError(result.error ?? "Failed");
    }
  }

  async function handleDeploy() {
    setDeploying(true);
    const result = await triggerRedeploy();
    setDeploying(false);
    setShowDeploy(false);
    setDeployResult(result.success ? "Redeploy triggered." : result.error ?? "Failed");
  }

  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/notebook/ingest`
    : "https://hayzaydee.me/api/notebook/ingest";

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-xl font-sans text-(--lobby-text)">Settings</h1>

      {/* Currently */}
      <div className="bg-white border border-black/10 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-medium text-(--color-base-dark)">Currently indicator</h2>
        <QuickEditCurrently current={current} />
      </div>

      {/* Room visibility */}
      <div className="bg-white border border-black/10 rounded-xl p-6">
        <h2 className="text-sm font-medium text-(--color-base-dark) mb-2">Room visibility</h2>
        <form action={visibilityAction}>
          <div className="divide-y divide-black/5">
            <Toggle name="room_workshop_visible" defaultChecked={settings.room_workshop_visible} label="Workshop" />
            <Toggle name="room_studio_visible" defaultChecked={settings.room_studio_visible} label="Studio" />
            <Toggle name="room_notebook_visible" defaultChecked={settings.room_notebook_visible} label="Notebook" />
            <Toggle name="room_wall_visible" defaultChecked={settings.room_wall_visible} label="Wall" />
          </div>
          <button
            type="submit"
            disabled={visibilityPending}
            className="mt-4 text-sm px-4 py-2 border border-black/20 rounded-lg text-(--color-base-dark) hover:border-black/40 transition-colors disabled:opacity-50"
          >
            {visibilityPending ? "Saving…" : "Save visibility"}
          </button>
          {visibilityState.success && (
            <span className="ml-3 text-xs text-accent">Saved</span>
          )}
          {visibilityState.error && (
            <span className="ml-3 text-xs text-[#8B1F35]">{visibilityState.error}</span>
          )}
        </form>
      </div>

      {/* Bito integration */}
      <div className="bg-white border border-black/10 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-medium text-(--color-base-dark)">Bito integration</h2>

        <div>
          <label className="block text-xs text-(--color-text-muted) mb-1">Webhook endpoint</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-black/4 rounded px-3 py-2 text-(--color-base-dark) font-mono truncate">
              {webhookUrl}
            </code>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(webhookUrl)}
              className="text-xs text-(--color-text-muted) hover:text-(--color-base-dark) px-2 py-2 border border-black/10 rounded transition-colors"
            >
              Copy
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs text-(--color-text-muted) mb-1">Webhook secret</label>
          {newSecret ? (
            <div className="space-y-2">
              <code className="block text-xs bg-accent/8 border border-accent/20 rounded px-3 py-2 text-(--color-base-dark) font-mono break-all">
                {newSecret}
              </code>
              <p className="text-[10px] text-(--color-text-muted)">
                Copy this now — it won&apos;t be shown again.
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-black/4 rounded px-3 py-2 text-(--color-text-muted) font-mono">
                {secretRevealed && settings.bito_webhook_secret
                  ? settings.bito_webhook_secret
                  : settings.bito_webhook_secret
                  ? "••••••••••••••••••••••••••••••••"
                  : "Not set"}
              </code>
              {settings.bito_webhook_secret && (
                <button
                  type="button"
                  onClick={() => setSecretRevealed(!secretRevealed)}
                  className="text-xs text-(--color-text-muted) hover:text-(--color-base-dark) px-2 py-2 border border-black/10 rounded transition-colors"
                >
                  {secretRevealed ? "Hide" : "Reveal"}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs text-(--color-text-muted)">
            Update bito.works with the new secret before regenerating, or the integration will break.
          </p>
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={regenerating}
            className="text-sm px-4 py-2 border border-black/20 rounded-lg text-(--color-base-dark) hover:border-black/40 transition-colors disabled:opacity-50"
          >
            {regenerating ? "Generating…" : "Regenerate secret"}
          </button>
          {regenerateError && <p className="text-xs text-[#8B1F35]">{regenerateError}</p>}
        </div>

        {settings.last_bito_webhook_at && (
          <p className="text-xs text-(--color-text-muted)">
            Last received:{" "}
            {new Date(settings.last_bito_webhook_at).toLocaleString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
      </div>

      {/* Deploy */}
      <div className="bg-white border border-black/10 rounded-xl p-6 space-y-3">
        <h2 className="text-sm font-medium text-(--color-base-dark)">Deploy</h2>
        <button
          type="button"
          onClick={() => setShowDeploy(true)}
          disabled={deploying}
          className="text-sm px-4 py-2 border border-black/20 rounded-lg text-(--color-base-dark) hover:border-black/40 transition-colors"
        >
          Trigger redeploy
        </button>
        {deployResult && (
          <p className="text-xs text-(--color-text-muted)">{deployResult}</p>
        )}
      </div>

      {/* Deploy confirmation dialog */}
      {showDeploy && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-sm font-medium text-(--color-base-dark)">Trigger redeploy</h3>
            <p className="text-xs text-(--color-text-muted)">
              This will trigger a full rebuild and deploy. Continue?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeploy(false)}
                className="flex-1 text-sm px-4 py-2 border border-black/20 rounded-lg text-(--color-base-dark)"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeploy}
                disabled={deploying}
                className="flex-1 text-sm px-4 py-2 border border-accent text-accent rounded-lg hover:bg-accent/5 disabled:opacity-50"
              >
                {deploying ? "Deploying…" : "Deploy"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

