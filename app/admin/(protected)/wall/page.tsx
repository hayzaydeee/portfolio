export default function WallPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-sans text-(--lobby-text)">Wall</h1>
          <p className="text-sm text-(--color-text-muted) mt-0.5">Art, short video, and long video pieces</p>
        </div>
        <button className="text-sm px-4 py-2 border border-(--lobby-text)/20 rounded-lg text-(--lobby-text) hover:bg-white/5 transition-colors">
          New piece
        </button>
      </div>

      <div className="bg-white border border-black/10 rounded-xl px-6 py-12 text-center">
        <p className="text-sm text-(--color-text-muted)">no wall pieces yet</p>
        <p className="text-xs text-(--color-text-muted) mt-1">
          Wall management coming in the next phase.
        </p>
      </div>
    </div>
  );
}
