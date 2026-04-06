const base = '/api/admin'

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    let message = text || res.statusText
    try {
      const j = JSON.parse(text) as { error?: string }
      if (j.error) message = j.error
    } catch {
      /* keep text */
    }
    throw new Error(message)
  }
  return res.json() as Promise<T>
}

export type DashboardSummary = {
  donorCount: number
  totalContributions: number
  activeCases: number
  visitationsThisWeek: number
  processRecordingsCount: number
}

export type Donor = {
  id: string
  donorName: string
  amount: number
  date: string
  note: string | null
}

export type Case = {
  id: string
  referenceCode: string
  status: string
  opened: string
  summary: string | null
}

export type Visitation = {
  id: string
  caseId: string | null
  visitorName: string
  scheduledAt: string
  status: string
}

export type ProcessRecording = {
  id: string
  caseId: string
  recordedAt: string
  therapist: string
  summary: string
}

export type ReportsSummary = {
  totalCases: number
  activeCases: number
  reintegrationCases: number
  totalContributions: number
  processRecordingsCount: number
}

export async function getDashboard(): Promise<DashboardSummary> {
  const res = await fetch(`${base}/dashboard`)
  return parseJson<DashboardSummary>(res)
}

export async function getDonors(): Promise<Donor[]> {
  const res = await fetch(`${base}/donors`)
  return parseJson<Donor[]>(res)
}

export async function createDonor(body: {
  donorName: string
  amount: number
  date?: string
  note?: string
}): Promise<Donor> {
  const res = await fetch(`${base}/donors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      donorName: body.donorName,
      amount: body.amount,
      date: body.date ?? null,
      note: body.note ?? null,
    }),
  })
  return parseJson<Donor>(res)
}

export async function getCases(): Promise<Case[]> {
  const res = await fetch(`${base}/cases`)
  return parseJson<Case[]>(res)
}

export async function createCase(body: {
  referenceCode: string
  status: string
  summary?: string
}): Promise<Case> {
  const res = await fetch(`${base}/cases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return parseJson<Case>(res)
}

export async function updateCaseStatus(caseId: string, status: string): Promise<Case> {
  const res = await fetch(`${base}/cases/${caseId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
  return parseJson<Case>(res)
}

export async function getVisitations(): Promise<Visitation[]> {
  const res = await fetch(`${base}/visitations`)
  return parseJson<Visitation[]>(res)
}

export async function createVisitation(body: {
  caseId: string | null
  visitorName: string
  scheduledAt: string
  status: string
}): Promise<Visitation> {
  const res = await fetch(`${base}/visitations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      caseId: body.caseId,
      visitorName: body.visitorName,
      scheduledAt: body.scheduledAt,
      status: body.status,
    }),
  })
  return parseJson<Visitation>(res)
}

export async function getProcessRecordings(): Promise<ProcessRecording[]> {
  const res = await fetch(`${base}/process-recordings`)
  return parseJson<ProcessRecording[]>(res)
}

export async function createProcessRecording(body: {
  caseId: string
  recordedAt?: string | null
  therapist: string
  summary: string
}): Promise<ProcessRecording> {
  const res = await fetch(`${base}/process-recordings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return parseJson<ProcessRecording>(res)
}

export async function getReportsSummary(): Promise<ReportsSummary> {
  const res = await fetch(`${base}/reports/summary`)
  return parseJson<ReportsSummary>(res)
}
