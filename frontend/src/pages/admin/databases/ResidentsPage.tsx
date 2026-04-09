import { useCallback, useEffect, useMemo, useState } from 'react'
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
  createResident,
  deleteResident,
  getResident,
  getResidents,
  getSafehouses,
  patchResident,
  type ResidentDetail,
  type ResidentSummary,
} from '../../../api/admin'
import { AdminListToolbar } from '../shared/AdminListToolbar'
import { nextSortState, sortRows, SortableTh, type SortDirection } from '../shared/SortableTh'
import { AdminBulkActionsBar } from '../shared/adminDataTable/AdminBulkActionsBar'
import { AdminDeleteModal } from '../shared/adminDataTable/AdminDeleteModal'
import { ReintegrationBadge, RiskBadge, StatusBadge } from '../shared/adminDataTable/AdminBadges'
import {
  FilterPanelCard,
  DateRangeFilter,
  MultiSelectFilter,
  SearchableEntityMultiFilter,
  TextSearchFilter,
} from '../shared/adminDataTable/AdminFilterPrimitives'
import {
  formatAdminDate,
  inDateRange,
  matchesIdMulti,
  matchesStringMulti,
  uniqSortedStrings,
} from '../shared/adminDataTable/adminFormatters'

const caseStatuses = ['Active', 'Closed', 'Transferred'] as const
const caseCategoryOptions = [
  'Surrendered',
  'Trafficked',
  'Physical Abuse',
  'Sexual Abuse',
  'Neglect',
  'Child Labor',
  'At Risk',
] as const
const sexOptions = ['F', 'M'] as const
const reintegrationStatuses = ['In Progress', 'Completed', 'On Hold', 'Not Started'] as const
const reintegrationTypes = ['Family Reunification', 'Independent Living', 'Foster Care', 'Shelter Extension'] as const
const riskOptions = ['Low', 'Medium', 'High', 'Critical'] as const

type ResidentFormState = {
  safehouse_id: string
  case_status: string
  case_category: string
  sex: string
  date_of_birth: string
  place_of_birth: string
  religion: string
  sub_cat_trafficked: string
  sub_cat_physical_abuse: string
  sub_cat_at_risk: string
  is_pwd: string
  pwd_type: string
  has_special_needs: string
  special_needs_diagnosis: string
  family_is_4ps: string
  family_solo_parent: string
  family_indigenous: string
  family_informal_settler: string
  date_of_admission: string
  age_upon_admission: string
  referral_source: string
  referring_agency_person: string
  assigned_social_worker: string
  reintegration_status: string
  reintegration_type: string
  initial_risk_level: string
  current_risk_level: string
  notes_restricted: string
}

function emptyFilters() {
  return {
    internalCode: '',
    safehouseIds: new Set<number>(),
    caseStatuses: new Set<string>(),
    caseCategories: new Set<string>(),
    admissionFrom: '',
    admissionTo: '',
    reintegrations: new Set<string>(),
    riskLevels: new Set<string>(),
    socialWorkers: new Set<string>(),
  }
}

function blankResidentForm(defaultSafehouseId?: number): ResidentFormState {
  return {
    safehouse_id: defaultSafehouseId ? String(defaultSafehouseId) : '',
    case_status: 'Active',
    case_category: 'Surrendered',
    sex: 'F',
    date_of_birth: '',
    place_of_birth: '',
    religion: '',
    sub_cat_trafficked: '',
    sub_cat_physical_abuse: '',
    sub_cat_at_risk: '',
    is_pwd: '',
    pwd_type: '',
    has_special_needs: '',
    special_needs_diagnosis: '',
    family_is_4ps: '',
    family_solo_parent: '',
    family_indigenous: '',
    family_informal_settler: '',
    date_of_admission: new Date().toISOString().slice(0, 10),
    age_upon_admission: '',
    referral_source: '',
    referring_agency_person: '',
    assigned_social_worker: '',
    reintegration_status: '',
    reintegration_type: '',
    initial_risk_level: '',
    current_risk_level: '',
    notes_restricted: '',
  }
}

function formFromResidentDetail(detail: ResidentDetail, defaultSafehouseId?: number): ResidentFormState {
  const fields = detail.fields
  const fallback = blankResidentForm(defaultSafehouseId)
  return {
    ...fallback,
    safehouse_id: fields.safehouse_id ?? fallback.safehouse_id,
    case_status: fields.case_status ?? fallback.case_status,
    case_category: fields.case_category ?? fallback.case_category,
    sex: fields.sex ?? fallback.sex,
    date_of_birth: fields.date_of_birth ?? '',
    place_of_birth: fields.place_of_birth ?? '',
    religion: fields.religion ?? '',
    sub_cat_trafficked: fields.sub_cat_trafficked ?? '',
    sub_cat_physical_abuse: fields.sub_cat_physical_abuse ?? '',
    sub_cat_at_risk: fields.sub_cat_at_risk ?? '',
    is_pwd: fields.is_pwd ?? '',
    pwd_type: fields.pwd_type ?? '',
    has_special_needs: fields.has_special_needs ?? '',
    special_needs_diagnosis: fields.special_needs_diagnosis ?? '',
    family_is_4ps: fields.family_is_4ps ?? '',
    family_solo_parent: fields.family_solo_parent ?? '',
    family_indigenous: fields.family_indigenous ?? '',
    family_informal_settler: fields.family_informal_settler ?? '',
    date_of_admission: fields.date_of_admission ?? fallback.date_of_admission,
    age_upon_admission: fields.age_upon_admission ?? '',
    referral_source: fields.referral_source ?? '',
    referring_agency_person: fields.referring_agency_person ?? '',
    assigned_social_worker: fields.assigned_social_worker ?? '',
    reintegration_status: fields.reintegration_status ?? '',
    reintegration_type: fields.reintegration_type ?? '',
    initial_risk_level: fields.initial_risk_level ?? '',
    current_risk_level: fields.current_risk_level ?? '',
    notes_restricted: fields.notes_restricted ?? '',
  }
}

function patchFromResidentForm(form: ResidentFormState) {
  return {
    safehouse_id: form.safehouse_id,
    case_status: form.case_status,
    case_category: form.case_category,
    sex: form.sex,
    date_of_birth: form.date_of_birth,
    place_of_birth: form.place_of_birth,
    religion: form.religion,
    sub_cat_trafficked: form.sub_cat_trafficked,
    sub_cat_physical_abuse: form.sub_cat_physical_abuse,
    sub_cat_at_risk: form.sub_cat_at_risk,
    is_pwd: form.is_pwd,
    pwd_type: form.pwd_type,
    has_special_needs: form.has_special_needs,
    special_needs_diagnosis: form.special_needs_diagnosis,
    family_is_4ps: form.family_is_4ps,
    family_solo_parent: form.family_solo_parent,
    family_indigenous: form.family_indigenous,
    family_informal_settler: form.family_informal_settler,
    date_of_admission: form.date_of_admission,
    age_upon_admission: form.age_upon_admission,
    referral_source: form.referral_source,
    referring_agency_person: form.referring_agency_person,
    assigned_social_worker: form.assigned_social_worker,
    reintegration_status: form.reintegration_status,
    reintegration_type: form.reintegration_type,
    initial_risk_level: form.initial_risk_level,
    current_risk_level: form.current_risk_level,
    notes_restricted: form.notes_restricted,
  }
}

function YesNoSelect({
  labelText,
  value,
  onChange,
}: {
  labelText: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className={label}>
      {labelText}
      <select className={input} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    </label>
  )
}

function ResidentProfileForm({
  form,
  onChange,
  safehouses,
  submitLabel,
  saving,
  onCancel,
}: {
  form: ResidentFormState
  onChange: (field: keyof ResidentFormState, value: string) => void
  safehouses: Array<{ id: number; code: string; name: string }>
  submitLabel: string
  saving: boolean
  onCancel: () => void
}) {
  return (
    <div className={`${card} scroll-mt-28 space-y-6`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={sectionFormTitle}>{submitLabel}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Capture demographics, case profile, referral details, and reintegration tracking in one place.
          </p>
        </div>
        <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={onCancel}>
          Close
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="space-y-4 rounded-xl border border-border bg-background/70 p-4">
          <h3 className="text-sm font-semibold text-foreground">Case Profile</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>
              Safehouse
              <select className={input} value={form.safehouse_id} onChange={(e) => onChange('safehouse_id', e.target.value)}>
                {safehouses.map((safehouse) => (
                  <option key={safehouse.id} value={safehouse.id}>
                    {safehouse.name} ({safehouse.code})
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              Case Status
              <select className={input} value={form.case_status} onChange={(e) => onChange('case_status', e.target.value)}>
                {caseStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              Case Category
              <select className={input} value={form.case_category} onChange={(e) => onChange('case_category', e.target.value)}>
                {caseCategoryOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              Sex
              <select className={input} value={form.sex} onChange={(e) => onChange('sex', e.target.value)}>
                {sexOptions.map((sex) => (
                  <option key={sex} value={sex}>
                    {sex}
                  </option>
                ))}
              </select>
            </label>
            <YesNoSelect labelText="Trafficked" value={form.sub_cat_trafficked} onChange={(value) => onChange('sub_cat_trafficked', value)} />
            <YesNoSelect
              labelText="Physical Abuse"
              value={form.sub_cat_physical_abuse}
              onChange={(value) => onChange('sub_cat_physical_abuse', value)}
            />
            <YesNoSelect labelText="Neglected / At Risk" value={form.sub_cat_at_risk} onChange={(value) => onChange('sub_cat_at_risk', value)} />
            <label className={label}>
              Assigned Social Worker
              <input className={input} value={form.assigned_social_worker} onChange={(e) => onChange('assigned_social_worker', e.target.value)} />
            </label>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-border bg-background/70 p-4">
          <h3 className="text-sm font-semibold text-foreground">Demographics</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>
              Date of Birth
              <input type="date" className={input} value={form.date_of_birth} onChange={(e) => onChange('date_of_birth', e.target.value)} />
            </label>
            <label className={label}>
              Age Upon Admission
              <input className={input} value={form.age_upon_admission} onChange={(e) => onChange('age_upon_admission', e.target.value)} />
            </label>
            <label className={label}>
              Place of Birth
              <input className={input} value={form.place_of_birth} onChange={(e) => onChange('place_of_birth', e.target.value)} />
            </label>
            <label className={label}>
              Religion
              <input className={input} value={form.religion} onChange={(e) => onChange('religion', e.target.value)} />
            </label>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-border bg-background/70 p-4">
          <h3 className="text-sm font-semibold text-foreground">Disability and Support Needs</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <YesNoSelect labelText="Person with Disability" value={form.is_pwd} onChange={(value) => onChange('is_pwd', value)} />
            <label className={label}>
              Disability Type
              <input className={input} value={form.pwd_type} onChange={(e) => onChange('pwd_type', e.target.value)} />
            </label>
            <YesNoSelect
              labelText="Has Special Needs"
              value={form.has_special_needs}
              onChange={(value) => onChange('has_special_needs', value)}
            />
            <label className={`${label} sm:col-span-2`}>
              Special Needs Diagnosis
              <input
                className={input}
                value={form.special_needs_diagnosis}
                onChange={(e) => onChange('special_needs_diagnosis', e.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-border bg-background/70 p-4">
          <h3 className="text-sm font-semibold text-foreground">Family Socio-Demographic Profile</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <YesNoSelect labelText="4Ps Beneficiary" value={form.family_is_4ps} onChange={(value) => onChange('family_is_4ps', value)} />
            <YesNoSelect labelText="Solo Parent" value={form.family_solo_parent} onChange={(value) => onChange('family_solo_parent', value)} />
            <YesNoSelect labelText="Indigenous Group" value={form.family_indigenous} onChange={(value) => onChange('family_indigenous', value)} />
            <YesNoSelect
              labelText="Informal Settler"
              value={form.family_informal_settler}
              onChange={(value) => onChange('family_informal_settler', value)}
            />
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-border bg-background/70 p-4">
          <h3 className="text-sm font-semibold text-foreground">Admission and Referral</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>
              Date of Admission
              <input type="date" className={input} value={form.date_of_admission} onChange={(e) => onChange('date_of_admission', e.target.value)} />
            </label>
            <label className={label}>
              Referral Source
              <input className={input} value={form.referral_source} onChange={(e) => onChange('referral_source', e.target.value)} />
            </label>
            <label className={`${label} sm:col-span-2`}>
              Referring Agency / Person
              <input
                className={input}
                value={form.referring_agency_person}
                onChange={(e) => onChange('referring_agency_person', e.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-border bg-background/70 p-4">
          <h3 className="text-sm font-semibold text-foreground">Reintegration Tracking</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>
              Reintegration Status
              <select className={input} value={form.reintegration_status} onChange={(e) => onChange('reintegration_status', e.target.value)}>
                <option value="">—</option>
                {reintegrationStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              Reintegration Type
              <select className={input} value={form.reintegration_type} onChange={(e) => onChange('reintegration_type', e.target.value)}>
                <option value="">—</option>
                {reintegrationTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              Initial Risk Level
              <select className={input} value={form.initial_risk_level} onChange={(e) => onChange('initial_risk_level', e.target.value)}>
                <option value="">—</option>
                {riskOptions.map((risk) => (
                  <option key={risk} value={risk}>
                    {risk}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              Current Risk Level
              <select className={input} value={form.current_risk_level} onChange={(e) => onChange('current_risk_level', e.target.value)}>
                <option value="">—</option>
                {riskOptions.map((risk) => (
                  <option key={risk} value={risk}>
                    {risk}
                  </option>
                ))}
              </select>
            </label>
            <label className={`${label} sm:col-span-2`}>
              Reintegration Notes
              <textarea className={input} rows={3} value={form.notes_restricted} onChange={(e) => onChange('notes_restricted', e.target.value)} />
            </label>
          </div>
        </section>
      </div>

      <button type="submit" form="resident-profile-form" disabled={saving} className={btnPrimary}>
        {saving ? 'Saving…' : submitLabel}
      </button>
    </div>
  )
}

export function ResidentsPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<ResidentSummary[]>([])
  const [safehouses, setSafehouses] = useState<Awaited<ReturnType<typeof getSafehouses>>>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null)
  const [editingResidentId, setEditingResidentId] = useState<number | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filters, setFilters] = useState(emptyFilters)
  const [shSearch, setShSearch] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [deleteModal, setDeleteModal] = useState<{ ids: number[]; labels: string[] } | null>(null)
  const [saving, setSaving] = useState(false)
  const [loadingResidentForm, setLoadingResidentForm] = useState(false)
  const [residentForm, setResidentForm] = useState<ResidentFormState>(blankResidentForm())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [r, sh] = await Promise.all([getResidents({}), getSafehouses()])
      setRows(r)
      setSafehouses(sh)
      setResidentForm((current) => (current.safehouse_id ? current : blankResidentForm(sh[0]?.id)))
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

  const safehouseOptions = useMemo(
    () => safehouses.map((s) => ({ id: s.id, label: `${s.name} (${s.code})` })),
    [safehouses],
  )

  const safehouseNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const s of safehouses) m.set(s.id, s.name)
    return m
  }, [safehouses])

  const caseStatusOpts = useMemo(() => uniqSortedStrings(rows.map((r) => r.caseStatus)), [rows])
  const caseCategoryOpts = useMemo(() => uniqSortedStrings(rows.map((r) => r.caseCategory)), [rows])
  const reintOpts = useMemo(() => uniqSortedStrings(rows.map((r) => r.reintegrationStatus)), [rows])
  const riskOpts = useMemo(() => uniqSortedStrings(rows.map((r) => r.currentRiskLevel)), [rows])
  const swOpts = useMemo(() => uniqSortedStrings(rows.map((r) => r.assignedSocialWorker)), [rows])

  const filteredSorted = useMemo(() => {
    let list = rows.filter((r) => {
      const hay = `${r.internalCode} ${r.caseCategory} ${r.caseStatus} ${r.safehouseName ?? ''} ${r.assignedSocialWorker ?? ''} ${r.presentAge ?? ''}`.toLowerCase()
      if (q.trim() && !hay.includes(q.trim().toLowerCase())) return false
      if (filters.internalCode.trim() && !r.internalCode.toLowerCase().includes(filters.internalCode.trim().toLowerCase())) {
        return false
      }
      if (!matchesIdMulti(r.safehouseId, filters.safehouseIds)) return false
      if (!matchesStringMulti(r.caseStatus, filters.caseStatuses)) return false
      if (!matchesStringMulti(r.caseCategory, filters.caseCategories)) return false
      if (filters.admissionFrom || filters.admissionTo) {
        if (!inDateRange(r.dateOfAdmission, filters.admissionFrom, filters.admissionTo)) return false
      }
      if (!matchesStringMulti(r.reintegrationStatus ?? '', filters.reintegrations)) return false
      if (!matchesStringMulti(r.currentRiskLevel ?? '', filters.riskLevels)) return false
      if (!matchesStringMulti(r.assignedSocialWorker ?? '', filters.socialWorkers)) return false
      return true
    })
    list = sortRows(list, sortKey, sortDir, (row, key) => {
      switch (key) {
        case 'internalCode':
          return row.internalCode
        case 'safehouseId':
          return row.safehouseId
        case 'caseStatus':
          return row.caseStatus
        case 'caseCategory':
          return row.caseCategory
        case 'dateOfAdmission':
          return row.dateOfAdmission ?? ''
        case 'reintegrationStatus':
          return row.reintegrationStatus ?? ''
        case 'currentRiskLevel':
          return row.currentRiskLevel ?? ''
        case 'assignedSocialWorker':
          return row.assignedSocialWorker ?? ''
        default:
          return ''
      }
    })
    return list
  }, [rows, q, filters, sortKey, sortDir])

  const activeSummary = useMemo(() => {
    const p: string[] = []
    if (filters.internalCode.trim()) p.push('Code')
    if (filters.safehouseIds.size) p.push(`Safehouse: ${filters.safehouseIds.size}`)
    if (filters.caseStatuses.size) p.push(`Status: ${filters.caseStatuses.size}`)
    if (filters.caseCategories.size) p.push(`Category: ${filters.caseCategories.size}`)
    if (filters.admissionFrom || filters.admissionTo) p.push('Admission range')
    if (filters.reintegrations.size) p.push(`Reintegration: ${filters.reintegrations.size}`)
    if (filters.riskLevels.size) p.push(`Risk: ${filters.riskLevels.size}`)
    if (filters.socialWorkers.size) p.push(`Social worker: ${filters.socialWorkers.size}`)
    return p
  }, [filters])

  function onSort(key: string) {
    const next = nextSortState(key, sortKey, sortDir)
    setSortKey(next.key)
    setSortDir(next.dir)
  }

  function setResidentFormField(field: keyof ResidentFormState, value: string) {
    setResidentForm((current) => ({ ...current, [field]: value }))
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
    const labels = filteredSorted.filter((r) => selected.has(r.id)).map((r) => r.internalCode)
    setDeleteModal({ ids: [...selected], labels })
  }

  async function confirmDelete() {
    if (!deleteModal) return
    setSaving(true)
    setError(null)
    try {
      for (const id of deleteModal.ids) {
        await deleteResident(id)
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

  function openAdd() {
    setFormMode('add')
    setEditingResidentId(null)
    setResidentForm(blankResidentForm(safehouses[0]?.id))
    requestAnimationFrame(() => document.getElementById('resident-profile-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  async function openEdit(residentId: number) {
    setLoadingResidentForm(true)
    setFormMode('edit')
    setEditingResidentId(residentId)
    setError(null)
    try {
      const detail = await getResident(residentId)
      setResidentForm(formFromResidentDetail(detail, safehouses[0]?.id))
      requestAnimationFrame(() => document.getElementById('resident-profile-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load resident profile.')
      setFormMode(null)
      setEditingResidentId(null)
    } finally {
      setLoadingResidentForm(false)
    }
  }

  async function saveResidentProfile() {
    setSaving(true)
    setError(null)
    try {
      if (formMode === 'add') {
        const created = await createResident({
          caseStatus: residentForm.case_status,
          caseCategory: residentForm.case_category || undefined,
        })
        await patchResident(created.id, patchFromResidentForm(residentForm))
      } else if (formMode === 'edit' && editingResidentId) {
        await patchResident(editingResidentId, patchFromResidentForm(residentForm))
      }
      setFormMode(null)
      setEditingResidentId(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const colCount = 10

  return (
    <div className="space-y-6">
      <div>
        <h2 className={pageTitle}>Residents</h2>
        <p className={pageDesc}>
          Manage resident profiles, case classifications, admission details, assigned staff, and reintegration tracking from one working list.
        </p>
      </div>

      {error && <div className={alertError}>{error}</div>}

      <AdminListToolbar
        searchValue={q}
        onSearchChange={setQ}
        searchPlaceholder="Search resident code, case category, worker, or safehouse…"
        filterOpen={filterOpen}
        onFilterToggle={() => setFilterOpen((o) => !o)}
        onAddClick={openAdd}
        addLabel="Add resident"
      />

      <AdminBulkActionsBar
        count={selected.size}
        recordLabel="resident"
        onDeleteClick={openDeleteModal}
        onClearSelection={() => setSelected(new Set())}
        disabled={saving}
      />

      {filterOpen && (
        <FilterPanelCard onClearAll={() => setFilters(emptyFilters())} activeSummary={activeSummary}>
          <TextSearchFilter
            labelText="Internal Code"
            value={filters.internalCode}
            onChange={(v) => setFilters((f) => ({ ...f, internalCode: v }))}
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
            labelText="Case Status"
            options={caseStatusOpts.length ? caseStatusOpts : [...caseStatuses]}
            selected={filters.caseStatuses}
            onChange={(s) => setFilters((f) => ({ ...f, caseStatuses: s }))}
          />
          <MultiSelectFilter
            labelText="Case Category"
            options={caseCategoryOpts.length ? caseCategoryOpts : [...caseCategoryOptions]}
            selected={filters.caseCategories}
            onChange={(s) => setFilters((f) => ({ ...f, caseCategories: s }))}
          />
          <DateRangeFilter
            labelText="Date of Admission"
            from={filters.admissionFrom}
            to={filters.admissionTo}
            onFrom={(v) => setFilters((f) => ({ ...f, admissionFrom: v }))}
            onTo={(v) => setFilters((f) => ({ ...f, admissionTo: v }))}
          />
          <MultiSelectFilter
            labelText="Reintegration Status"
            options={reintOpts.length ? reintOpts : [...reintegrationStatuses]}
            selected={filters.reintegrations}
            onChange={(s) => setFilters((f) => ({ ...f, reintegrations: s }))}
          />
          <MultiSelectFilter
            labelText="Current Risk Level"
            options={riskOpts.length ? riskOpts : [...riskOptions]}
            selected={filters.riskLevels}
            onChange={(s) => setFilters((f) => ({ ...f, riskLevels: s }))}
          />
          <MultiSelectFilter
            labelText="Assigned Social Worker"
            options={swOpts.length ? swOpts : ['SW-01']}
            selected={filters.socialWorkers}
            onChange={(s) => setFilters((f) => ({ ...f, socialWorkers: s }))}
          />
        </FilterPanelCard>
      )}

      {formMode && (
        <form
          id="resident-profile-form"
          onSubmit={(e) => {
            e.preventDefault()
            void saveResidentProfile()
          }}
        >
          {loadingResidentForm ? (
            <div className={card}>Loading resident profile…</div>
          ) : (
            <ResidentProfileForm
              form={residentForm}
              onChange={setResidentFormField}
              safehouses={safehouses}
              submitLabel={formMode === 'add' ? 'Save Resident' : 'Save Changes'}
              saving={saving}
              onCancel={() => {
                setFormMode(null)
                setEditingResidentId(null)
              }}
            />
          )}
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
              <SortableTh label="Internal Code" sortKey="internalCode" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Safehouse" sortKey="safehouseId" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Case Status" sortKey="caseStatus" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Case Category" sortKey="caseCategory" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Admission" sortKey="dateOfAdmission" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Reintegration" sortKey="reintegrationStatus" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Current Risk Level" sortKey="currentRiskLevel" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Social Worker" sortKey="assignedSocialWorker" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <th className="px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Edit</th>
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
                  No rows match filters.
                </td>
              </tr>
            ) : (
              filteredSorted.map((r) => (
                <tr key={r.id} className={`${tableRowHover} cursor-pointer`} onClick={() => navigate(`/admin/residents/${r.id}`)}>
                  <td className="pl-3 pr-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} aria-label={`Select ${r.internalCode}`} />
                  </td>
                  <td className="px-3 py-2.5 font-medium text-foreground">{r.internalCode}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.safehouseName ?? safehouseNameById.get(r.safehouseId) ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={r.caseStatus} />
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.caseCategory}</td>
                  <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{formatAdminDate(r.dateOfAdmission)}</td>
                  <td className="px-3 py-2.5">
                    {r.reintegrationStatus ? <ReintegrationBadge value={r.reintegrationStatus} /> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    {r.currentRiskLevel ? <RiskBadge level={r.currentRiskLevel} /> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.assignedSocialWorker ?? '—'}</td>
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => void openEdit(r.id)}>
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
        title={deleteModal && deleteModal.ids.length === 1 ? 'Delete resident?' : 'Delete residents?'}
        body={
          deleteModal
            ? deleteModal.ids.length === 1
              ? `You are about to delete resident “${deleteModal.labels[0] ?? deleteModal.ids[0]}”. Related records may block this.`
              : `You are about to delete ${deleteModal.ids.length} resident records. Related data may block some deletes.`
            : ''
        }
        previewLines={deleteModal && deleteModal.ids.length > 1 ? deleteModal.labels : undefined}
        loading={saving}
        onCancel={() => setDeleteModal(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  )
}
