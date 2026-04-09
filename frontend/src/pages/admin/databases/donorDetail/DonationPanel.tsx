import { useMemo, useState, type FormEvent } from 'react'
import type { Donation } from '../../../../api/adminTypes'
import { btnPrimary, card, input, label, sectionFormTitle, tableBody, tableHead, tableWrap } from '../../shared/adminStyles'
import { donationTypeOptions } from './donorDetailConstants'
import { formatDonationAmount, formatDonationDate } from './donorDetailUtils'

type SortKey = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'

type Props = {
  donations: Donation[]
  supporterId: number
  saving: boolean
  onAddDonation: (e: FormEvent) => void
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

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-heading text-lg font-semibold text-foreground">Donations</h2>
          <p className="text-sm text-muted-foreground">Search, filter, and record gifts for this donor.</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/50 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <label className={`${label} sm:col-span-2 lg:col-span-2`}>
            Search
            <input
              className={input}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Amount, type, campaign, notes…"
            />
          </label>
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
            <select className={selectClass} value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}>
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
            <select className={selectClass} value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value)}>
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
        <p className="text-xs text-muted-foreground">
          Showing {filteredSorted.length} of {donations.length} donations
        </p>
      </div>

      <div id="donation-add" className={`${card} space-y-4 scroll-mt-24`}>
        <div>
          <p className={sectionFormTitle}>Add donation</p>
          <p className="mt-1 text-sm text-muted-foreground">Supporter #{supporterId}</p>
        </div>
        <form onSubmit={onAddDonation} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          <label className={`${label} sm:col-span-2 lg:col-span-3`}>
            Notes (optional)
            <textarea
              className={input}
              rows={2}
              placeholder="Context for this gift"
              value={dNotes}
              onChange={(e) => setDNotes(e.target.value)}
            />
          </label>
          <div className="sm:col-span-2 lg:col-span-3">
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? 'Saving…' : 'Add donation'}
            </button>
          </div>
        </form>
      </div>

      {donations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No donations yet. Add the first one above.
        </div>
      ) : filteredSorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No donations match these filters.
        </div>
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
