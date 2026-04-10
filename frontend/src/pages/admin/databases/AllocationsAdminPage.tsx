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
  createAllocation,
  deleteAllocation,
  getAllocations,
  getDonations,
  getSafehouses,
  patchAllocationFields,
  type DonationAllocation,
} from '../../../api/admin'
import { AdminListToolbar } from '../shared/AdminListToolbar'
import { nextSortState, sortRows, SortableTh, type SortDirection } from '../shared/SortableTh'
import { AdminBulkActionsBar } from '../shared/adminDataTable/AdminBulkActionsBar'
import { AdminDeleteModal } from '../shared/adminDataTable/AdminDeleteModal'
import { CategoryBadge } from '../shared/adminDataTable/AdminBadges'
import {
  FilterPanelCard,
  DateRangeFilter,
  MinMaxFilter,
  MultiSelectFilter,
  SearchableEntityMultiFilter,
} from '../shared/adminDataTable/AdminFilterPrimitives'
import {
  formatAdminDate,
  inAmountRange,
  inDateRange,
  matchesIdMulti,
  matchesStringMulti,
  uniqSortedStrings,
} from '../shared/adminDataTable/adminFormatters'

function formatMoneyPhp(amount: number) {
  return formatUsd(amount)
}

function emptyFilters() {
  return {
    dateFrom: '',
    dateTo: '',
    safehouseIds: new Set<number>(),
    programAreas: new Set<string>(),
    amountMin: '',
    amountMax: '',
  }
}

export function AllocationsAdminPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<DonationAllocation[]>([])
  const [donations, setDonations] = useState<Awaited<ReturnType<typeof getDonations>>>([])
  const [safehouses, setSafehouses] = useState<Awaited<ReturnType<typeof getSafehouses>>>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<DonationAllocation | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filters, setFilters] = useState(emptyFilters)
  const [shSearch, setShSearch] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [deleteModal, setDeleteModal] = useState<{ ids: number[]; labels: string[] } | null>(null)
  const [saving, setSaving] = useState(false)

  const [donId, setDonId] = useState(0)
  const [shId, setShId] = useState(1)
  const [prog, setProg] = useState('Education')
  const [amt, setAmt] = useState('')
  const [allocationSupporterSearch, setAllocationSupporterSearch] = useState('')
  const [allocationNotes, setAllocationNotes] = useState('')

  const programAreaOptions = ['General', 'Education', 'Health', 'Counseling', 'Shelter', 'Nutrition', 'Reintegration'] as const

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [a, d, sh] = await Promise.all([getAllocations(), getDonations(), getSafehouses()])
      setRows(a)
      setDonations(d)
      setSafehouses(sh)
      setDonId((prev) => prev || d[0]?.id || 0)
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

  const donationSupporter = useMemo(() => {
    const m = new Map<number, number>()
    for (const d of donations) m.set(d.id, d.supporterId)
    return m
  }, [donations])

  const supporterOptions = useMemo(
    () =>
      uniqSortedStrings(donations.map((d) => d.supporterDisplayName)).map((displayName) => ({
        id: displayName,
        label: displayName,
      })),
    [donations],
  )
  const selectedAllocationSupporter = useMemo(
    () => supporterOptions.find((option) => option.label === allocationSupporterSearch)?.label ?? '',
    [supporterOptions, allocationSupporterSearch],
  )
  const allocationDonationOptions = useMemo(
    () =>
      donations
        .filter((d) => !selectedAllocationSupporter || d.supporterDisplayName === selectedAllocationSupporter)
        .map((d) => ({
          id: d.id,
          label: `#${d.id} · ${d.supporterDisplayName} · ${formatAdminDate(d.donationDate)}`,
        })),
    [donations, selectedAllocationSupporter],
  )

  const safehouseOptions = useMemo(
    () => safehouses.map((s) => ({ id: s.id, label: `${s.name} (${s.code})` })),
    [safehouses],
  )

  const safehouseNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const s of safehouses) m.set(s.id, s.name)
    return m
  }, [safehouses])

  const programOpts = useMemo(() => uniqSortedStrings(rows.map((r) => r.programArea)), [rows])

  const donationLabel = useCallback(
    (id: number) => {
      const d = donations.find((x) => x.id === id)
      return d ? `#${id} · ${d.supporterDisplayName}` : `#${id}`
    },
    [donations],
  )

  const filteredSorted = useMemo(() => {
    let list = rows.filter((r) => {
      const shName = r.safehouseName ?? safehouseNameById.get(r.safehouseId) ?? ''
      const hay = `${shName} ${r.programArea} ${r.donationId} ${r.id} ${donationLabel(r.donationId)}`.toLowerCase()
      if (q.trim() && !hay.includes(q.trim().toLowerCase())) return false
      if (filters.dateFrom || filters.dateTo) {
        if (!inDateRange(r.allocationDate, filters.dateFrom, filters.dateTo)) return false
      }
      if (!matchesIdMulti(r.safehouseId, filters.safehouseIds)) return false
      if (!matchesStringMulti(r.programArea, filters.programAreas)) return false
      if (!inAmountRange(r.amountAllocated, filters.amountMin, filters.amountMax)) return false
      return true
    })
    list = sortRows(list, sortKey, sortDir, (row, key) => {
      switch (key) {
        case 'allocationDate':
          return row.allocationDate
        case 'donationId':
          return row.donationId
        case 'safehouseId':
          return row.safehouseId
        case 'programArea':
          return row.programArea
        case 'amountAllocated':
          return row.amountAllocated
        default:
          return ''
      }
    })
    return list
  }, [rows, q, filters, sortKey, sortDir, donationLabel, safehouseNameById])

  const activeSummary = useMemo(() => {
    const p: string[] = []
    if (filters.dateFrom || filters.dateTo) p.push('Date range')
    if (filters.safehouseIds.size) p.push(`Safehouses: ${filters.safehouseIds.size}`)
    if (filters.programAreas.size) p.push(`Program: ${filters.programAreas.size}`)
    if (filters.amountMin || filters.amountMax) p.push('Amount range')
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
      .map((r) => `${formatAdminDate(r.allocationDate)} · ${donationLabel(r.donationId)} · ${formatMoneyPhp(r.amountAllocated)}`)
    setDeleteModal({ ids: [...selected], labels })
  }

  async function confirmDelete() {
    if (!deleteModal) return
    setSaving(true)
    setError(null)
    try {
      for (const id of deleteModal.ids) {
        await deleteAllocation(id)
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
    const n = parseFloat(amt)
    if (!donId || !Number.isFinite(n)) return
    setSaving(true)
    setError(null)
    try {
      await createAllocation({
        donationId: donId,
        safehouseId: shId,
        amount: n,
        notes: allocationNotes.trim() || undefined,
        programArea: prog,
      })
      setAmt('')
      setAllocationNotes('')
      setAllocationSupporterSearch('')
      setDonId(0)
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
      await patchAllocationFields(edit.id, {
        program_area: edit.programArea,
        amount_allocated: String(edit.amountAllocated),
        allocation_notes: edit.notes ?? '',
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
    requestAnimationFrame(() => document.getElementById('admin-add-allocation')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function rowNavigate(r: DonationAllocation) {
    const sid = donationSupporter.get(r.donationId)
    if (sid != null) navigate(`/admin/donors/${sid}`)
    else navigate('/admin/contributions')
  }

  const colCount = 8

  return (
    <div className="space-y-6">
      <div>
        <h2 className={pageTitle}>Allocations</h2>
        <p className={pageDesc}>
          Donation allocations — open a row to jump to the linked supporter. Use Edit for quick field updates.
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
        addLabel="Add allocation"
      />

      <AdminBulkActionsBar
        count={selected.size}
        recordLabel="allocation"
        onDeleteClick={openDeleteModal}
        onClearSelection={() => setSelected(new Set())}
        disabled={saving}
      />

      {filterOpen && (
        <FilterPanelCard onClearAll={() => setFilters(emptyFilters())} activeSummary={activeSummary}>
          <DateRangeFilter
            labelText="Allocation date"
            from={filters.dateFrom}
            to={filters.dateTo}
            onFrom={(v) => setFilters((f) => ({ ...f, dateFrom: v }))}
            onTo={(v) => setFilters((f) => ({ ...f, dateTo: v }))}
          />
          <SearchableEntityMultiFilter
            labelText="Safehouse"
            options={safehouseOptions}
            selectedIds={filters.safehouseIds}
            onChange={(s) => setFilters((f) => ({ ...f, safehouseIds: s }))}
            search={shSearch}
            onSearchChange={setShSearch}
          />
          <MultiSelectFilter
            labelText="Program area"
            options={programOpts.length ? programOpts : ['Education', 'Health', 'Counseling']}
            selected={filters.programAreas}
            onChange={(s) => setFilters((f) => ({ ...f, programAreas: s }))}
          />
          <MinMaxFilter
            labelText="Amount allocated (USD)"
            min={filters.amountMin}
            max={filters.amountMax}
            onMin={(v) => setFilters((f) => ({ ...f, amountMin: v }))}
            onMax={(v) => setFilters((f) => ({ ...f, amountMax: v }))}
          />
        </FilterPanelCard>
      )}

      {addOpen && (
        <div id="admin-add-allocation" className={`${card} scroll-mt-28 space-y-3`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">New allocation</span>
            <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setAddOpen(false)}>
              Close
            </button>
          </div>
          <form onSubmit={onCreate} className="flex flex-wrap items-end gap-3">
            <label className={label}>
              Supporter
              <input
                list="allocation-supporter-options"
                className={input}
                value={allocationSupporterSearch}
                onChange={(e) => {
                  setAllocationSupporterSearch(e.target.value)
                  setDonId(0)
                }}
                placeholder="Search donor first"
              />
              <datalist id="allocation-supporter-options">
                {supporterOptions.map((option) => (
                  <option key={option.id} value={option.label} />
                ))}
              </datalist>
            </label>
            <label className={label}>
              Donation
              <select className={input} value={donId} onChange={(e) => setDonId(Number(e.target.value))}>
                <option value={0}>Select donation</option>
                {allocationDonationOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              Safehouse
              <select className={input} value={shId} onChange={(e) => setShId(Number(e.target.value))}>
                {safehouses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              Program area
              <select className={input} value={prog} onChange={(e) => setProg(e.target.value)}>
                {programAreaOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              Amount
              <input className={input} value={amt} onChange={(e) => setAmt(e.target.value)} />
            </label>
            <label className={label}>
              Notes
              <input className={input} value={allocationNotes} onChange={(e) => setAllocationNotes(e.target.value)} />
            </label>
            <button type="submit" disabled={saving} className={btnPrimary}>
              Add allocation
            </button>
          </form>
        </div>
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
              <SortableTh label="Date" sortKey="allocationDate" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Donation" sortKey="donationId" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Safehouse" sortKey="safehouseId" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Program" sortKey="programArea" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Amount" sortKey="amountAllocated" activeKey={sortKey} direction={sortDir} onSort={onSort} />
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
                  No allocations.
                </td>
              </tr>
            ) : (
              filteredSorted.map((r) => (
                <tr
                  key={r.id}
                  className={`${tableRowHover} cursor-pointer`}
                  onClick={() => rowNavigate(r)}
                >
                  <td className="pl-3 pr-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} aria-label={`Select ${r.id}`} />
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{formatAdminDate(r.allocationDate)}</td>
                  <td className="px-3 py-2.5 text-foreground">{donationLabel(r.donationId)}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.safehouseName ?? safehouseNameById.get(r.safehouseId) ?? `— (${r.safehouseId})`}</td>
                  <td className="px-3 py-2.5">
                    <CategoryBadge>{r.programArea}</CategoryBadge>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums font-medium">{formatMoneyPhp(r.amountAllocated)}</td>
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
        title={deleteModal && deleteModal.ids.length === 1 ? 'Delete allocation?' : 'Delete allocations?'}
        body={
          deleteModal
            ? deleteModal.ids.length === 1
              ? 'You are about to delete one allocation record.'
              : `You are about to delete ${deleteModal.ids.length} allocation records.`
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
            <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Donation:</span> {donationLabel(edit.donationId)}
              </p>
              <p>
                <span className="font-medium text-foreground">Safehouse:</span> {edit.safehouseName ?? safehouseNameById.get(edit.safehouseId) ?? '—'}
              </p>
              <p>
                <span className="font-medium text-foreground">Allocation date:</span> {formatAdminDate(edit.allocationDate)}
              </p>
            </div>
            <label className={label}>
              Program area
              <select className={input} value={edit.programArea} onChange={(e) => setEdit({ ...edit, programArea: e.target.value })}>
                {programAreaOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              Amount
              <input
                type="number"
                className={input}
                value={edit.amountAllocated}
                onChange={(e) => setEdit({ ...edit, amountAllocated: parseFloat(e.target.value) || 0 })}
              />
            </label>
            <label className={label}>
              Notes
              <textarea className={input} rows={2} value={edit.notes ?? ''} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
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
