import { getSiteConfig } from "@/lib/data/settings";
import { resolvePresets } from "@/lib/fx/presets";
import { LabClient } from "./LabClient";

export default async function LabPage() {
  const config = await getSiteConfig();
  return <LabClient saved={resolvePresets(config.fxPresetsRaw)} />;
}
