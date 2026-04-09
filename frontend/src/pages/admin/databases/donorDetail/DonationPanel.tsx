import { useMemo, useState } from 'react'
import { Filter, Pencil, Plus, Search } from 'lucide-react'
import type { Donation } from '../../../../api/adminTypes'
import { patchDonationFields } from '../../../../api/admin'
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
  /** Refetch donations after an edit is saved. */
  onDonationsUpdated: () => void | Promise<void>
  onError?: (message: string | null) => void
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

export function DonationPanel({
  donations,
  supporterId,
  saving,
  onAddDonation,
  onDonationsUpdated,
  onError,
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
  const [editDonation, setEditDonation] = useState<Donation | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)

  const typeOptions = useMemo(() => {
    const fromData = uniqSorted(donations.map((d) => d.donationType))
    const merged = new Set([...donationTypeOptions, ...fromData])
    return [...merged].sort((a, b) => a.localeCompare(b))
  }, [donations])

  const channelOptions = useMemo(() => uniqSorted(donations.map((d) => d.channelSource)), [donations])
  const campaignOptions = useMemo(() => uniqSorted(donations.map((d) => d.campaignName)), [donations])

  const editTypeSelectOptions = useMemo(() => {
    const fromData = uniqSorted(donations.map((d) => d.donationType))
    const merged = new Set([...donationTypeOptions, ...fromData])
    return [...merged].sort((a, b) => a.localeCompare(b))
  }, [donations])

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
        <div className="flex w-full flex-col gap-2">
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-stretch">
            <div className="relative min-h-[2.5rem] min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                className={`${input} mt-0 h-full min-h-[2.5rem] w-full pl-9`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search donations (amount, type, campaign, notes…)"
                aria-label="Search donations"
              />
            </div>
            <div className="flex min-h-[2.5rem] gap-2 sm:shrink-0">
              <button
                type="button"
                aria-expanded={filterOpen}
                onClick={() => {
                  setFilterOpen((o) => !o)
                  setAddOpen(false)
                }}
                className={`flex h-full min-h-[2.5rem] min-w-[8.25rem] flex-1 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors sm:flex-none sm:min-w-[8.75rem] sm:max-w-[9.5rem] ${
                  filterDropdownActive
                    ? 'border-primary/50 bg-primary/10 text-foreground'
                    : 'border-border bg-background text-foreground hover:bg-muted/50'
                }`}
              >
                <Filter className="h-4 w-4 shrink-0" aria-hidden />
                Filters
              </button>
              <button
                type="button"
                aria-expanded={addOpen}
                onClick={() => {
                  setAddOpen((o) => !o)
                  setFilterOpen(false)
                }}
                className={`${btnPrimary} flex h-full min-h-[2.5rem] min-w-[9rem] flex-1 items-center justify-center gap-2 sm:flex-none sm:min-w-[9.5rem] sm:max-w-[11rem]`}
              >
                <Plus className="h-4 w-4 shrink-0" aria-hidden />
                Add donation
              </button>
            </div>
          </div>

          {filterOpen ? (
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Filter & sort</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                className="mt-3 w-full rounded-lg border border-border py-2 text-sm text-muted-foreground hover:bg-muted/40 sm:w-auto sm:px-6"
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

          {addOpen ? (
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className={sectionFormTitle}>New donation</p>
              <p className="mt-1 text-xs text-muted-foreground">Supporter #{supporterId}</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  void (async () => {
                    const ok = await onAddDonation()
                    if (ok) setAddOpen(false)
                  })()
                }}
                className="mt-4 grid gap-3 sm:grid-cols-2"
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
                <label className={`${label} sm:col-span-2`}>
                  Campaign (optional)
                  <input
                    className={input}
                    value={dCampaign}
                    onChange={(e) => setDCampaign(e.target.value)}
                    placeholder="Campaign name"
                  />
                </label>
                <label className={`${label} sm:col-span-2`}>
                  Notes (optional)
                  <textarea
                    className={input}
                    rows={2}
                    placeholder="Context for this gift"
                    value={dNotes}
                    onChange={(e) => setDNotes(e.target.value)}
                  />
                </label>
                <div className="sm:col-span-2">
                  <button type="submit" disabled={saving} className={btnPrimary}>
                    {saving ? 'Saving…' : 'Save donation'}
                  </button>
                </div>
              </form>
            </div>
          ) : null}
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
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className={tableHead}>
              <tr>
                <th className="px-3 py-2.5 font-medium">Date</th>
                <th className="px-3 py-2.5 font-medium">Amount</th>
                <th className="px-3 py-2.5 font-medium">Type</th>
                <th className="px-3 py-2.5 font-medium">Channel</th>
                <th className="px-3 py-2.5 font-medium">Campaign</th>
                <th className="px-3 py-2.5 font-medium">Notes</th>
                <th className="px-3 py-2.5 font-medium">Recurring</th>
                <th className="px-3 py-2.5 font-medium">Actions</th>
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
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground hover:bg-muted/50"
                      onClick={() => setEditDonation({ ...d })}
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editDonation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className={`${card} max-h-[90vh] w-full max-w-lg overflow-y-auto`}>
            <p className={sectionFormTitle}>Edit donation</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Date, channel, and recurring are read-only here. The API can update type, amount, currency, campaign, and
              notes.
            </p>
            <dl className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
              <div>
                <dt className="font-medium text-foreground/80">Date</dt>
                <dd>{formatDonationDate(editDonation.donationDate)}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground/80">Channel</dt>
                <dd>{editDonation.channelSource ?? '—'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-medium text-foreground/80">Recurring</dt>
                <dd>{editDonation.isRecurring ? 'Yes' : 'No'}</dd>
              </div>
            </dl>
            <div className="mt-4 grid gap-3">
              <label className={label}>
                Type
                <select
                  className={input}
                  value={editDonation.donationType}
                  onChange={(e) => setEditDonation({ ...editDonation, donationType: e.target.value })}
                >
                  {editTypeSelectOptions.map((t) => (
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
                  value={editDonation.amount ?? ''}
                  onChange={(e) =>
                    setEditDonation({
                      ...editDonation,
                      amount: e.target.value === '' ? null : parseFloat(e.target.value) || null,
                    })
                  }
                  step="0.01"
                  min="0"
                />
              </label>
              <label className={label}>
                Currency code (optional)
                <input
                  className={input}
                  value={editDonation.currencyCode ?? ''}
                  onChange={(e) => setEditDonation({ ...editDonation, currencyCode: e.target.value || null })}
                  placeholder="e.g. PHP"
                  maxLength={8}
                />
              </label>
              <label className={label}>
                Campaign
                <input
                  className={input}
                  value={editDonation.campaignName ?? ''}
                  onChange={(e) => setEditDonation({ ...editDonation, campaignName: e.target.value || null })}
                />
              </label>
              <label className={label}>
                Notes
                <textarea
                  className={input}
                  rows={3}
                  value={editDonation.notes ?? ''}
                  onChange={(e) => setEditDonation({ ...editDonation, notes: e.target.value || null })}
                />
              </label>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                className={btnPrimary}
                disabled={savingEdit}
                onClick={() => {
                  void (async () => {
                    if (!editDonation) return
                    const amt = editDonation.amount
                    if (amt == null || !Number.isFinite(amt) || amt <= 0) {
                      onError?.('Enter a valid amount greater than zero.')
                      return
                    }
                    setSavingEdit(true)
                    onError?.(null)
                    try {
                      await patchDonationFields(editDonation.id, {
                        donation_type: editDonation.donationType,
                        amount: String(amt),
                        notes: editDonation.notes ?? '',
                        campaign_name: editDonation.campaignName ?? '',
                        currency_code: (editDonation.currencyCode ?? '').trim(),
                      })
                      setEditDonation(null)
                      await onDonationsUpdated()
                    } catch (e) {
                      onError?.(e instanceof Error ? e.message : 'Failed to save donation')
                    } finally {
                      setSavingEdit(false)
                    }
                  })()
                }}
              >
                {savingEdit ? 'Saving…' : 'Save changes'}
              </button>
              <button
                type="button"
                className="rounded-lg border border-border px-4 py-2 text-sm"
                disabled={savingEdit}
                onClick={() => {
                  setEditDonation(null)
                  onError?.(null)
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
