import { Children, useMemo, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { input, label } from '../adminStyles'
import type { TriBool } from './adminFormatters'

const filterBox =
  'rounded-2xl border border-border bg-card p-4 shadow-sm'
const filterGroup =
  'rounded-xl border border-border/80 bg-background/70 p-3'
const detailBtn =
  'flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-sm text-foreground hover:bg-muted/40'

export function FilterPanelCard({
  children,
  onClearAll,
  activeSummary,
}: {
  children: ReactNode
  onClearAll: () => void
  activeSummary?: string[]
}) {
  return (
    <div className={`${filterBox} space-y-4`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">Filters</p>
          <p className="text-xs text-muted-foreground">Narrow the table with quick controls below.</p>
        </div>
        <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={onClearAll}>
          Clear all
        </button>
      </div>
      {activeSummary && activeSummary.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {activeSummary.map((t) => (
            <span
              key={t}
              className="inline-flex items-center rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
            >
              {t}
            </span>
          ))}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Children.map(children, (child, index) => (
          <div key={index} className={filterGroup}>
            {child}
          </div>
        ))}
      </div>
    </div>
  )
}

export function TextSearchFilter({
  labelText,
  value,
  onChange,
  placeholder,
}: {
  labelText: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <label className={label}>
      {labelText}
      <input
        type="search"
        className={input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Search…'}
      />
    </label>
  )
}

export function DateRangeFilter({
  labelText,
  from,
  to,
  onFrom,
  onTo,
}: {
  labelText: string
  from: string
  to: string
  onFrom: (v: string) => void
  onTo: (v: string) => void
}) {
  return (
    <div>
      <p className={label}>{labelText}</p>
      <div className="mt-1 flex flex-wrap gap-2">
        <input type="date" className={`${input} mt-0 w-full min-w-[10rem] flex-1`} value={from} onChange={(e) => onFrom(e.target.value)} />
        <span className="self-center text-xs text-muted-foreground">to</span>
        <input type="date" className={`${input} mt-0 w-full min-w-[10rem] flex-1`} value={to} onChange={(e) => onTo(e.target.value)} />
      </div>
    </div>
  )
}

export function MinMaxFilter({
  labelText,
  min,
  max,
  onMin,
  onMax,
  inputMode = 'decimal',
}: {
  labelText: string
  min: string
  max: string
  onMin: (v: string) => void
  onMax: (v: string) => void
  inputMode?: 'decimal' | 'numeric'
}) {
  return (
    <div>
      <p className={label}>{labelText}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <input
          type="text"
          inputMode={inputMode}
          className={`${input} mt-0 w-full min-w-[5rem] flex-1`}
          value={min}
          onChange={(e) => onMin(e.target.value)}
          placeholder="Min"
        />
        <span className="text-xs text-muted-foreground">–</span>
        <input
          type="text"
          inputMode={inputMode}
          className={`${input} mt-0 w-full min-w-[5rem] flex-1`}
          value={max}
          onChange={(e) => onMax(e.target.value)}
          placeholder="Max"
        />
      </div>
    </div>
  )
}

export function TriBoolFilter({
  labelText,
  value,
  onChange,
}: {
  labelText: string
  value: TriBool
  onChange: (v: TriBool) => void
}) {
  const seg = (v: TriBool, t: string) => (
    <button
      key={v}
      type="button"
      onClick={() => onChange(v)}
      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
        value === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/60'
      }`}
    >
      {t}
    </button>
  )
  return (
    <div>
      <p className={label}>{labelText}</p>
      <div className="mt-1 inline-flex rounded-lg border border-border bg-muted/30 p-0.5">
        {seg('all', 'All')}
        {seg('yes', 'Yes')}
        {seg('no', 'No')}
      </div>
    </div>
  )
}

function toggleInSet<T>(set: Set<T>, v: T): Set<T> {
  const n = new Set(set)
  if (n.has(v)) n.delete(v)
  else n.add(v)
  return n
}

export function MultiSelectFilter({
  labelText,
  options,
  selected,
  onChange,
}: {
  labelText: string
  options: string[]
  selected: Set<string>
  onChange: (s: Set<string>) => void
}) {
  const [open, setOpen] = useState(false)
  const summary = useMemo(() => {
    if (selected.size === 0) return 'All'
    if (selected.size <= 2) return [...selected].join(', ')
    return `${selected.size} selected`
  }, [selected])

  return (
    <div className="relative">
      <p className={label}>{labelText}</p>
      <button type="button" className={`${detailBtn} mt-1`} onClick={() => setOpen((o) => !o)}>
        <span className="truncate">{summary}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-10 cursor-default bg-transparent" aria-label="Close" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border border-border bg-card p-2 shadow-md">
            <div className="mb-2 flex gap-2 border-b border-border pb-2">
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => onChange(new Set(options))}
              >
                Select all
              </button>
              <button type="button" className="text-xs text-primary hover:underline" onClick={() => onChange(new Set())}>
                Clear
              </button>
            </div>
            {options.map((opt) => (
              <label key={opt} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1.5 text-sm hover:bg-muted/50">
                <input
                  type="checkbox"
                  checked={selected.has(opt)}
                  onChange={() => onChange(toggleInSet(selected, opt))}
                />
                <span className="truncate">{opt}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export type EntityOption = { id: number; label: string }

export function SearchableEntityMultiFilter({
  labelText,
  options,
  selectedIds,
  onChange,
  search,
  onSearchChange,
}: {
  labelText: string
  options: EntityOption[]
  selectedIds: Set<number>
  onChange: (s: Set<number>) => void
  search: string
  onSearchChange: (s: string) => void
}) {
  const [open, setOpen] = useState(false)
  const q = search.trim().toLowerCase()
  const filtered = useMemo(
    () =>
      options.filter(
        (o) =>
          !q ||
          o.label.toLowerCase().includes(q) ||
          String(o.id).includes(q),
      ),
    [options, q],
  )
  const summary =
    selectedIds.size === 0 ? 'All' : selectedIds.size === 1
      ? options.find((o) => selectedIds.has(o.id))?.label ?? `${[...selectedIds][0]}`
      : `${selectedIds.size} selected`

  return (
    <div className="relative">
      <p className={label}>{labelText}</p>
      <button type="button" className={`${detailBtn} mt-1`} onClick={() => setOpen((o) => !o)}>
        <span className="truncate">{summary}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-10 cursor-default" aria-label="Close" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 z-20 mt-1 rounded-lg border border-border bg-card p-2 shadow-md">
            <input
              type="search"
              className={`${input} mb-2`}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search…"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="mb-2 flex gap-2 text-xs">
              <button type="button" className="text-primary hover:underline" onClick={() => onChange(new Set(filtered.map((o) => o.id)))}>
                Select visible
              </button>
              <button type="button" className="text-primary hover:underline" onClick={() => onChange(new Set())}>
                Clear
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filtered.map((o) => (
                <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1.5 text-sm hover:bg-muted/50">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(o.id)}
                    onChange={() => onChange(toggleInSet(selectedIds, o.id))}
                  />
                  <span className="min-w-0 truncate">{o.label}</span>
                </label>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
