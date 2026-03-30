export function TourNudge() {
  return (
    <section className="bg-(--lobby-surface) py-16 px-6 text-center">
      <p className="text-sm font-sans text-text-muted mb-4">
        want to see the whole place?
      </p>
      {/* Tour trigger — wired up in Phase 6 */}
      <button
        type="button"
        aria-label="start guided tour"
        className="inline-flex items-center gap-2 text-sm font-sans text-(--lobby-accent) hover:text-accent-light transition-colors cursor-pointer"
     >
        <span>take the tour</span>
        <span aria-hidden="true" className="text-base">→</span>
      </button>
    </section>
  );
}
