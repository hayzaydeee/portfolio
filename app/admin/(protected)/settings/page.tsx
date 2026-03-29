import { getSettings } from "@/app/actions/settings";
import { getCurrently } from "@/lib/data/currently";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  const [settings, current] = await Promise.all([getSettings(), getCurrently()]);

  if (!settings) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-sans text-(--lobby-text)">Settings</h1>
        <p className="text-sm text-(--color-text-muted)">
          Settings not found. Run the database schema to initialize site_settings.
        </p>
      </div>
    );
  }

  return <SettingsClient settings={settings} current={current} />;
}
