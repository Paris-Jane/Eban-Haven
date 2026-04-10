/** Shared admin page styling — matches public shadcn theme + reference sidebar shell. */
export const pageTitle = 'font-heading text-2xl font-bold text-foreground'
export const pageDesc = 'mt-1 text-sm text-muted-foreground'

export const card =
  'rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm'
export const cardForm = `${card} space-y-4 max-w-xl`
export const sectionFormTitle = 'text-sm font-medium text-foreground'

export const label = 'block text-xs font-medium text-muted-foreground'
export const input =
  'mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/** Optional: explicit sizing/alignment with global checkbox skin (see index.css `input[type='checkbox']`). */
export const checkboxInput = 'h-4 w-4 shrink-0 align-middle'

export const btnPrimary =
  'rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:pointer-events-none disabled:opacity-50'

export const alertError =
  'rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive'

export const tableWrap = 'overflow-x-auto rounded-xl border border-border bg-card shadow-sm'
export const tableHead =
  'border-b border-border bg-muted/50 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground'
export const tableBody = 'divide-y divide-border'
export const tableRowHover = 'transition-colors hover:bg-muted/40'
export const emptyCell = 'px-4 py-8 text-center text-muted-foreground'

export const linkTile =
  'flex items-center justify-between rounded-xl border border-border bg-card p-4 text-sm font-medium text-primary shadow-sm transition-colors hover:border-primary/30 hover:bg-muted/30'

export const statCardInner = 'text-xs font-medium uppercase tracking-wide text-muted-foreground'
export const statCardValue = 'mt-2 font-heading text-2xl font-bold text-foreground'
export const statCardSub = 'mt-1 text-sm text-muted-foreground'
