import { Filter, Plus, Search } from 'lucide-react'
import { btnPrimary, input } from './adminStyles'

type AdminListToolbarProps = {
  searchValue: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  filterOpen: boolean
  onFilterToggle: () => void
  onAddClick: () => void
  addLabel: string
}

export function AdminListToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search…',
  filterOpen,
  onFilterToggle,
  onAddClick,
  addLabel,
}: AdminListToolbarProps) {
  return (
    <div className="sticky top-0 z-20 -mx-4 mb-6 border-b border-border bg-background/95 px-4 pb-4 pt-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:-mx-8 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className={`${input} pl-9`}
            aria-label="Search"
          />
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={onFilterToggle}
            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
              filterOpen
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card text-foreground hover:bg-muted/50'
            }`}
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>
          <button type="button" onClick={onAddClick} className={`${btnPrimary} inline-flex items-center gap-2`}>
            <Plus className="h-4 w-4" />
            {addLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
