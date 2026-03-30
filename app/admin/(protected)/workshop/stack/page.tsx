import { getSettings } from "@/app/actions/settings";
import { getHighlightedStackJson } from "@/app/actions/settings";
import { StackEditor } from "@/components/admin/workshop/StackEditor";
import type { StackJson } from "@/app/actions/settings";

const DEFAULT_STACK: StackJson = {
  languages: [],
  frontend: [],
  backend: [],
  tools: [],
};

export default async function StackPage() {
  const settings = await getSettings();
  const stack = (settings?.stack_json as StackJson | null) ?? DEFAULT_STACK;
  const initialPreviewHtml = await getHighlightedStackJson(stack);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-sans text-(--lobby-text)">Stack</h1>
        <p className="text-sm text-text-muted mt-0.5">
          Edit your technology stack — displayed in the workshop file tree.
        </p>
      </div>
      <StackEditor initialStack={stack} initialPreviewHtml={initialPreviewHtml} />
    </div>
  );
}
