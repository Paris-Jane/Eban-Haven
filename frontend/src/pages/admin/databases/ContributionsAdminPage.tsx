import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatUsd } from '../../../utils/currency'
import {
  alertError,
  btnPrimary,
  card,
  emptyCell,
  input,
  label,
  pageDesc,
  pageTitle,
  tableBody,
  tableHead,
  tableRowHover,
  tableWrap,
} from '../shared/adminStyles'
import {
  createDonation,
  deleteDonation,
  getDonations,
  getSupporters,
  patchDonationFields,
  type Donation,
} from '../../../api/admin'
import { AdminListToolbar } from '../shared/AdminListToolbar'
import { nextSortState, sortRows, SortableTh, type SortDirection } from '../shared/SortableTh'
import { AdminBulkActionsBar } from '../shared/adminDataTable/AdminBulkActionsBar'
import { AdminDeleteModal } from '../shared/adminDataTable/AdminDeleteModal'
import { BooleanBadge, CategoryBadge } from '../shared/adminDataTable/AdminBadges'
import {
  FilterPanelCard,
  DateRangeFilter,
  MinMaxFilter,
  MultiSelectFilter,
  TextSearchFilter,
  TriBoolFilter,
} from '../shared/adminDataTable/AdminFilterPrimitives'
import {
  formatAdminDate,
  inAmountRange,
  inDateRange,
  matchesStringMulti,
  matchesTriBool,
  type TriBool,
  uniqSortedStrings,
} from '../shared/adminDataTable/adminFormatters'

function formatMoney(amount: number | null, _code: string | null) {
  if (amount == null) return '—'
  return formatUsd(amount)
}

function emptyFilters() {
  return {
    dateFrom: '',
    dateTo: '',
    supporterQuery: '',
    donationTypes: new Set<string>(),
    amountMin: '',
    amountMax: '',
    recurring: 'all' as TriBool,
    campaign: '',
    channels: new Set<string>(),
    impactUnits: new Set<string>(),
  }
}

export function ContributionsAdminPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Donation[]>([])
  const [supporters, setSupporters] = useState<Awaited<ReturnType<typeof getSupporters>>>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<Donation | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filters, setFilters] = useState(emptyFilters)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [deleteModal, setDeleteModal] = useState<{ ids: number[]; labels: string[] } | null>(null)
  const [saving, setSaving] = useState(false)

  const [newSup, setNewSup] = useState(0)
  const [newSupporterSearch, setNewSupporterSearch] = useState('')
  const [newType, setNewType] = useState('Monetary')
  const [newAmt, setNewAmt] = useState('')
  const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [newCampaign, setNewCampaign] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [d, s] = await Promise.all([getDonations(), getSupporters()])
      setRows(d)
      setSupporters(s)
      setNewSup((prev) => prev || s[0]?.id || 0)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const typeOpts = useMemo(() => uniqSortedStrings(rows.map((r) => r.donationType)), [rows])
  const chOpts = useMemo(() => uniqSortedStrings(rows.map((r) => r.channelSource)), [rows])
  const impOpts = useMemo(() => uniqSortedStrings(rows.map((r) => r.impactUnit)), [rows])
  const campaignOpts = useMemo(() => uniqSortedStrings(rows.map((r) => r.campaignName)), [rows])
  const supporterSearchOptions = useMemo(
    () =>
      supporters.map((s) => ({
        id: s.id,
        label: `${s.displayName}${s.email ? ` — ${s.email}` : ''}`,
      })),
    [supporters],
  )
  const selectedNewSupporter = useMemo(
    () => supporterSearchOptions.find((option) => option.label === newSupporterSearch) ?? null,
    [supporterSearchOptions, newSupporterSearch],
  )

  const filteredSorted = useMemo(() => {
    let list = rows.filter((r) => {
      const hay = `${r.supporterDisplayName} ${r.donationType} ${r.campaignName ?? ''} ${r.id}`.toLowerCase()
      if (q.trim() && !hay.includes(q.trim().toLowerCase())) return false
      if (filters.dateFrom || filters.dateTo) {
        if (!inDateRange(r.donationDate, filters.dateFrom, filters.dateTo)) return false
      }
      if (
        filters.supporterQuery.trim() &&
        !r.supporterDisplayName.toLowerCase().includes(filters.supporterQuery.trim().toLowerCase())
      ) {
        return false
      }
      if (!matchesStringMulti(r.donationType, filters.donationTypes)) return false
      if (!inAmountRange(r.amount, filters.amountMin, filters.amountMax)) return false
      if (!matchesTriBool(r.isRecurring, filters.recurring)) return false
      if (filters.campaign.trim() && !(r.campaignName ?? '').toLowerCase().includes(filters.campaign.trim().toLowerCase())) {
        return false
      }
      if (!matchesStringMulti(r.channelSource ?? '', filters.channels)) return false
      if (!matchesStringMulti(r.impactUnit ?? '', filters.impactUnits)) return false
      return true
    })
    list = sortRows(list, sortKey, sortDir, (row, key) => {
      switch (key) {
        case 'donationDate':
          return row.donationDate
        case 'supporterDisplayName':
          return row.supporterDisplayName
        case 'donationType':
          return row.donationType
        case 'amount':
          return row.amount ?? 0
        case 'isRecurring':
          return row.isRecurring ? 1 : 0
        case 'campaignName':
          return row.campaignName ?? ''
        case 'channelSource':
          return row.channelSource ?? ''
        case 'impactUnit':
          return row.impactUnit ?? ''
        default:
          return ''
      }
    })
    return list
  }, [rows, q, filters, sortKey, sortDir])

  const activeSummary = useMemo(() => {
    const p: string[] = []
    if (filters.dateFrom || filters.dateTo) p.push('Date range')
    if (filters.supporterQuery.trim()) p.push('Supporter')
    if (filters.donationTypes.size) p.push(`Types: ${filters.donationTypes.size}`)
    if (filters.amountMin || filters.amountMax) p.push('Amount range')
    if (filters.recurring !== 'all') p.push(`Recurring: ${filters.recurring}`)
    if (filters.campaign.trim()) p.push('Campaign')
    if (filters.channels.size) p.push(`Channel: ${filters.channels.size}`)
    if (filters.impactUnits.size) p.push(`Impact: ${filters.impactUnits.size}`)
    return p
  }, [filters])

  function onSort(key: string) {
    const next = nextSortState(key, sortKey, sortDir)
    setSortKey(next.key)
    setSortDir(next.dir)
  }

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  function toggleSelectAll() {
    const ids = filteredSorted.map((r) => r.id)
    const allOn = ids.length > 0 && ids.every((id) => selected.has(id))
    setSelected((prev) => {
      const n = new Set(prev)
      if (allOn) for (const id of ids) n.delete(id)
      else for (const id of ids) n.add(id)
      return n
    })
  }

  function openDeleteModal() {
    if (selected.size === 0) return
    const labels = filteredSorted
      .filter((r) => selected.has(r.id))
      .map((r) => `${formatAdminDate(r.donationDate)} · ${r.supporterDisplayName} · ${formatMoney(r.amount, r.currencyCode)}`)
    setDeleteModal({ ids: [...selected], labels })
  }

  async function confirmDelete() {
    if (!deleteModal) return
    setSaving(true)
    setError(null)
    try {
      for (const id of deleteModal.ids) {
        await deleteDonation(id)
      }
      setSelected(new Set())
      setDeleteModal(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    const amt = parseFloat(newAmt)
    const supporterId = selectedNewSupporter?.id ?? newSup
    if (!supporterId || !Number.isFinite(amt)) return
    setSaving(true)
    setError(null)
    try {
      await createDonation({
        supporterId,
        donationType: newType,
        amount: amt,
        currencyCode: 'PHP',
        donationDate: `${newDate}T12:00:00`,
        campaignName: newCampaign.trim() || undefined,
      })
      setNewAmt('')
      setNewCampaign('')
      setNewSupporterSearch('')
      setNewSup(0)
      setAddOpen(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  async function saveEdit() {
    if (!edit) return
    setSaving(true)
    try {
        await patchDonationFields(edit.id, {
          donation_type: edit.donationType,
          amount: edit.amount != null ? String(edit.amount) : '',
          notes: edit.notes ?? '',
          campaign_name: edit.campaignName ?? '',
          channel_source: edit.channelSource ?? '',
        })
      setEdit(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  function openAdd() {
    setAddOpen(true)
    requestAnimationFrame(() => document.getElementById('admin-add-donation')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const colCount = 10

  return (
    <div className="space-y-6">
      <div>
        <h2 className={pageTitle}>Donations</h2>
        <p className={pageDesc}>
          Donations ledger — open a row to view the supporter profile. Filters use types and ranges; delete requires
          confirmation.
        </p>
      </div>
      {error && <div className={alertError}>{error}</div>}

      <AdminListToolbar
        searchValue={q}
        onSearchChange={setQ}
        searchPlaceholder="Quick search…"
        filterOpen={filterOpen}
        onFilterToggle={() => setFilterOpen((o) => !o)}
        onAddClick={openAdd}
        addLabel="Add donation"
      />

      <AdminBulkActionsBar
        count={selected.size}
        recordLabel="donation"
        onDeleteClick={openDeleteModal}
        onClearSelection={() => setSelected(new Set())}
        disabled={saving}
      />

      {filterOpen && (
        <FilterPanelCard onClearAll={() => setFilters(emptyFilters())} activeSummary={activeSummary}>
          <DateRangeFilter
            labelText="Donation date"
            from={filters.dateFrom}
            to={filters.dateTo}
            onFrom={(v) => setFilters((f) => ({ ...f, dateFrom: v }))}
            onTo={(v) => setFilters((f) => ({ ...f, dateTo: v }))}
          />
          <TextSearchFilter
            labelText="Supporter"
            value={filters.supporterQuery}
            onChange={(v) => setFilters((f) => ({ ...f, supporterQuery: v }))}
          />
          <MultiSelectFilter
            labelText="Donation type"
            options={typeOpts.length ? typeOpts : ['Monetary', 'InKind', 'Time']}
            selected={filters.donationTypes}
            onChange={(s) => setFilters((f) => ({ ...f, donationTypes: s }))}
          />
          <MinMaxFilter
            labelText="Amount"
            min={filters.amountMin}
            max={filters.amountMax}
            onMin={(v) => setFilters((f) => ({ ...f, amountMin: v }))}
            onMax={(v) => setFilters((f) => ({ ...f, amountMax: v }))}
          />
          <TriBoolFilter
            labelText="Recurring"
            value={filters.recurring}
            onChange={(v) => setFilters((f) => ({ ...f, recurring: v }))}
          />
          <TextSearchFilter
            labelText="Campaign name"
            value={filters.campaign}
            onChange={(v) => setFilters((f) => ({ ...f, campaign: v }))}
          />
          <MultiSelectFilter
            labelText="Channel"
            options={chOpts.length ? chOpts : ['Direct', 'Website']}
            selected={filters.channels}
            onChange={(s) => setFilters((f) => ({ ...f, channels: s }))}
          />
          <MultiSelectFilter
            labelText="Impact unit"
            options={impOpts.length ? impOpts : ['pesos', 'hours', 'items']}
            selected={filters.impactUnits}
            onChange={(s) => setFilters((f) => ({ ...f, impactUnits: s }))}
          />
        </FilterPanelCard>
      )}

      {addOpen && (
        <form id="admin-add-donation" onSubmit={onCreate} className={`${card} scroll-mt-28 flex flex-wrap items-end gap-3`}>
          <div className="flex w-full items-center justify-between">
            <span className="text-sm font-medium">New donation</span>
            <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setAddOpen(false)}>
              Close
            </button>
          </div>
          <label className={label}>
            Supporter
            <input
              list="donation-supporter-options"
              className={input}
              value={newSupporterSearch}
              onChange={(e) => {
                setNewSupporterSearch(e.target.value)
                const match = supporterSearchOptions.find((option) => option.label === e.target.value)
                setNewSup(match?.id ?? 0)
              }}
              placeholder="Search supporter by name or email"
            />
            <datalist id="donation-supporter-options">
              {supporterSearchOptions.map((option) => (
                <option key={option.id} value={option.label} />
              ))}
            </datalist>
          </label>
          <label className={label}>
            Type
            <select className={input} value={newType} onChange={(e) => setNewType(e.target.value)}>
              <option value="Monetary">Monetary</option>
              <option value="InKind">InKind</option>
              <option value="Time">Time</option>
              <option value="Skills">Skills</option>
              <option value="SocialMedia">SocialMedia</option>
            </select>
          </label>
          <label className={label}>
            Amount
            <input className={input} value={newAmt} onChange={(e) => setNewAmt(e.target.value)} />
          </label>
          <label className={label}>
            Date
            <input type="date" className={input} value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          </label>
          <label className={label}>
            Campaign
            <input
              list="donation-campaign-options"
              className={input}
              value={newCampaign}
              onChange={(e) => setNewCampaign(e.target.value)}
              placeholder="Select or enter campaign"
            />
            <datalist id="donation-campaign-options">
              {campaignOpts.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </label>
          <button type="submit" disabled={saving} className={btnPrimary}>
            Add donation
          </button>
        </form>
      )}

      <div className={tableWrap}>
        <table className="w-full text-left text-sm">
          <thead className={tableHead}>
            <tr>
              <th className="w-10 pl-3 pr-2 py-2.5">
                <input
                  type="checkbox"
                  aria-label="Select all on this page"
                  checked={filteredSorted.length > 0 && filteredSorted.every((r) => selected.has(r.id))}
                  onChange={toggleSelectAll}
                  onClick={(e) => e.stopPropagation()}
                />
              </th>
              <SortableTh label="Date" sortKey="donationDate" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Supporter" sortKey="supporterDisplayName" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Type" sortKey="donationType" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Amount" sortKey="amount" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Recurring" sortKey="isRecurring" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Campaign" sortKey="campaignName" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Channel" sortKey="channelSource" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Impact" sortKey="impactUnit" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <th className="px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className={tableBody}>
            {loading ? (
              <tr>
                <td colSpan={colCount} className={emptyCell}>
                  Loading…
                </td>
              </tr>
            ) : filteredSorted.length === 0 ? (
              <tr>
                <td colSpan={colCount} className={emptyCell}>
                  No rows.
                </td>
              </tr>
            ) : (
              filteredSorted.map((r) => (
                <tr
                  key={r.id}
                  className={`${tableRowHover} cursor-pointer`}
                  onClick={() => navigate(`/admin/donors/${r.supporterId}`)}
                >
                  <td className="pl-3 pr-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} aria-label={`Select donation ${r.id}`} />
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{formatAdminDate(r.donationDate)}</td>
                  <td className="px-3 py-2.5 font-medium text-foreground">{r.supporterDisplayName}</td>
                  <td className="px-3 py-2.5">
                    <CategoryBadge>{r.donationType}</CategoryBadge>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums font-medium">{formatMoney(r.amount, r.currencyCode)}</td>
                  <td className="px-3 py-2.5">
                    <BooleanBadge value={r.isRecurring} />
                  </td>
                  <td className="max-w-[160px] truncate px-3 py-2.5 text-muted-foreground" title={r.campaignName ?? ''}>
                    {r.campaignName ?? '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    {r.channelSource ? <CategoryBadge>{r.channelSource}</CategoryBadge> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.impactUnit ?? '—'}</td>
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => setEdit({ ...r })}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AdminDeleteModal
        open={deleteModal != null}
        title={deleteModal && deleteModal.ids.length === 1 ? 'Delete donation?' : 'Delete donations?'}
        body={
          deleteModal
            ? deleteModal.ids.length === 1
              ? 'You are about to delete one donation record.'
              : `You are about to delete ${deleteModal.ids.length} donation records.`
            : ''
        }
        previewLines={deleteModal && deleteModal.labels.length > 1 ? deleteModal.labels : deleteModal?.labels.slice(0, 1)}
        loading={saving}
        onCancel={() => setDeleteModal(null)}
        onConfirm={() => void confirmDelete()}
      />

      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className={`${card} w-full max-w-md space-y-2`}>
            <label className={label}>
              Type
              <input className={input} value={edit.donationType} onChange={(e) => setEdit({ ...edit, donationType: e.target.value })} />
            </label>
            <label className={label}>
              Amount
              <input
                type="number"
                className={input}
                value={edit.amount ?? ''}
                onChange={(e) => setEdit({ ...edit, amount: parseFloat(e.target.value) || null })}
              />
            </label>
            <label className={label}>
              Notes
              <textarea className={input} rows={2} value={edit.notes ?? ''} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
            </label>
            <label className={label}>
              Campaign
              <input className={input} value={edit.campaignName ?? ''} onChange={(e) => setEdit({ ...edit, campaignName: e.target.value })} />
            </label>
            <label className={label}>
              Channel
              <input className={input} value={edit.channelSource ?? ''} onChange={(e) => setEdit({ ...edit, channelSource: e.target.value })} />
            </label>
            <div className="flex gap-2">
              <button type="button" className={btnPrimary} disabled={saving} onClick={() => void saveEdit()}>
                Save
              </button>
              <button type="button" className="rounded-lg border border-border px-4 py-2 text-sm" onClick={() => setEdit(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
