import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
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

const supporterTypes = [
  'MonetaryDonor',
  'Volunteer',
  'InKindDonor',
  'SkillsContributor',
  'SocialMediaAdvocate',
  'PartnerOrganization',
] as const

export function DonorsAdminPage() {
  const sbData = useSupabaseForLighthouseData()
  const [rows, setRows] = useState<Supporter[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [edit, setEdit] = useState<Supporter | null>(null)

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

  const filtered = rows.filter((s) => {
    const hay = `${s.displayName} ${s.email ?? ''} ${s.supporterType} ${s.region ?? ''}`.toLowerCase()
    if (q && !hay.includes(q.toLowerCase())) return false
    if (typeFilter && s.supporterType !== typeFilter) return false
    return true
  })

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
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function onDelete(s: Supporter) {
    if (!confirm(`Delete supporter ${s.displayName}?`)) return
    if (!sbData) {
      setError('Deleting supporters requires Supabase data mode.')
      return
    }
    try {
      await deleteSupporter(s.id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
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

  return (
    <div className="space-y-8">
      <div>
        <h2 className={pageTitle}>Donors</h2>
        <p className={pageDesc}>
          Search and filter supporters. Full edit and delete require Supabase data mode. Open a row for the donor
          profile and contribution history.
        </p>
      </div>

      {error && <div className={alertError}>{error}</div>}

      <div className={`${card} flex flex-wrap items-end gap-3`}>
        <label className={label}>
          Search
          <input className={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email, type…" />
        </label>
        <label className={label}>
          Supporter type
          <select className={input} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All</option>
            {supporterTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      <form onSubmit={onCreate} className={`${card} grid gap-3 md:grid-cols-2`}>
        <p className={`${sectionFormTitle} md:col-span-2`}>Add supporter</p>
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
          <input
            className={input}
            value={form.region ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
          />
        </label>
        <label className={label}>
          Country
          <input
            className={input}
            value={form.country ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
          />
        </label>
        <label className={label}>
          Phone
          <input
            className={input}
            value={form.phone ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
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
            Add supporter
          </button>
        </div>
      </form>

      <div className={tableWrap}>
        <table className="w-full text-left text-sm">
          <thead className={tableHead}>
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className={tableBody}>
            {loading ? (
              <tr>
                <td colSpan={5} className={emptyCell}>
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className={emptyCell}>
                  No supporters match.
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.id} className={tableRowHover}>
                  <td className="px-3 py-2 font-medium">{s.displayName}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.supporterType}</td>
                  <td className="px-3 py-2 text-xs">{s.email ?? '—'}</td>
                  <td className="px-3 py-2 text-xs">{s.status}</td>
                  <td className="space-x-2 px-3 py-2 text-right">
                    <Link to={`/admin/donors/${s.id}`} className="text-primary hover:underline">
                      View
                    </Link>
                    {sbData && (
                      <>
                        <button type="button" className="text-primary hover:underline" onClick={() => setEdit({ ...s })}>
                          Edit
                        </button>
                        <button type="button" className="text-destructive hover:underline" onClick={() => void onDelete(s)}>
                          Delete
                        </button>
                      </>
                    )}
                  </td>
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
