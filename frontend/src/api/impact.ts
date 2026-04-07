import { apiFetch, parseJson } from './client'
import { getSupabase } from '../lib/supabase'
import { useSupabaseForLighthouseData } from '../lib/useSupabaseLighthouse'

export type PublicImpactSummary = {
  activeResidents: number
  safehouseCount: number
  avgEducationProgressPercent: number
  avgHealthScore: number
  donationsLastMonthPhp: number
  supporterCount: number
  reintegrationSuccessRatePercent: number
}

export type PublicImpactSnapshot = {
  id: number
  snapshotDate: string
  headline: string
  summaryText: string
  metrics: Record<string, string | undefined>
  isPublished: boolean
}

function parsePythonishMetrics(raw: string): Record<string, string | undefined> {
  const d: Record<string, string | undefined> = {}
  if (!raw?.trim()) return d
  const num = (key: string, pattern: RegExp) => {
    const m = raw.match(pattern)
    if (m && !Number.isNaN(Number(m[1]))) d[key] = m[1]
  }
  const str = (key: string, pattern: RegExp) => {
    const m = raw.match(pattern)
    if (m) d[key] = m[1]
  }
  str('month', /'month':\s*'([^']*)'/i)
  num('avg_health_score', /'avg_health_score':\s*([\d.]+)/i)
  num('avg_education_progress', /'avg_education_progress':\s*([\d.]+)/i)
  num('total_residents', /'total_residents':\s*([\d]+)/i)
  num('donations_total_for_month', /'donations_total_for_month':\s*([\d.]+)/i)
  return d
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return Number.isFinite(n) ? n : 0
}

export async function getImpactSummary(): Promise<PublicImpactSummary> {
  if (useSupabaseForLighthouseData()) {
    const { data, error } = await getSupabase().rpc('get_public_impact_summary')
    if (error) throw error
    const o = data as Record<string, unknown>
    return {
      activeResidents: num(o.activeResidents),
      safehouseCount: num(o.safehouseCount),
      avgEducationProgressPercent: num(o.avgEducationProgressPercent),
      avgHealthScore: num(o.avgHealthScore),
      donationsLastMonthPhp: num(o.donationsLastMonthPhp),
      supporterCount: num(o.supporterCount),
      reintegrationSuccessRatePercent: num(o.reintegrationSuccessRatePercent),
    }
  }
  const res = await apiFetch('/api/impact/summary')
  return parseJson<PublicImpactSummary>(res)
}

export async function getImpactSnapshots(): Promise<PublicImpactSnapshot[]> {
  if (useSupabaseForLighthouseData()) {
    const { data, error } = await getSupabase()
      .from('lighthouse_public_impact_snapshots')
      .select('snapshot_id,data')
      .eq('published', true)
    if (error) throw error
    const rows = (data ?? []) as { snapshot_id: number; data: Record<string, unknown> }[]
    const mapped: PublicImpactSnapshot[] = rows.map((row) => {
      const raw = row.data ?? {}
      const g = (k: string) => (raw[k] == null ? '' : String(raw[k]))
      return {
        id: row.snapshot_id,
        snapshotDate: g('snapshot_date'),
        headline: g('headline'),
        summaryText: g('summary_text'),
        metrics: parsePythonishMetrics(g('metric_payload_json')),
        isPublished: true,
      }
    })
    mapped.sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate))
    return mapped.slice(0, 24)
  }
  const res = await apiFetch('/api/impact/snapshots')
  return parseJson<PublicImpactSnapshot[]>(res)
}
