import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { Filter, Plus, Search } from 'lucide-react'
import type { Donation } from '../../../../api/adminTypes'
import { btnPrimary, card, input, label, sectionFormTitle, tableBody, tableHead, tableWrap } from '../../shared/adminStyles'
import { donationTypeOptions } from './donorDetailConstants'
import { formatDonationAmount, formatDonationDate } from './donorDetailUtils'

type SortKey = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'

type Props = {
  donations: Donation[]
  supporterId: number
  saving: boolean
  /** Return true when a donation was saved successfully (closes the add panel). */
  onAddDonation: () => Promise<boolean>
  dType: string
  setDType: (v: string) => void
  dAmount: string
  setDAmount: (v: string) => void
  dDate: string
  setDDate: (v: string) => void
  dNotes: string
  setDNotes: (v: string) => void
  dCampaign: string
  setDCampaign: (v: string) => void
}

function uniqSorted(values: (string | null | undefined)[]) {
  const set = new Set<string>()
  for (const v of values) {
    const t = v?.trim()
    if (t) set.add(t)
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

function useClickOutside(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      const el = ref.current
      if (el && !el.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, onClose, ref])
}

export function DonationPanel({
  donations,
  supporterId,
  saving,
  onAddDonation,
  dType,
  setDType,
  dAmount,
  setDAmount,
  dDate,
  setDDate,
  dNotes,
  setDNotes,
  dCampaign,
  setDCampaign,
}: Props) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('__all__')
  const [channelFilter, setChannelFilter] = useState<string>('__all__')
  const [campaignFilter, setCampaignFilter] = useState<string>('__all__')
  const [sortKey, setSortKey] = useState<SortKey>('date-desc')
  const [filterOpen, setFilterOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

  const filterRef = useRef<HTMLDivElement>(null)
  const addRef = useRef<HTMLDivElement>(null)

  const closeFilter = useCallback(() => setFilterOpen(false), [])
  const closeAdd = useCallback(() => setAddOpen(false), [])
  useClickOutside(filterRef, filterOpen, closeFilter)
  useClickOutside(addRef, addOpen, closeAdd)

  const typeOptions = useMemo(() => {
    const fromData = uniqSorted(donations.map((d) => d.donationType))
    const merged = new Set([...donationTypeOptions, ...fromData])
    return [...merged].sort((a, b) => a.localeCompare(b))
  }, [donations])

  const channelOptions = useMemo(() => uniqSorted(donations.map((d) => d.channelSource)), [donations])
  const campaignOptions = useMemo(() => uniqSorted(donations.map((d) => d.campaignName)), [donations])

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase()
    let rows = donations.filter((d) => {
      if (typeFilter !== '__all__' && d.donationType !== typeFilter) return false
      if (channelFilter !== '__all__' && (d.channelSource ?? '') !== channelFilter) return false
      if (campaignFilter !== '__all__' && (d.campaignName ?? '') !== campaignFilter) return false
      if (!q) return true
      const hay = `${d.donationType} ${d.channelSource ?? ''} ${d.campaignName ?? ''} ${d.notes ?? ''} ${d.amount ?? ''}`
        .toLowerCase()
      return hay.includes(q)
    })

    rows = [...rows].sort((a, b) => {
      const ta = new Date(a.donationDate).getTime()
      const tb = new Date(b.donationDate).getTime()
      const aa = a.amount ?? 0
      const ab = b.amount ?? 0
      switch (sortKey) {
        case 'date-desc':
          return tb - ta
        case 'date-asc':
          return ta - tb
        case 'amount-desc':
          return ab - aa
        case 'amount-asc':
          return aa - ab
        default:
          return 0
      }
    })
    return rows
  }, [donations, search, typeFilter, channelFilter, campaignFilter, sortKey])

  const selectClass = `${input} bg-background`
  const filterDropdownActive =
    typeFilter !== '__all__' ||
    channelFilter !== '__all__' ||
    campaignFilter !== '__all__' ||
    sortKey !== 'date-desc'
  const anyTableFilters = search.trim() !== '' || filterDropdownActive

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-heading text-lg font-semibold text-foreground">Donations</h2>
            <p className="text-sm text-muted-foreground">
              {filteredSorted.length} of {donations.length} shown
              {anyTableFilters ? ' · filters active' : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              className={`${input} pl-9`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search donations (amount, type, campaign, notes…)"
              aria-label="Search donations"
            />
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
          <div className="relative" ref={filterRef}>
            <button
              type="button"
              onClick={() => {
                setFilterOpen((o) => !o)
                setAddOpen(false)
              }}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                filterDropdownActive
                  ? 'border-primary/50 bg-primary/10 text-foreground'
                  : 'border-border bg-background text-foreground hover:bg-muted/50'
              }`}
            >
              <Filter className="h-4 w-4" aria-hidden />
              Filters
            </button>
            {filterOpen ? (
              <div className="absolute right-0 z-30 mt-1 w-[min(100vw-2rem,22rem)] rounded-xl border border-border bg-card p-4 shadow-lg sm:left-0 sm:right-auto sm:w-96">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Filter & sort</p>
                <div className="mt-3 grid gap-3">
                  <label className={label}>
                    Type
                    <select className={selectClass} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                      <option value="__all__">All types</option>
                      {typeOptions.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={label}>
                    Channel
                    <select
                      className={selectClass}
                      value={channelFilter}
                      onChange={(e) => setChannelFilter(e.target.value)}
                    >
                      <option value="__all__">All channels</option>
                      {channelOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={label}>
                    Campaign
                    <select
                      className={selectClass}
                      value={campaignFilter}
                      onChange={(e) => setCampaignFilter(e.target.value)}
                    >
                      <option value="__all__">All campaigns</option>
                      {campaignOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={label}>
                    Sort
                    <select
                      className={selectClass}
                      value={sortKey}
                      onChange={(e) => setSortKey(e.target.value as SortKey)}
                    >
                      <option value="date-desc">Newest first</option>
                      <option value="date-asc">Oldest first</option>
                      <option value="amount-desc">Amount high → low</option>
                      <option value="amount-asc">Amount low → high</option>
                    </select>
                  </label>
                </div>
                <button
                  type="button"
                  className="mt-3 w-full rounded-lg border border-border py-2 text-sm text-muted-foreground hover:bg-muted/40"
                  onClick={() => {
                    setTypeFilter('__all__')
                    setChannelFilter('__all__')
                    setCampaignFilter('__all__')
                    setSortKey('date-desc')
                  }}
                >
                  Reset type, channel, campaign & sort
                </button>
              </div>
            ) : null}
          </div>

          <div className="relative" ref={addRef}>
            <button
              type="button"
              onClick={() => {
                setAddOpen((o) => !o)
                setFilterOpen(false)
              }}
              className={`${btnPrimary} inline-flex items-center gap-2`}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add donation
            </button>
            {addOpen ? (
              <div className="absolute right-0 z-30 mt-1 w-[min(100vw-2rem,26rem)] rounded-xl border border-border bg-card p-4 shadow-lg sm:left-0 sm:right-auto sm:w-[28rem]">
                <p className={sectionFormTitle}>New donation</p>
                <p className="mt-1 text-xs text-muted-foreground">Supporter #{supporterId}</p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    void (async () => {
                      const ok = await onAddDonation()
                      if (ok) closeAdd()
                    })()
                  }}
                  className="mt-4 grid gap-3"
                >
                  <label className={label}>
                    Type
                    <select className={input} value={dType} onChange={(e) => setDType(e.target.value)}>
                      {donationTypeOptions.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={label}>
                    Amount
                    <input
                      type="number"
                      className={input}
                      value={dAmount}
                      placeholder="0.00"
                      onChange={(e) => setDAmount(e.target.value)}
                      step="0.01"
                      min="0"
                    />
                  </label>
                  <label className={label}>
                    Date
                    <input type="date" className={input} value={dDate} onChange={(e) => setDDate(e.target.value)} />
                  </label>
                  <label className={label}>
                    Campaign (optional)
                    <input
                      className={input}
                      value={dCampaign}
                      onChange={(e) => setDCampaign(e.target.value)}
                      placeholder="Campaign name"
                    />
                  </label>
                  <label className={label}>
                    Notes (optional)
                    <textarea
                      className={input}
                      rows={2}
                      placeholder="Context for this gift"
                      value={dNotes}
                      onChange={(e) => setDNotes(e.target.value)}
                    />
                  </label>
                  <button type="submit" disabled={saving} className={btnPrimary}>
                    {saving ? 'Saving…' : 'Save donation'}
                  </button>
                </form>
              </div>
            ) : null}
          </div>
          </div>
        </div>
      </div>

      {donations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No donations yet. Use <strong>Add donation</strong> to record the first gift.
        </div>
      ) : filteredSorted.length === 0 ? (
        <div className={`${card} text-center text-sm text-muted-foreground`}>No donations match these filters.</div>
      ) : (
        <div className={tableWrap}>
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className={tableHead}>
              <tr>
                <th className="px-3 py-2.5 font-medium">Date</th>
                <th className="px-3 py-2.5 font-medium">Amount</th>
                <th className="px-3 py-2.5 font-medium">Type</th>
                <th className="px-3 py-2.5 font-medium">Channel</th>
                <th className="px-3 py-2.5 font-medium">Campaign</th>
                <th className="px-3 py-2.5 font-medium">Notes</th>
                <th className="px-3 py-2.5 font-medium">Recurring</th>
              </tr>
            </thead>
            <tbody className={tableBody}>
              {filteredSorted.map((d) => (
                <tr key={d.id} className="align-top">
                  <td className="px-3 py-3 tabular-nums text-muted-foreground">{formatDonationDate(d.donationDate)}</td>
                  <td className="px-3 py-3 font-semibold text-foreground">{formatDonationAmount(d)}</td>
                  <td className="px-3 py-3 text-foreground">{d.donationType}</td>
                  <td className="px-3 py-3 text-muted-foreground">{d.channelSource ?? '—'}</td>
                  <td className="px-3 py-3 text-muted-foreground">{d.campaignName ?? '—'}</td>
                  <td className="max-w-[14rem] px-3 py-3 text-muted-foreground">
                    {d.notes ? <span className="line-clamp-2">{d.notes}</span> : '—'}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{d.isRecurring ? 'Yes' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
