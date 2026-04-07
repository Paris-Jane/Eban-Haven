import { getSupabase } from '../lib/supabase'
import type * as T from './adminTypes'

type Row = Record<string, string>

type LighthouseTable =
  | 'lighthouse_residents'
  | 'lighthouse_supporters'
  | 'lighthouse_donations'
  | 'lighthouse_donation_allocations'
  | 'lighthouse_safehouses'
  | 'lighthouse_process_recordings'
  | 'lighthouse_home_visitations'
  | 'lighthouse_intervention_plans'
  | 'lighthouse_education_records'
  | 'lighthouse_health_wellbeing_records'
  | 'lighthouse_safehouse_monthly_metrics'
  | 'lighthouse_incident_reports'

function gs(r: Row, k: string): string {
  return r[k] ?? ''
}

function gi(r: Row, k: string, fb = 0): number {
  const s = gs(r, k).trim()
  const n = parseInt(s, 10)
  return Number.isFinite(n) ? n : fb
}

function gb(r: Row, k: string): boolean {
  return gs(r, k).toLowerCase() === 'true'
}

function parseDateTime(s: string | undefined | null): Date | null {
  if (s == null || !String(s).trim()) return null
  const t = String(s).trim()
  const u = Date.parse(t)
  if (!Number.isNaN(u)) return new Date(u)
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t)
  if (d) return new Date(Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3])))
  return null
}

function nullIfEmpty(s: string): string | null {
  return s.trim() ? s : null
}

function mergeRow(pk: string, id: number, data: unknown): Row {
  const o = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
  const r: Row = {}
  for (const [k, v] of Object.entries(o)) {
    r[k] = v == null ? '' : String(v)
  }
  r[pk] = String(id)
  return r
}

function isoUtc(d: Date): string {
  return d.toISOString()
}

async function loadTable(table: LighthouseTable, pkName: string): Promise<Row[]> {
  const sel = `data,${pkName}` as 'data,resident_id'
  const { data, error } = await getSupabase().from(table).select(sel)
  if (error) throw error
  const rows = (data ?? []) as Record<string, unknown>[]
  return rows.map((row) => {
    const id = row[pkName]
    const n = typeof id === 'number' ? id : parseInt(String(id), 10)
    return mergeRow(pkName, Number.isFinite(n) ? n : 0, row.data)
  })
}

async function nextPk(table: LighthouseTable, col: string): Promise<number> {
  const { data, error } = await getSupabase()
    .from(table)
    .select(col as 'resident_id')
    .order(col as 'resident_id', { ascending: false })
    .limit(1)
  if (error) throw error
  const row = data?.[0] as Record<string, unknown> | undefined
  const v = row?.[col]
  return typeof v === 'number' ? v + 1 : 1
}

function safehouseName(safehouses: Row[], id: number): string | null {
  const sh = safehouses.find((x) => gi(x, 'safehouse_id') === id)
  return sh ? nullIfEmpty(gs(sh, 'name')) : null
}

function residentCode(residents: Row[], residentId: number): string {
  const r = residents.find((x) => gi(x, 'resident_id') === residentId)
  return r ? gs(r, 'internal_code') : `R-${residentId}`
}

function supporterName(supporters: Row[], supporterId: number): string {
  const s = supporters.find((x) => gi(x, 'supporter_id') === supporterId)
  if (!s) return `Supporter #${supporterId}`
  const d = gs(s, 'display_name')
  if (d.trim()) return d
  return `${gs(s, 'first_name')} ${gs(s, 'last_name')}`.trim()
}

function countPillarKeywords(processRecordings: Row[]): T.ReportsSummary['annualAccomplishmentStyle']['servicesProvided'] {
  let caring = 0
  let healing = 0
  let teaching = 0
  for (const p of processRecordings) {
    const iv = gs(p, 'interventions_applied')
    if (iv.toLowerCase().includes('caring')) caring++
    if (iv.toLowerCase().includes('healing')) healing++
    if (iv.toLowerCase().includes('teaching')) teaching++
  }
  return { caringSessions: caring, healingSessions: healing, teachingSessions: teaching }
}

export async function getDashboard(): Promise<T.DashboardSummary> {
  const [residents, safehouses, donations, supporters, interventionPlans, processRecordings, homeVisitations] =
    await Promise.all([
      loadTable('lighthouse_residents', 'resident_id'),
      loadTable('lighthouse_safehouses', 'safehouse_id'),
      loadTable('lighthouse_donations', 'donation_id'),
      loadTable('lighthouse_supporters', 'supporter_id'),
      loadTable('lighthouse_intervention_plans', 'plan_id'),
      loadTable('lighthouse_process_recordings', 'recording_id'),
      loadTable('lighthouse_home_visitations', 'visitation_id'),
    ])

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const activeResidents = residents.filter((r) => gs(r, 'case_status').toLowerCase() === 'active').length

  const safehouseRows: T.SafehouseOccupancy[] = safehouses
    .filter((s) => gs(s, 'status').toLowerCase() === 'active')
    .map((s) => ({
      id: gi(s, 'safehouse_id'),
      code: gs(s, 'safehouse_code'),
      name: gs(s, 'name'),
      region: gs(s, 'region'),
      occupancy: gi(s, 'current_occupancy'),
      capacity: gi(s, 'capacity_girls'),
    }))
    .sort((a, b) => a.id - b.id)

  const recentDonations: T.RecentDonationRow[] = donations
    .map((d) => ({
      row: d,
      dt: parseDateTime(gs(d, 'donation_date')) ?? new Date(0),
    }))
    .sort((a, b) => b.dt.getTime() - a.dt.getTime())
    .slice(0, 8)
    .map((x) => {
      const d = x.row
      const amt = parseFloat(gs(d, 'amount'))
      return {
        donationId: gi(d, 'donation_id'),
        supporterDisplayName: supporterName(supporters, gi(d, 'supporter_id')),
        donationType: gs(d, 'donation_type'),
        amount: Number.isFinite(amt) ? amt : null,
        currencyCode: nullIfEmpty(gs(d, 'currency_code')),
        donationDate: isoUtc(x.dt),
        campaignName: nullIfEmpty(gs(d, 'campaign_name')),
      }
    })

  const upcomingConferences: T.UpcomingConference[] = interventionPlans
    .map((p) => ({ row: p, dt: parseDateTime(gs(p, 'case_conference_date')) }))
    .filter((x) => x.dt != null && x.dt >= today)
    .sort((a, b) => (a.dt!.getTime() - b.dt!.getTime()))
    .slice(0, 12)
    .map((x) => ({
      planId: gi(x.row, 'plan_id'),
      residentId: gi(x.row, 'resident_id'),
      residentInternalCode: residentCode(residents, gi(x.row, 'resident_id')),
      planCategory: gs(x.row, 'plan_category'),
      caseConferenceDate: x.dt ? isoUtc(x.dt) : null,
      status: gs(x.row, 'status'),
      planDescription: nullIfEmpty(gs(x.row, 'plan_description')),
    }))

  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30)
  let monetary30 = 0
  for (const d of donations) {
    if (gs(d, 'donation_type').toLowerCase() !== 'monetary') continue
    const dt = parseDateTime(gs(d, 'donation_date'))
    if (!dt || dt < thirtyDaysAgo) continue
    const a = parseFloat(gs(d, 'amount'))
    if (Number.isFinite(a)) monetary30 += a
  }

  let visit90 = 0
  const d90 = new Date(today)
  d90.setUTCDate(d90.getUTCDate() - 90)
  for (const v of homeVisitations) {
    const dt = parseDateTime(gs(v, 'visit_date'))
    if (dt && dt >= d90) visit90++
  }

  const completed = residents.filter(
    (r) => gs(r, 'reintegration_status').toLowerCase() === 'completed',
  ).length
  const inProg = residents.filter(
    (r) => gs(r, 'reintegration_status').toLowerCase() === 'in progress',
  ).length
  const denom = Math.max(
    residents.filter((r) => gs(r, 'reintegration_status').trim()).length,
    1,
  )
  const rate = Math.round((100 * completed) / denom * 10) / 10

  return {
    activeResidentsTotal: activeResidents,
    safehouses: safehouseRows,
    recentDonations,
    upcomingCaseConferences: upcomingConferences,
    monetaryDonationsLast30DaysPhp: monetary30,
    processRecordingsCount: processRecordings.length,
    homeVisitationsLast90Days: visit90,
    reintegration: { completedCount: completed, inProgressCount: inProg, successRatePercent: rate },
  }
}

export async function getSafehouses(): Promise<T.SafehouseOption[]> {
  const safehouses = await loadTable('lighthouse_safehouses', 'safehouse_id')
  return safehouses
    .filter((s) => gs(s, 'status').toLowerCase() === 'active')
    .map((s) => ({
      id: gi(s, 'safehouse_id'),
      code: gs(s, 'safehouse_code'),
      name: gs(s, 'name'),
      region: gs(s, 'region'),
    }))
    .sort((a, b) => a.id - b.id)
}

export async function getSupporters(): Promise<T.Supporter[]> {
  const supporters = await loadTable('lighthouse_supporters', 'supporter_id')
  return supporters
    .sort((a, b) => gi(a, 'supporter_id') - gi(b, 'supporter_id'))
    .map((s) => ({
      id: gi(s, 'supporter_id'),
      supporterType: gs(s, 'supporter_type'),
      displayName: gs(s, 'display_name'),
      organizationName: nullIfEmpty(gs(s, 'organization_name')),
      firstName: nullIfEmpty(gs(s, 'first_name')),
      lastName: nullIfEmpty(gs(s, 'last_name')),
      region: nullIfEmpty(gs(s, 'region')),
      country: nullIfEmpty(gs(s, 'country')),
      email: nullIfEmpty(gs(s, 'email')),
      phone: nullIfEmpty(gs(s, 'phone')),
      status: gs(s, 'status'),
      firstDonationDate: nullIfEmpty(gs(s, 'first_donation_date')),
      acquisitionChannel: nullIfEmpty(gs(s, 'acquisition_channel')),
    }))
}

export async function createSupporter(body: T.CreateSupporterBody): Promise<T.Supporter> {
  const next = await nextPk('lighthouse_supporters', 'supporter_id')
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const row: Row = {
    supporter_id: String(next),
    supporter_type: body.supporterType,
    display_name: body.displayName,
    organization_name: body.organizationName ?? '',
    first_name: body.firstName ?? '',
    last_name: body.lastName ?? '',
    relationship_type: body.relationshipType?.trim() || 'Local',
    region: body.region ?? '',
    country: body.country?.trim() || 'Ghana',
    email: body.email ?? '',
    phone: body.phone ?? '',
    status: body.status ?? 'Active',
    created_at: now,
    first_donation_date: '',
    acquisition_channel: body.acquisitionChannel?.trim() || 'Website',
  }
  const { error } = await getSupabase().from('lighthouse_supporters').insert({
    supporter_id: next,
    data: Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v])),
  })
  if (error) throw error
  return (await getSupporters()).find((x) => x.id === next)!
}

export async function patchSupporter(
  id: number,
  body: { status?: string; supporterType?: string },
): Promise<T.Supporter> {
  const patch: Record<string, string | null> = {}
  if (body.status != null) patch.status = body.status
  if (body.supporterType != null) patch.supporter_type = body.supporterType
  return patchSupporterFields(id, patch)
}

/** Merge snake_case CSV field keys into supporter `data` jsonb. */
export async function patchSupporterFields(
  id: number,
  fields: Record<string, string | null | undefined>,
): Promise<T.Supporter> {
  const { data: row, error: fe } = await getSupabase()
    .from('lighthouse_supporters')
    .select('data')
    .eq('supporter_id', id)
    .maybeSingle()
  if (fe) throw fe
  if (!row?.data) throw new Error('Supporter not found')
  const r = mergeRow('supporter_id', id, row.data)
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue
    if (v === null) continue
    r[k] = v
  }
  const { error } = await getSupabase()
    .from('lighthouse_supporters')
    .update({ data: r })
    .eq('supporter_id', id)
  if (error) throw error
  return (await getSupporters()).find((x) => x.id === id)!
}

export async function deleteSupporter(id: number): Promise<void> {
  const { error } = await getSupabase().from('lighthouse_supporters').delete().eq('supporter_id', id)
  if (error) throw error
}

export async function getDonations(supporterId?: number): Promise<T.Donation[]> {
  const [donations, supporters] = await Promise.all([
    loadTable('lighthouse_donations', 'donation_id'),
    loadTable('lighthouse_supporters', 'supporter_id'),
  ])
  let q = donations
  if (supporterId != null && supporterId > 0) q = q.filter((d) => gi(d, 'supporter_id') === supporterId)
  return q
    .map((d) => {
      const dt = parseDateTime(gs(d, 'donation_date')) ?? new Date(0)
      const a = parseFloat(gs(d, 'amount'))
      const ev = parseFloat(gs(d, 'estimated_value'))
      return {
        id: gi(d, 'donation_id'),
        supporterId: gi(d, 'supporter_id'),
        supporterDisplayName: supporterName(supporters, gi(d, 'supporter_id')),
        donationType: gs(d, 'donation_type'),
        donationDate: isoUtc(dt),
        isRecurring: gb(d, 'is_recurring'),
        campaignName: nullIfEmpty(gs(d, 'campaign_name')),
        channelSource: nullIfEmpty(gs(d, 'channel_source')),
        currencyCode: nullIfEmpty(gs(d, 'currency_code')),
        amount: Number.isFinite(a) ? a : null,
        estimatedValue: Number.isFinite(ev) ? ev : null,
        impactUnit: nullIfEmpty(gs(d, 'impact_unit')),
        notes: nullIfEmpty(gs(d, 'notes')),
      }
    })
    .sort((a, b) => new Date(b.donationDate).getTime() - new Date(a.donationDate).getTime())
}

export async function createDonation(body: {
  supporterId: number
  donationType: string
  donationDate?: string
  amount?: number
  currencyCode?: string
  notes?: string
  campaignName?: string
}): Promise<T.Donation> {
  const supporters = await loadTable('lighthouse_supporters', 'supporter_id')
  if (!supporters.some((x) => gi(x, 'supporter_id') === body.supporterId)) {
    throw new Error('Unknown supporter.')
  }
  const next = await nextPk('lighthouse_donations', 'donation_id')
  const dt = body.donationDate
    ? parseDateTime(body.donationDate) ?? new Date()
    : new Date()
  const dStr = dt.toISOString().slice(0, 10)
  const isMonetary = body.donationType.toLowerCase() === 'monetary'
  const row: Row = {
    donation_id: String(next),
    supporter_id: String(body.supporterId),
    donation_type: body.donationType,
    donation_date: dStr,
    is_recurring: 'False',
    campaign_name: body.campaignName ?? '',
    channel_source: 'Direct',
    currency_code: body.currencyCode ?? (isMonetary ? 'PHP' : ''),
    amount: body.amount != null ? String(body.amount) : '',
    estimated_value: body.amount != null ? String(body.amount) : '',
    impact_unit: (() => {
      const t = body.donationType.toLowerCase().replace(/[\s_-]/g, '')
      if (t.includes('time')) return 'hours'
      if (t.includes('inkind')) return 'items'
      if (t.includes('socialmedia')) return 'campaigns'
      return 'pesos'
    })(),
    notes: body.notes ?? '',
    referral_post_id: '',
  }
  const { error } = await getSupabase().from('lighthouse_donations').insert({
    donation_id: next,
    data: Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v])),
  })
  if (error) throw error
  return (await getDonations()).find((x) => x.id === next)!
}

export async function getAllocations(params?: {
  donationId?: number
  safehouseId?: number
}): Promise<T.DonationAllocation[]> {
  const [allocations, safehouses] = await Promise.all([
    loadTable('lighthouse_donation_allocations', 'allocation_id'),
    loadTable('lighthouse_safehouses', 'safehouse_id'),
  ])
  let q = allocations
  if (params?.donationId != null && params.donationId > 0) {
    q = q.filter((a) => gi(a, 'donation_id') === params.donationId)
  }
  if (params?.safehouseId != null && params.safehouseId > 0) {
    q = q.filter((a) => gi(a, 'safehouse_id') === params.safehouseId)
  }
  return q
    .map((a) => {
      const dt = parseDateTime(gs(a, 'allocation_date')) ?? new Date(0)
      const al = parseFloat(gs(a, 'amount_allocated'))
      return {
        id: gi(a, 'allocation_id'),
        donationId: gi(a, 'donation_id'),
        safehouseId: gi(a, 'safehouse_id'),
        safehouseName: safehouseName(safehouses, gi(a, 'safehouse_id')),
        programArea: gs(a, 'program_area'),
        amountAllocated: Number.isFinite(al) ? al : 0,
        allocationDate: isoUtc(dt),
        notes: nullIfEmpty(gs(a, 'allocation_notes')),
      }
    })
    .sort((a, b) => new Date(b.allocationDate).getTime() - new Date(a.allocationDate).getTime())
}

export async function getResidents(params: {
  status?: string
  safehouseId?: number
  category?: string
  q?: string
}): Promise<T.ResidentSummary[]> {
  const [residents, safehouses] = await Promise.all([
    loadTable('lighthouse_residents', 'resident_id'),
    loadTable('lighthouse_safehouses', 'safehouse_id'),
  ])
  let q = residents
  if (params.status?.trim()) {
    const st = params.status.trim().toLowerCase()
    q = q.filter((r) => gs(r, 'case_status').toLowerCase() === st)
  }
  if (params.safehouseId != null && params.safehouseId > 0) {
    q = q.filter((r) => gi(r, 'safehouse_id') === params.safehouseId)
  }
  if (params.category?.trim()) {
    const c = params.category.trim().toLowerCase()
    q = q.filter((r) => gs(r, 'case_category').toLowerCase().includes(c))
  }
  if (params.q?.trim()) {
    const s = params.q.trim().toLowerCase()
    q = q.filter(
      (r) =>
        gs(r, 'internal_code').toLowerCase().includes(s) ||
        gs(r, 'case_control_no').toLowerCase().includes(s) ||
        gs(r, 'assigned_social_worker').toLowerCase().includes(s),
    )
  }
  return q.map((r) => ({
    id: gi(r, 'resident_id'),
    caseControlNo: gs(r, 'case_control_no'),
    internalCode: gs(r, 'internal_code'),
    safehouseId: gi(r, 'safehouse_id'),
    safehouseName: safehouseName(safehouses, gi(r, 'safehouse_id')),
    caseStatus: gs(r, 'case_status'),
    caseCategory: gs(r, 'case_category'),
    sex: gs(r, 'sex'),
    assignedSocialWorker: nullIfEmpty(gs(r, 'assigned_social_worker')),
    dateOfAdmission: nullIfEmpty(gs(r, 'date_of_admission')),
    reintegrationStatus: nullIfEmpty(gs(r, 'reintegration_status')),
    reintegrationType: nullIfEmpty(gs(r, 'reintegration_type')),
  }))
}

export async function getResident(id: number): Promise<T.ResidentDetail> {
  const { data, error } = await getSupabase()
    .from('lighthouse_residents')
    .select('data')
    .eq('resident_id', id)
    .maybeSingle()
  if (error) throw error
  if (!data?.data) throw new Error('Not found')
  const r = mergeRow('resident_id', id, data.data)
  return { id, fields: { ...r } }
}

export async function patchResident(
  id: number,
  fields: Record<string, string | null>,
): Promise<T.ResidentDetail> {
  const { data, error } = await getSupabase()
    .from('lighthouse_residents')
    .select('data')
    .eq('resident_id', id)
    .maybeSingle()
  if (error) throw error
  if (!data?.data) throw new Error('Not found')
  const r = mergeRow('resident_id', id, data.data)
  for (const [k, v] of Object.entries(fields)) {
    if (v != null) r[k] = v
  }
  const { error: ue } = await getSupabase()
    .from('lighthouse_residents')
    .update({ data: r })
    .eq('resident_id', id)
  if (ue) throw ue
  return getResident(id)
}

export async function createResident(body: {
  internalCode: string
  caseStatus: string
  caseCategory?: string
}): Promise<T.ResidentSummary> {
  const residents = await loadTable('lighthouse_residents', 'resident_id')
  const template = residents[0]
  if (!template) throw new Error('No resident template in database; import CSV first.')
  const next = residents.length === 0 ? 1 : Math.max(...residents.map((x) => gi(x, 'resident_id'))) + 1
  const r: Row = {}
  for (const k of Object.keys(template)) r[k] = ''
  r.resident_id = String(next)
  r.case_control_no = `C${String(next).padStart(4, '0')}`
  r.internal_code = body.internalCode
  r.safehouse_id = '1'
  r.case_status = body.caseStatus
  r.case_category = body.caseCategory?.trim() || 'Surrendered'
  r.sex = 'F'
  r.date_of_birth = '2010-01-01'
  r.birth_status = 'Marital'
  r.place_of_birth = 'Manila'
  r.religion = 'Unspecified'
  r.date_of_admission = new Date().toISOString().slice(0, 10)
  r.assigned_social_worker = 'SW-01'
  r.created_at = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const { error } = await getSupabase().from('lighthouse_residents').insert({
    resident_id: next,
    data: r,
  })
  if (error) throw error
  return (await getResidents({})).find((x) => x.id === next)!
}

export async function getCases(): Promise<T.Case[]> {
  const rows = await getResidents({})
  return rows.map((r) => ({
    id: String(r.id),
    referenceCode: r.internalCode,
    status: r.caseStatus,
    opened: r.dateOfAdmission ?? '',
    summary: null,
  }))
}

export async function updateCaseStatus(caseId: string, status: string): Promise<T.Case> {
  const id = parseInt(caseId, 10)
  if (!Number.isFinite(id)) throw new Error('Invalid case id')
  await patchResident(id, { case_status: status })
  const rows = await getResidents({})
  const r = rows.find((x) => x.id === id)
  if (!r) throw new Error('Not found')
  return {
    id: String(r.id),
    referenceCode: r.internalCode,
    status: r.caseStatus,
    opened: r.dateOfAdmission ?? '',
    summary: null,
  }
}

export async function getProcessRecordings(residentId?: number): Promise<T.ProcessRecording[]> {
  const [recordings, residents] = await Promise.all([
    loadTable('lighthouse_process_recordings', 'recording_id'),
    loadTable('lighthouse_residents', 'resident_id'),
  ])
  let q = recordings
  if (residentId != null && residentId > 0) q = q.filter((p) => gi(p, 'resident_id') === residentId)
  const list = q
    .map((p) => {
      const dt = parseDateTime(gs(p, 'session_date')) ?? new Date(0)
      const dm = parseInt(gs(p, 'session_duration_minutes'), 10)
      return {
        id: gi(p, 'recording_id'),
        residentId: gi(p, 'resident_id'),
        residentInternalCode: residentCode(residents, gi(p, 'resident_id')),
        sessionDate: isoUtc(dt),
        socialWorker: gs(p, 'social_worker'),
        sessionType: gs(p, 'session_type'),
        sessionDurationMinutes: Number.isFinite(dm) ? dm : null,
        emotionalStateObserved: nullIfEmpty(gs(p, 'emotional_state_observed')),
        emotionalStateEnd: nullIfEmpty(gs(p, 'emotional_state_end')),
        sessionNarrative: gs(p, 'session_narrative'),
        interventionsApplied: nullIfEmpty(gs(p, 'interventions_applied')),
        followUpActions: nullIfEmpty(gs(p, 'follow_up_actions')),
        progressNoted: gb(p, 'progress_noted'),
        concernsFlagged: gb(p, 'concerns_flagged'),
        referralMade: gb(p, 'referral_made'),
      }
    })
    .sort((a, b) => new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime())
  if (residentId == null && list.length > 120) return list.slice(-120)
  return list
}

export async function createProcessRecording(body: {
  residentId: number
  sessionDate?: string
  socialWorker: string
  sessionType: string
  sessionDurationMinutes?: number
  emotionalStateObserved?: string
  emotionalStateEnd?: string
  sessionNarrative: string
  interventionsApplied?: string
  followUpActions?: string
}): Promise<T.ProcessRecording> {
  const residents = await loadTable('lighthouse_residents', 'resident_id')
  if (!residents.some((x) => gi(x, 'resident_id') === body.residentId)) {
    throw new Error('Unknown resident.')
  }
  const next = await nextPk('lighthouse_process_recordings', 'recording_id')
  const sd = body.sessionDate ? parseDateTime(body.sessionDate) ?? new Date() : new Date()
  const row: Row = {
    recording_id: String(next),
    resident_id: String(body.residentId),
    session_date: sd.toISOString().slice(0, 10),
    social_worker: body.socialWorker,
    session_type: body.sessionType,
    session_duration_minutes:
      body.sessionDurationMinutes != null ? String(body.sessionDurationMinutes) : '',
    emotional_state_observed: body.emotionalStateObserved ?? '',
    emotional_state_end: body.emotionalStateEnd ?? '',
    session_narrative: body.sessionNarrative,
    interventions_applied: body.interventionsApplied ?? '',
    follow_up_actions: body.followUpActions ?? '',
    progress_noted: 'True',
    concerns_flagged: 'False',
    referral_made: 'False',
    notes_restricted: '',
  }
  const { error } = await getSupabase().from('lighthouse_process_recordings').insert({
    recording_id: next,
    data: row,
  })
  if (error) throw error
  const list = await getProcessRecordings(body.residentId)
  return list[list.length - 1]!
}

export async function getHomeVisitations(residentId?: number): Promise<T.HomeVisitation[]> {
  const [visits, residents] = await Promise.all([
    loadTable('lighthouse_home_visitations', 'visitation_id'),
    loadTable('lighthouse_residents', 'resident_id'),
  ])
  let q = visits
  if (residentId != null && residentId > 0) q = q.filter((v) => gi(v, 'resident_id') === residentId)
  return q
    .map((v) => {
      const dt = parseDateTime(gs(v, 'visit_date')) ?? new Date(0)
      return {
        id: gi(v, 'visitation_id'),
        residentId: gi(v, 'resident_id'),
        residentInternalCode: residentCode(residents, gi(v, 'resident_id')),
        visitDate: isoUtc(dt),
        socialWorker: gs(v, 'social_worker'),
        visitType: gs(v, 'visit_type'),
        locationVisited: nullIfEmpty(gs(v, 'location_visited')),
        familyMembersPresent: nullIfEmpty(gs(v, 'family_members_present')),
        purpose: nullIfEmpty(gs(v, 'purpose')),
        observations: nullIfEmpty(gs(v, 'observations')),
        familyCooperationLevel: nullIfEmpty(gs(v, 'family_cooperation_level')),
        safetyConcernsNoted: gb(v, 'safety_concerns_noted'),
        followUpNeeded: gb(v, 'follow_up_needed'),
        followUpNotes: nullIfEmpty(gs(v, 'follow_up_notes')),
        visitOutcome: nullIfEmpty(gs(v, 'visit_outcome')),
      }
    })
    .sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())
}

export async function createHomeVisitation(body: {
  residentId: number
  visitDate?: string
  socialWorker: string
  visitType: string
  locationVisited?: string
  observations?: string
  familyCooperationLevel?: string
  safetyConcernsNoted: boolean
  followUpNeeded: boolean
  followUpNotes?: string
}): Promise<T.HomeVisitation> {
  const residents = await loadTable('lighthouse_residents', 'resident_id')
  if (!residents.some((x) => gi(x, 'resident_id') === body.residentId)) {
    throw new Error('Unknown resident.')
  }
  const next = await nextPk('lighthouse_home_visitations', 'visitation_id')
  const vd = body.visitDate ? parseDateTime(body.visitDate) ?? new Date() : new Date()
  const row: Row = {
    visitation_id: String(next),
    resident_id: String(body.residentId),
    visit_date: vd.toISOString().slice(0, 10),
    social_worker: body.socialWorker,
    visit_type: body.visitType,
    location_visited: body.locationVisited ?? '',
    family_members_present: '',
    purpose: `Visitation for ${body.visitType.toLowerCase()}`,
    observations: body.observations ?? '',
    family_cooperation_level: body.familyCooperationLevel ?? '',
    safety_concerns_noted: body.safetyConcernsNoted ? 'True' : 'False',
    follow_up_needed: body.followUpNeeded ? 'True' : 'False',
    follow_up_notes: body.followUpNotes ?? '',
    visit_outcome: 'Favorable',
  }
  const { error } = await getSupabase().from('lighthouse_home_visitations').insert({
    visitation_id: next,
    data: row,
  })
  if (error) throw error
  const list = await getHomeVisitations(body.residentId)
  return list.find((x) => x.id === next)!
}

export async function getInterventionPlans(residentId?: number): Promise<T.InterventionPlan[]> {
  const [plans, residents] = await Promise.all([
    loadTable('lighthouse_intervention_plans', 'plan_id'),
    loadTable('lighthouse_residents', 'resident_id'),
  ])
  let q = plans
  if (residentId != null && residentId > 0) q = q.filter((p) => gi(p, 'resident_id') === residentId)
  return q
    .map((p) => {
      const target = parseDateTime(gs(p, 'target_date'))
      const conf = parseDateTime(gs(p, 'case_conference_date'))
      const created = parseDateTime(gs(p, 'created_at')) ?? new Date(0)
      const updated = parseDateTime(gs(p, 'updated_at')) ?? new Date(0)
      const tv = parseFloat(gs(p, 'target_value'))
      return {
        id: gi(p, 'plan_id'),
        residentId: gi(p, 'resident_id'),
        residentInternalCode: residentCode(residents, gi(p, 'resident_id')),
        planCategory: gs(p, 'plan_category'),
        planDescription: gs(p, 'plan_description'),
        servicesProvided: nullIfEmpty(gs(p, 'services_provided')),
        targetValue: Number.isFinite(tv) ? tv : null,
        targetDate: target ? target.toISOString().slice(0, 10) : null,
        status: gs(p, 'status'),
        caseConferenceDate: conf ? isoUtc(conf) : null,
        createdAt: isoUtc(created),
        updatedAt: isoUtc(updated),
      }
    })
    .sort(
      (a, b) =>
        new Date(b.caseConferenceDate ?? 0).getTime() - new Date(a.caseConferenceDate ?? 0).getTime(),
    )
}

export async function getReportsSummary(): Promise<T.ReportsSummary> {
  const [
    residents,
    donations,
    processRecordings,
    safehouses,
    monthly,
    educationRecords,
    healthRecords,
  ] = await Promise.all([
    loadTable('lighthouse_residents', 'resident_id'),
    loadTable('lighthouse_donations', 'donation_id'),
    loadTable('lighthouse_process_recordings', 'recording_id'),
    loadTable('lighthouse_safehouses', 'safehouse_id'),
    loadTable('lighthouse_safehouse_monthly_metrics', 'metric_id'),
    loadTable('lighthouse_education_records', 'education_record_id'),
    loadTable('lighthouse_health_wellbeing_records', 'health_record_id'),
  ])

  const total = residents.length
  const active = residents.filter((r) => gs(r, 'case_status').toLowerCase() === 'active').length
  const closed = residents.filter((r) => gs(r, 'case_status').toLowerCase() === 'closed').length
  let monetary = 0
  for (const d of donations) {
    if (gs(d, 'donation_type').toLowerCase() !== 'monetary') continue
    const a = parseFloat(gs(d, 'amount'))
    if (Number.isFinite(a)) monetary += a
  }

  const trendMap = new Map<string, { monetaryTotalPhp: number; donationCount: number }>()
  for (const d of donations) {
    if (gs(d, 'donation_type').toLowerCase() !== 'monetary') continue
    const dt = parseDateTime(gs(d, 'donation_date'))
    if (!dt) continue
    const key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`
    const amt = parseFloat(gs(d, 'amount'))
    const cur = trendMap.get(key) ?? { monetaryTotalPhp: 0, donationCount: 0 }
    cur.monetaryTotalPhp += Number.isFinite(amt) ? amt : 0
    cur.donationCount += 1
    trendMap.set(key, cur)
  }
  const donationTrends = [...trendMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month,
      monetaryTotalPhp: v.monetaryTotalPhp,
      donationCount: v.donationCount,
    }))

  const latestBySh = new Map<
    number,
    { edu: number | null; hl: number | null }
  >()
  const bySh = new Map<number, typeof monthly>()
  for (const m of monthly) {
    const sh = gi(m, 'safehouse_id')
    if (!bySh.has(sh)) bySh.set(sh, [])
    bySh.get(sh)!.push(m)
  }
  for (const [sh, rows] of bySh) {
    const sorted = rows
      .map((m) => ({
        m,
        start: parseDateTime(gs(m, 'month_start')),
      }))
      .filter((x) => x.start)
      .sort((a, b) => b.start!.getTime() - a.start!.getTime())
    const top = sorted[0]
    if (!top) continue
    const e = parseFloat(gs(top.m, 'avg_education_progress'))
    const h = parseFloat(gs(top.m, 'avg_health_score'))
    latestBySh.set(sh, {
      edu: Number.isFinite(e) ? e : null,
      hl: Number.isFinite(h) ? h : null,
    })
  }

  const perf: T.SafehousePerformance[] = safehouses
    .filter((s) => gs(s, 'status').toLowerCase() === 'active')
    .map((s) => {
      const id = gi(s, 'safehouse_id')
      const occ = gi(s, 'current_occupancy')
      const cap = Math.max(gi(s, 'capacity_girls'), 1)
      const lm = latestBySh.get(id)
      const activeCt = residents.filter(
        (r) => gi(r, 'safehouse_id') === id && gs(r, 'case_status').toLowerCase() === 'active',
      ).length
      return {
        safehouseId: id,
        name: gs(s, 'name'),
        activeResidents: activeCt,
        capacity: cap,
        occupancyRatePercent: Math.round((100 * occ) / cap * 10) / 10,
        avgEducationProgress: lm?.edu ?? null,
        avgHealthScore: lm?.hl ?? null,
      }
    })
    .sort((a, b) => a.safehouseId - b.safehouseId)

  const eduVals = educationRecords
    .map((e) => parseFloat(gs(e, 'progress_percent')))
    .filter((v) => Number.isFinite(v))
  const eduAvg = eduVals.length === 0 ? 0 : eduVals.reduce((a, b) => a + b, 0) / eduVals.length
  const hlVals = healthRecords
    .map((e) => parseFloat(gs(e, 'general_health_score')))
    .filter((v) => Number.isFinite(v))
  const hlAvg = hlVals.length === 0 ? 0 : hlVals.reduce((a, b) => a + b, 0) / hlVals.length

  const pillars = countPillarKeywords(processRecordings)
  const highlights = [
    `${active} active residents across ${perf.length} safehouses (dataset snapshot).`,
    `Average education progress across records: ${eduAvg.toFixed(1)}%.`,
    `Average general health score: ${hlAvg.toFixed(2)} (scale ~1–5).`,
    `Reintegration completed for ${residents.filter((r) => gs(r, 'reintegration_status').toLowerCase() === 'completed').length} residents.`,
  ]

  return {
    totalResidents: total,
    activeResidents: active,
    closedResidents: closed,
    totalMonetaryDonationsPhp: monetary,
    processRecordingsCount: processRecordings.length,
    donationTrends,
    safehousePerformance: perf,
    outcomeMetrics: {
      avgEducationProgressPercent: Math.round(eduAvg * 100) / 100,
      avgHealthScore: Math.round(hlAvg * 100) / 100,
      educationRecordsCount: educationRecords.length,
      healthRecordsCount: healthRecords.length,
    },
    annualAccomplishmentStyle: {
      beneficiaryResidentsServed: total,
      servicesProvided: pillars,
      programOutcomeHighlights: highlights,
    },
  }
}

async function patchJsonRow(
  table: LighthouseTable,
  pk: string,
  id: number,
  fields: Record<string, string | null | undefined>,
): Promise<void> {
  const { data: row, error: fe } = await getSupabase().from(table).select('data').eq(pk, id).maybeSingle()
  if (fe) throw fe
  if (!row?.data) throw new Error('Record not found')
  const r = mergeRow(pk, id, row.data)
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null) continue
    r[k] = v
  }
  const { error } = await getSupabase().from(table).update({ data: r }).eq(pk, id)
  if (error) throw error
}

export async function patchDonationFields(
  id: number,
  fields: Record<string, string | null | undefined>,
): Promise<T.Donation> {
  await patchJsonRow('lighthouse_donations', 'donation_id', id, fields)
  return (await getDonations()).find((x) => x.id === id)!
}

export async function deleteDonation(id: number): Promise<void> {
  const { error } = await getSupabase().from('lighthouse_donations').delete().eq('donation_id', id)
  if (error) throw error
}

export async function createAllocation(body: {
  donationId: number
  safehouseId: number
  programArea: string
  amountAllocated: number
  allocationDate?: string
  notes?: string
}): Promise<T.DonationAllocation> {
  const next = await nextPk('lighthouse_donation_allocations', 'allocation_id')
  const d = body.allocationDate ?? new Date().toISOString().slice(0, 10)
  const row: Row = {
    allocation_id: String(next),
    donation_id: String(body.donationId),
    safehouse_id: String(body.safehouseId),
    program_area: body.programArea,
    amount_allocated: String(body.amountAllocated),
    allocation_date: d,
    allocation_notes: body.notes ?? '',
  }
  const { error } = await getSupabase().from('lighthouse_donation_allocations').insert({
    allocation_id: next,
    data: row,
  })
  if (error) throw error
  return (await getAllocations({ donationId: body.donationId })).find((x) => x.id === next)!
}

export async function patchAllocationFields(
  id: number,
  fields: Record<string, string | null | undefined>,
): Promise<T.DonationAllocation> {
  await patchJsonRow('lighthouse_donation_allocations', 'allocation_id', id, fields)
  return (await getAllocations()).find((x) => x.id === id)!
}

export async function deleteAllocation(id: number): Promise<void> {
  const { error } = await getSupabase().from('lighthouse_donation_allocations').delete().eq('allocation_id', id)
  if (error) throw error
}

export async function listEducationRecords(residentId?: number): Promise<T.JsonTableRow[]> {
  let rows = await loadTable('lighthouse_education_records', 'education_record_id')
  if (residentId != null && residentId > 0) rows = rows.filter((r) => gi(r, 'resident_id') === residentId)
  return rows
    .sort((a, b) => gs(a, 'record_date').localeCompare(gs(b, 'record_date')))
    .map((r) => ({ id: gi(r, 'education_record_id'), fields: { ...r } }))
}

export async function listHealthRecords(residentId?: number): Promise<T.JsonTableRow[]> {
  let rows = await loadTable('lighthouse_health_wellbeing_records', 'health_record_id')
  if (residentId != null && residentId > 0) rows = rows.filter((r) => gi(r, 'resident_id') === residentId)
  return rows
    .sort((a, b) => gs(a, 'record_date').localeCompare(gs(b, 'record_date')))
    .map((r) => ({ id: gi(r, 'health_record_id'), fields: { ...r } }))
}

export async function listIncidentReports(residentId?: number): Promise<T.JsonTableRow[]> {
  let rows: Row[] = []
  try {
    rows = await loadTable('lighthouse_incident_reports', 'incident_id')
  } catch {
    return []
  }
  if (residentId != null && residentId > 0) rows = rows.filter((r) => gi(r, 'resident_id') === residentId)
  return rows
    .sort((a, b) => gs(b, 'incident_date').localeCompare(gs(a, 'incident_date')))
    .map((r) => ({ id: gi(r, 'incident_id'), fields: { ...r } }))
}

export async function createEducationRecord(residentId: number, fields: Record<string, string>): Promise<void> {
  const next = await nextPk('lighthouse_education_records', 'education_record_id')
  const row: Row = { education_record_id: String(next), resident_id: String(residentId), ...fields }
  const { error } = await getSupabase().from('lighthouse_education_records').insert({
    education_record_id: next,
    data: row,
  })
  if (error) throw error
}

export async function patchEducationRecord(
  id: number,
  fields: Record<string, string | null | undefined>,
): Promise<void> {
  await patchJsonRow('lighthouse_education_records', 'education_record_id', id, fields)
}

export async function createHealthRecord(residentId: number, fields: Record<string, string>): Promise<void> {
  const next = await nextPk('lighthouse_health_wellbeing_records', 'health_record_id')
  const row: Row = { health_record_id: String(next), resident_id: String(residentId), ...fields }
  const { error } = await getSupabase().from('lighthouse_health_wellbeing_records').insert({
    health_record_id: next,
    data: row,
  })
  if (error) throw error
}

export async function patchHealthRecord(
  id: number,
  fields: Record<string, string | null | undefined>,
): Promise<void> {
  await patchJsonRow('lighthouse_health_wellbeing_records', 'health_record_id', id, fields)
}

export async function createIncidentReport(residentId: number, fields: Record<string, string>): Promise<void> {
  const next = await nextPk('lighthouse_incident_reports', 'incident_id')
  const row: Row = { incident_id: String(next), resident_id: String(residentId), ...fields }
  const { error } = await getSupabase().from('lighthouse_incident_reports').insert({
    incident_id: next,
    data: row,
  })
  if (error) throw error
}

export async function patchIncidentReport(
  id: number,
  fields: Record<string, string | null | undefined>,
): Promise<void> {
  await patchJsonRow('lighthouse_incident_reports', 'incident_id', id, fields)
}
