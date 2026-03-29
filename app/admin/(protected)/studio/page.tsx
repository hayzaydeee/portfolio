export default function StudioPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-sans text-(--lobby-text)">Studio</h1>
          <p className="text-sm text-(--color-text-muted) mt-0.5">Music projects and analysis</p>
        </div>
        <button className="text-sm px-4 py-2 border border-(--lobby-text)/20 rounded-lg text-(--lobby-text) hover:bg-white/5 transition-colors">
          New project
        </button>
      </div>

      {/* Tabs placeholder */}
      <div className="flex gap-1 border-b border-white/10">
        <button className="px-4 py-2 text-sm font-sans border-b-2 border-(--lobby-text) text-(--lobby-text) -mb-px">
          Tracks
        </button>
        <button className="px-4 py-2 text-sm font-sans border-b-2 border-transparent text-(--color-text-muted) -mb-px hover:text-(--lobby-text) transition-colors">
          Analysis
        </button>
      </div>

      <div className="bg-white border border-black/10 rounded-xl px-6 py-12 text-center">
        <p className="text-sm text-(--color-text-muted)">no music projects yet</p>
        <p className="text-xs text-(--color-text-muted) mt-1">
          Music management coming in the next phase.
        </p>
      </div>
    </div>
  );
}
