/** Skeleton grid for initial dashboard load. */
export function ReportLoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading reports">
      <div className="h-36 rounded-2xl bg-muted/60" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-muted/50" />
        ))}
      </div>
      <div className="h-12 max-w-xl rounded-lg bg-muted/50" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-72 rounded-xl bg-muted/40" />
        <div className="h-72 rounded-xl bg-muted/40" />
      </div>
    </div>
  )
}
