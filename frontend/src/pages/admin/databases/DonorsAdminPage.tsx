import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  alertError,
  btnPrimary,
  card,
  emptyCell,
  input,
  label,
  pageDesc,
  pageTitle,
  sectionFormTitle,
  tableBody,
  tableHead,
  tableRowHover,
  tableWrap,
} from '../shared/adminStyles'
import {
  createSupporter,
  deleteSupporter,
  getSupporters,
  patchSupporterFields,
  type CreateSupporterBody,
  type Supporter,
} from '../../../api/admin'
import { AdminListToolbar } from '../shared/AdminListToolbar'
import { nextSortState, sortRows, SortableTh, type SortDirection } from '../shared/SortableTh'
import { AdminBulkActionsBar } from '../shared/adminDataTable/AdminBulkActionsBar'
import { AdminDeleteModal } from '../shared/adminDataTable/AdminDeleteModal'
import { CategoryBadge, StatusBadge } from '../shared/adminDataTable/AdminBadges'
import { FilterPanelCard, MultiSelectFilter, TextSearchFilter } from '../shared/adminDataTable/AdminFilterPrimitives'
import { matchesStringMulti, uniqSortedStrings } from '../shared/adminDataTable/adminFormatters'

const supporterTypes = [
  'MonetaryDonor',
  'Volunteer',
  'InKindDonor',
  'SkillsContributor',
  'SocialMediaAdvocate',
  'PartnerOrganization',
] as const

function emptyDonorFilters() {
  return {
    displayName: '',
    email: '',
    supporterTypes: new Set<string>(),
    regions: new Set<string>(),
    statuses: new Set<string>(),
  }
}

export function DonorsAdminPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Supporter[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<Supporter | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filters, setFilters] = useState(emptyDonorFilters)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [deleteModal, setDeleteModal] = useState<{ ids: number[]; labels: string[] } | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState<CreateSupporterBody>({
    supporterType: 'MonetaryDonor',
    displayName: '',
    status: 'Active',
    country: 'Ghana',
    acquisitionChannel: 'Website',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await getSupporters()
      setRows(r)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const regionOptions = useMemo(() => uniqSortedStrings(rows.map((r) => r.region)), [rows])
  const statusOptions = useMemo(() => uniqSortedStrings(rows.map((r) => r.status)), [rows])
  const typeOptions = useMemo(() => {
    const fromData = uniqSortedStrings(rows.map((r) => r.supporterType))
    const merged = new Set([...supporterTypes, ...fromData])
    return [...merged].sort((a, b) => a.localeCompare(b))
  }, [rows])

  const filteredSorted = useMemo(() => {
    let list = rows.filter((s) => {
      const hay = `${s.displayName} ${s.email ?? ''} ${s.supporterType} ${s.region ?? ''} ${s.status}`.toLowerCase()
      if (q.trim() && !hay.includes(q.trim().toLowerCase())) return false
      if (filters.displayName.trim() && !s.displayName.toLowerCase().includes(filters.displayName.trim().toLowerCase())) {
        return false
      }
      if (filters.email.trim() && !(s.email ?? '').toLowerCase().includes(filters.email.trim().toLowerCase())) {
        return false
      }
      if (!matchesStringMulti(s.supporterType, filters.supporterTypes)) return false
      if (!matchesStringMulti(s.region ?? '', filters.regions)) return false
      if (!matchesStringMulti(s.status, filters.statuses)) return false
      return true
    })
    list = sortRows(list, sortKey, sortDir, (row, key) => {
      switch (key) {
        case 'displayName':
          return row.displayName
        case 'supporterType':
          return row.supporterType
        case 'email':
          return row.email ?? ''
        case 'region':
          return row.region ?? ''
        case 'status':
          return row.status
        default:
          return ''
      }
    })
    return list
  }, [rows, q, filters, sortKey, sortDir])

  const activeFilterSummary = useMemo(() => {
    const parts: string[] = []
    if (filters.displayName.trim()) parts.push(`Name: ${filters.displayName.trim()}`)
    if (filters.email.trim()) parts.push(`Email: ${filters.email.trim()}`)
    if (filters.supporterTypes.size) parts.push(`Types: ${filters.supporterTypes.size}`)
    if (filters.regions.size) parts.push(`Region: ${filters.regions.size}`)
    if (filters.statuses.size) parts.push(`Status: ${filters.statuses.size}`)
    return parts
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
    const ids = filteredSorted.map((s) => s.id)
    const allOn = ids.length > 0 && ids.every((id) => selected.has(id))
    setSelected((prev) => {
      const n = new Set(prev)
      if (allOn) for (const id of ids) n.delete(id)
      else for (const id of ids) n.add(id)
      return n
    })
  }

  function openBulkDeleteModal() {
    if (selected.size === 0) return
    const labels = filteredSorted.filter((s) => selected.has(s.id)).map((s) => s.displayName)
    setDeleteModal({ ids: [...selected], labels })
  }

  async function confirmDelete() {
    if (!deleteModal) return
    setSaving(true)
    setError(null)
    try {
      for (const id of deleteModal.ids) {
        await deleteSupporter(id)
      }
      setSelected(new Set())
      setDeleteModal(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setSaving(false)
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!form.displayName?.trim()) return
    setSaving(true)
    setError(null)
    try {
      await createSupporter(form)
      setForm({
        supporterType: form.supporterType,
        displayName: '',
        status: 'Active',
        country: 'Ghana',
        acquisitionChannel: 'Website',
      })
      setAddOpen(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function saveEdit() {
    if (!edit) return
    setSaving(true)
    setError(null)
    try {
      await patchSupporterFields(edit.id, {
        supporter_type: edit.supporterType,
        display_name: edit.displayName,
        organization_name: edit.organizationName ?? '',
        first_name: edit.firstName ?? '',
        last_name: edit.lastName ?? '',
        relationship_type: edit.relationshipType ?? '',
        region: edit.region ?? '',
        country: edit.country ?? '',
        email: edit.email ?? '',
        phone: edit.phone ?? '',
        status: edit.status,
        acquisition_channel: edit.acquisitionChannel ?? '',
      })
      setEdit(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  function openAddDonor() {
    setAddOpen(true)
    requestAnimationFrame(() => {
      document.getElementById('admin-add-donor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const colCount = 7

  return (
    <div className="space-y-6">
      <div>
        <h2 className={pageTitle}>Donors</h2>
        <p className={pageDesc}>
          Supporters directory — filter, sort, and open a row for the full profile. Select rows to delete in bulk
          (confirmation required).
        </p>
      </div>

      {error && <div className={alertError}>{error}</div>}

      <AdminListToolbar
        searchValue={q}
        onSearchChange={setQ}
        searchPlaceholder="Quick search across visible columns…"
        filterOpen={filterOpen}
        onFilterToggle={() => setFilterOpen((o) => !o)}
        onAddClick={openAddDonor}
        addLabel="Add donor"
      />

      <AdminBulkActionsBar
        count={selected.size}
        recordLabel="supporter"
        onDeleteClick={openBulkDeleteModal}
        onClearSelection={() => setSelected(new Set())}
        disabled={saving}
      />

      {filterOpen && (
        <FilterPanelCard
          onClearAll={() => setFilters(emptyDonorFilters())}
          activeSummary={activeFilterSummary}
        >
          <TextSearchFilter
            labelText="Display name"
            value={filters.displayName}
            onChange={(v) => setFilters((f) => ({ ...f, displayName: v }))}
          />
          <TextSearchFilter
            labelText="Email"
            value={filters.email}
            onChange={(v) => setFilters((f) => ({ ...f, email: v }))}
          />
          <MultiSelectFilter
            labelText="Supporter type"
            options={typeOptions}
            selected={filters.supporterTypes}
            onChange={(s) => setFilters((f) => ({ ...f, supporterTypes: s }))}
          />
          <MultiSelectFilter
            labelText="Region"
            options={regionOptions.length ? regionOptions : ['—']}
            selected={filters.regions}
            onChange={(s) => setFilters((f) => ({ ...f, regions: s }))}
          />
          <MultiSelectFilter
            labelText="Status"
            options={statusOptions.length ? statusOptions : ['Active', 'Inactive']}
            selected={filters.statuses}
            onChange={(s) => setFilters((f) => ({ ...f, statuses: s }))}
          />
        </FilterPanelCard>
      )}

      {addOpen && (
        <form
          id="admin-add-donor"
          onSubmit={onCreate}
          className={`${card} scroll-mt-28 grid gap-3 md:grid-cols-2`}
        >
          <div className="flex items-center justify-between md:col-span-2">
            <p className={sectionFormTitle}>Add donor</p>
            <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setAddOpen(false)}>
              Close
            </button>
          </div>
          <label className={label}>
            Type
            <select
              className={input}
              value={form.supporterType}
              onChange={(e) => setForm((f) => ({ ...f, supporterType: e.target.value }))}
            >
              {supporterTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Display name *
            <input
              className={input}
              value={form.displayName}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              required
            />
          </label>
          <label className={label}>
            Email
            <input
              className={input}
              type="email"
              value={form.email ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </label>
          <label className={label}>
            Region
            <input className={input} value={form.region ?? ''} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))} />
          </label>
          <label className={label}>
            Country
            <input className={input} value={form.country ?? ''} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} />
          </label>
          <label className={label}>
            Phone
            <input className={input} value={form.phone ?? ''} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </label>
          <label className={label}>
            Organization
            <input
              className={input}
              value={form.organizationName ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, organizationName: e.target.value }))}
            />
          </label>
          <div className="md:col-span-2">
            <button type="submit" disabled={saving} className={btnPrimary}>
              Add donor
            </button>
          </div>
        </form>
      )}

      <div className={tableWrap}>
        <table className="w-full text-left text-sm">
          <thead className={tableHead}>
            <tr>
              <th className="w-10 px-2 py-2.5">
                <input
                  type="checkbox"
                  aria-label="Select all on this page"
                  checked={filteredSorted.length > 0 && filteredSorted.every((s) => selected.has(s.id))}
                  onChange={toggleSelectAll}
                  onClick={(e) => e.stopPropagation()}
                />
              </th>
              <SortableTh label="Display name" sortKey="displayName" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Type" sortKey="supporterType" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Email" sortKey="email" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Region" sortKey="region" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Status" sortKey="status" activeKey={sortKey} direction={sortDir} onSort={onSort} />
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
                  No supporters match.
                </td>
              </tr>
            ) : (
              filteredSorted.map((s) => (
                <tr
                  key={s.id}
                  className={`${tableRowHover} cursor-pointer`}
                  onClick={() => navigate(`/admin/donors/${s.id}`)}
                >
                  <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${s.displayName}`}
                      checked={selected.has(s.id)}
                      onChange={() => toggleSelect(s.id)}
                    />
                  </td>
                  <td className="px-3 py-2.5 font-medium text-foreground">{s.displayName}</td>
                  <td className="px-3 py-2.5">
                    <CategoryBadge>{s.supporterType}</CategoryBadge>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{s.email ?? '—'}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{s.region ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => setEdit({ ...s })}>
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
        title={deleteModal && deleteModal.ids.length === 1 ? 'Delete supporter?' : 'Delete supporters?'}
        body={
          deleteModal
            ? deleteModal.ids.length === 1
              ? `You are about to delete supporter “${deleteModal.labels[0] ?? deleteModal.ids[0]}”.`
              : `You are about to delete ${deleteModal.ids.length} supporters.`
            : ''
        }
        previewLines={deleteModal && deleteModal.ids.length > 1 ? deleteModal.labels : undefined}
        loading={saving}
        onCancel={() => setDeleteModal(null)}
        onConfirm={() => void confirmDelete()}
      />

      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className={`${card} max-h-[90vh] w-full max-w-lg overflow-y-auto`}>
            <p className={sectionFormTitle}>Edit supporter</p>
            <div className="grid gap-2">
              {(
                [
                  ['displayName', 'Display name'],
                  ['supporterType', 'Type'],
                  ['relationshipType', 'Relationship type'],
                  ['email', 'Email'],
                  ['phone', 'Phone'],
                  ['organizationName', 'Organization'],
                  ['firstName', 'First name'],
                  ['lastName', 'Last name'],
                  ['region', 'Region'],
                  ['country', 'Country'],
                  ['status', 'Status'],
                  ['acquisitionChannel', 'Acquisition channel'],
                ] as const
              ).map(([k, lab]) => (
                <label key={k} className={label}>
                  {lab}
                  <input
                    className={input}
                    value={(edit[k] as string) ?? ''}
                    onChange={(e) => setEdit({ ...edit, [k]: e.target.value })}
                  />
                </label>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
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
