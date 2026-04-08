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
} from './adminStyles'
import {
  createSupporter,
  deleteSupporter,
  getSupporters,
  patchSupporterFields,
  type CreateSupporterBody,
  type Supporter,
} from '../../api/admin'
import { useSupabaseForLighthouseData } from '../../lib/useSupabaseLighthouse'
import { AdminListToolbar } from './AdminListToolbar'
import { matchesColFilter, nextSortState, sortRows, SortableTh, type SortDirection } from './SortableTh'

const supporterTypes = [
  'MonetaryDonor',
  'Volunteer',
  'InKindDonor',
  'SkillsContributor',
  'SocialMediaAdvocate',
  'PartnerOrganization',
] as const

type ColFilters = {
  displayName: string
  supporterType: string
  email: string
  phone: string
  region: string
  country: string
  status: string
  organizationName: string
  acquisitionChannel: string
}

const emptyColFilters = (): ColFilters => ({
  displayName: '',
  supporterType: '',
  email: '',
  phone: '',
  region: '',
  country: '',
  status: '',
  organizationName: '',
  acquisitionChannel: '',
})

const COL_LABELS: Record<keyof ColFilters, string> = {
  displayName: 'Name',
  supporterType: 'Type',
  email: 'Email',
  phone: 'Phone',
  region: 'Region',
  country: 'Country',
  status: 'Status',
  organizationName: 'Organization',
  acquisitionChannel: 'Acquisition channel',
}

export function DonorsAdminPage() {
  const sbData = useSupabaseForLighthouseData()
  const navigate = useNavigate()
  const [rows, setRows] = useState<Supporter[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<Supporter | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [colFilters, setColFilters] = useState<ColFilters>(emptyColFilters)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const [form, setForm] = useState<CreateSupporterBody>({
    supporterType: 'MonetaryDonor',
    displayName: '',
    status: 'Active',
    country: 'Ghana',
    acquisitionChannel: 'Website',
  })
  const [saving, setSaving] = useState(false)

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

  const filteredSorted = useMemo(() => {
    let list = rows.filter((s) => {
      const hay = `${s.displayName} ${s.email ?? ''} ${s.supporterType} ${s.region ?? ''} ${s.phone ?? ''} ${s.country ?? ''} ${s.status} ${s.organizationName ?? ''} ${s.acquisitionChannel ?? ''} ${s.firstName ?? ''} ${s.lastName ?? ''}`.toLowerCase()
      if (q.trim() && !hay.includes(q.trim().toLowerCase())) return false
      if (!matchesColFilter(s.displayName, colFilters.displayName)) return false
      if (!matchesColFilter(s.supporterType, colFilters.supporterType)) return false
      if (!matchesColFilter(s.email, colFilters.email)) return false
      if (!matchesColFilter(s.phone, colFilters.phone)) return false
      if (!matchesColFilter(s.region, colFilters.region)) return false
      if (!matchesColFilter(s.country, colFilters.country)) return false
      if (!matchesColFilter(s.status, colFilters.status)) return false
      if (!matchesColFilter(s.organizationName, colFilters.organizationName)) return false
      if (!matchesColFilter(s.acquisitionChannel, colFilters.acquisitionChannel)) return false
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
        case 'phone':
          return row.phone ?? ''
        case 'region':
          return row.region ?? ''
        case 'country':
          return row.country ?? ''
        case 'status':
          return row.status
        case 'organizationName':
          return row.organizationName ?? ''
        case 'acquisitionChannel':
          return row.acquisitionChannel ?? ''
        default:
          return ''
      }
    })
    return list
  }, [rows, q, colFilters, sortKey, sortDir])

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
    if (allOn) {
      setSelected((prev) => {
        const n = new Set(prev)
        for (const id of ids) n.delete(id)
        return n
      })
    } else {
      setSelected((prev) => {
        const n = new Set(prev)
        for (const id of ids) n.add(id)
        return n
      })
    }
  }

  async function bulkDelete() {
    if (!sbData || selected.size === 0) return
    const names = filteredSorted.filter((s) => selected.has(s.id)).map((s) => s.displayName)
    if (
      !confirm(
        `Delete ${selected.size} supporter(s)?\n\n${names.slice(0, 8).join(', ')}${names.length > 8 ? '…' : ''}\n\nThis cannot be undone.`,
      )
    )
      return
    setSaving(true)
    setError(null)
    try {
      for (const id of selected) {
        await deleteSupporter(id)
      }
      setSelected(new Set())
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
    if (!edit || !sbData) return
    setSaving(true)
    setError(null)
    try {
      await patchSupporterFields(edit.id, {
        supporter_type: edit.supporterType,
        display_name: edit.displayName,
        organization_name: edit.organizationName ?? '',
        first_name: edit.firstName ?? '',
        last_name: edit.lastName ?? '',
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

  const colCount = sbData ? 6 : 4

  return (
    <div className="space-y-8">
      <div>
        <h2 className={pageTitle}>Donors</h2>
        <p className={pageDesc}>
          Filter by any column, sort from headers, and open a row to view the donor profile. Bulk delete requires
          Supabase data mode.
        </p>
      </div>

      {error && <div className={alertError}>{error}</div>}

      <AdminListToolbar
        searchValue={q}
        onSearchChange={setQ}
        searchPlaceholder="Search all fields…"
        filterOpen={filterOpen}
        onFilterToggle={() => setFilterOpen((o) => !o)}
        onAddClick={openAddDonor}
        addLabel="Add donor"
      />

      {selected.size > 0 && sbData && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
          <span className="text-muted-foreground">{selected.size} selected</span>
          <button type="button" className={btnPrimary} disabled={saving} onClick={() => void bulkDelete()}>
            Delete selected…
          </button>
          <button type="button" className="text-sm text-primary hover:underline" onClick={() => setSelected(new Set())}>
            Clear selection
          </button>
        </div>
      )}

      {filterOpen && (
        <div className={`${card} grid gap-3 sm:grid-cols-2 lg:grid-cols-3`}>
          <p className="text-sm font-medium text-foreground sm:col-span-2 lg:col-span-3">Filter by column (contains)</p>
          {(Object.keys(colFilters) as (keyof ColFilters)[]).map((k) => (
            <label key={k} className={label}>
              {COL_LABELS[k]}
              <input
                className={input}
                value={colFilters[k]}
                onChange={(e) => setColFilters((f) => ({ ...f, [k]: e.target.value }))}
                placeholder="Contains…"
              />
            </label>
          ))}
          <div className="flex items-end sm:col-span-2 lg:col-span-3">
            <button type="button" className="text-sm text-primary hover:underline" onClick={() => setColFilters(emptyColFilters())}>
              Clear column filters
            </button>
          </div>
        </div>
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
              {sbData && (
                <th className="w-10 px-2 py-2">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={filteredSorted.length > 0 && filteredSorted.every((s) => selected.has(s.id))}
                    onChange={() => toggleSelectAll()}
                  />
                </th>
              )}
              <SortableTh label="Name" sortKey="displayName" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Type" sortKey="supporterType" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Email" sortKey="email" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Status" sortKey="status" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              {sbData && <th className="w-24 px-3 py-2">Edit</th>}
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
                  {sbData && (
                    <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${s.displayName}`}
                        checked={selected.has(s.id)}
                        onChange={() => toggleSelect(s.id)}
                      />
                    </td>
                  )}
                  <td className="px-3 py-2 font-medium">{s.displayName}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.supporterType}</td>
                  <td className="px-3 py-2 text-xs">{s.email ?? '—'}</td>
                  <td className="px-3 py-2 text-xs">{s.status}</td>
                  {sbData && (
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="text-primary hover:underline" onClick={() => setEdit({ ...s })}>
                        Edit
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className={`${card} max-h-[90vh] w-full max-w-lg overflow-y-auto`}>
            <p className={sectionFormTitle}>Edit supporter</p>
            <div className="grid gap-2">
              {(
                [
                  ['displayName', 'Display name'],
                  ['supporterType', 'Type'],
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
