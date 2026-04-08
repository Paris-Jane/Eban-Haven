import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'

export type SortDirection = 'asc' | 'desc' | null

type SortableThProps = {
  label: string
  sortKey: string
  activeKey: string | null
  direction: SortDirection
  onSort: (key: string) => void
  className?: string
}

/** Sort control is subtle until header hover or column is actively sorted. */
export function SortableTh({ label, sortKey, activeKey, direction, onSort, className = '' }: SortableThProps) {
  const active = activeKey === sortKey && direction != null
  return (
    <th className={`group px-3 py-2 ${className}`}>
      <div className="flex items-center gap-1">
        <span>{label}</span>
        <button
          type="button"
          className={`rounded p-0.5 text-muted-foreground transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring ${
            active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
          onClick={(e) => {
            e.stopPropagation()
            onSort(sortKey)
          }}
          aria-label={`Sort by ${label}`}
        >
          {active && direction === 'asc' ? (
            <ArrowUp className="h-3.5 w-3.5" aria-hidden />
          ) : active && direction === 'desc' ? (
            <ArrowDown className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ArrowUpDown className="h-3.5 w-3.5 opacity-60" aria-hidden />
          )}
        </button>
      </div>
    </th>
  )
}

export function nextSortState(
  key: string,
  prevKey: string | null,
  prevDir: SortDirection,
): { key: string | null; dir: SortDirection } {
  if (prevKey !== key) return { key, dir: 'asc' }
  if (prevDir === 'asc') return { key, dir: 'desc' }
  if (prevDir === 'desc') return { key: null, dir: null }
  return { key, dir: 'asc' }
}

export function sortRows<T>(
  rows: T[],
  sortKey: string | null,
  direction: SortDirection,
  getComparable: (row: T, key: string) => string | number,
): T[] {
  if (!sortKey || !direction) return rows
  const copy = [...rows]
  copy.sort((a, b) => {
    const va = getComparable(a, sortKey)
    const vb = getComparable(b, sortKey)
    if (typeof va === 'number' && typeof vb === 'number') {
      const n = va - vb
      return direction === 'asc' ? n : -n
    }
    const sa = String(va)
    const sb = String(vb)
    const c = sa.localeCompare(sb, undefined, { numeric: true, sensitivity: 'base' })
    return direction === 'asc' ? c : -c
  })
  return copy
}

/** Substring match; empty filter passes. */
export function matchesColFilter(value: string | number | boolean | null | undefined, filter: string): boolean {
  const f = filter.trim().toLowerCase()
  if (!f) return true
  const v =
    value === null || value === undefined
      ? ''
      : typeof value === 'boolean'
        ? value
          ? 'yes'
          : 'no'
        : String(value)
  return v.toLowerCase().includes(f)
}
