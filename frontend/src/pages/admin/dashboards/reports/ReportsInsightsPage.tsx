/**
 * Reports & Insights — admin command center.
 * TODO(backend): extend /reports/summary with query params (dateRange, safehouseId, donationType) so KPIs and
 * charts are server-filtered; today most filtering is client-side on loaded aggregates.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getAllocations,
  getAtRiskDonors,
  getDashboard,
  getHomeVisitations,
  getInterventionPlans,
  getMarketingAnalyticsSummary,
  getPlannedSocialPosts,
  getReintegrationReadinessCohort,
  getReportsSummary,
  getResidents,
  getSupporters,
  getUpgradeCandidates,
  listEducationRecords,
  listHealthRecords,
  listIncidentReports,
  type AtRiskDonorInfo,
  type DashboardSummary,
  type DonationAllocation,
  type DonorUpgradeInfo,
  type EducationRecord,
  type HealthRecord,
  type HomeVisitation,
  type IncidentReport,
  type InterventionPlan,
  type MarketingAnalyticsSummary,
  type PlannedSocialPost,
  type ReportsSummary,
  type ResidentSummary,
  type Supporter,
} from '../../../../api/admin'
import { getImpactSnapshots, type PublicImpactSnapshot } from '../../../../api/impact'
import { alertError } from '../../shared/adminStyles'
import { KPIOverviewCards, type KPICardModel } from './KPIOverviewCards'
import { ReportLoadingSkeleton } from './ReportLoadingSkeleton'
import { ReportTabPanel, ReportsTabs } from './ReportsTabs'
import { ReportsHeader } from './ReportsHeader'
import {
  defaultReportFilters,
  type ReportFiltersState,
  type ReportTabId,
} from './reportTypes'
import { pctDelta, priorPeriodMonths, rangeBoundsMs, selectMonthsForPreset, sumTrendPhp } from './reportFilterUtils'
import { OverviewReportTab } from './tabs/OverviewReportTab'
import { DonorsReportTab } from './tabs/DonorsReportTab'
import { ResidentsReportTab } from './tabs/ResidentsReportTab'
import { SafehousesReportTab } from './tabs/SafehousesReportTab'
import { SocialMediaInsightsTab } from './tabs/SocialMediaInsightsTab'
import { ImpactReportingTab } from './tabs/ImpactReportingTab'

import type { ReintegrationResult } from '../../../../components/ml/reintegrationReadinessShared'

type ReadinessState = {
  residents: Array<ResidentSummary & { readiness: ReintegrationResult }>
  failed_count: number
} | null

export function ReportsInsightsPage() {
  const [filters, setFilters] = useState<ReportFiltersState>(defaultReportFilters)
  const [tab, setTab] = useState<ReportTabId>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [reports, setReports] = useState<ReportsSummary | null>(null)
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null)
  const [marketing, setMarketing] = useState<MarketingAnalyticsSummary | null>(null)
  const [supporters, setSupporters] = useState<Supporter[]>([])
  const [atRisk, setAtRisk] = useState<AtRiskDonorInfo[]>([])
  const [upgrades, setUpgrades] = useState<DonorUpgradeInfo[]>([])
  const [residents, setResidents] = useState<ResidentSummary[]>([])
  const [allocations, setAllocations] = useState<DonationAllocation[]>([])
  const [incidents, setIncidents] = useState<IncidentReport[]>([])
  const [homeVisits, setHomeVisits] = useState<HomeVisitation[]>([])
  const [interventions, setInterventions] = useState<InterventionPlan[]>([])
  const [plannedPosts, setPlannedPosts] = useState<PlannedSocialPost[]>([])
  const [educationRecords, setEducationRecords] = useState<EducationRecord[]>([])
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([])
  const [readiness, setReadiness] = useState<ReadinessState>(null)
  const [impactSnapshots, setImpactSnapshots] = useState<PublicImpactSnapshot[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [rep, dash] = await Promise.all([getReportsSummary(), getDashboard()])
      setReports(rep)
      setDashboard(dash)

      const [
        mkt,
        sup,
        ar,
        up,
        res,
        inc,
        hv,
        iv,
        posts,
        edu,
        hl,
        rd,
        snaps,
      ] = await Promise.all([
        getMarketingAnalyticsSummary().catch(() => null),
        getSupporters().catch(() => [] as Supporter[]),
        getAtRiskDonors(0.55, 150).catch(() => [] as AtRiskDonorInfo[]),
        getUpgradeCandidates(0.4, 200).catch(() => [] as DonorUpgradeInfo[]),
        getResidents({}).catch(() => [] as ResidentSummary[]),
        listIncidentReports().catch(() => [] as IncidentReport[]),
        getHomeVisitations().catch(() => [] as HomeVisitation[]),
        getInterventionPlans().catch(() => [] as InterventionPlan[]),
        getPlannedSocialPosts().catch(() => [] as PlannedSocialPost[]),
        listEducationRecords().catch(() => [] as EducationRecord[]),
        listHealthRecords().catch(() => [] as HealthRecord[]),
        getReintegrationReadinessCohort().catch(() => null),
        getImpactSnapshots().catch(() => [] as PublicImpactSnapshot[]),
      ])
      setMarketing(mkt)
      setSupporters(sup)
      setAtRisk(ar)
      setUpgrades(up)
      setResidents(res)
      setIncidents(inc)
      setHomeVisits(hv)
      setInterventions(iv)
      setPlannedPosts(posts)
      setEducationRecords(edu)
      setHealthRecords(hl)
      setReadiness(rd)
      setImpactSnapshots(snaps)

      const allocParams =
        filters.safehouseId === 'all' ? undefined : { safehouseId: filters.safehouseId }
      const allocs = await getAllocations(allocParams).catch(() => [] as DonationAllocation[])
      setAllocations(allocs)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load reports')
    } finally {
      setLoading(false)
    }
  }, [filters.safehouseId])

  useEffect(() => {
    void load()
  }, [load])

  const supporterMap = useMemo(() => {
    const m = new Map<number, string>()
    for (const s of supporters) m.set(s.id, s.displayName)
    return m
  }, [supporters])

  const supporterLabel = useCallback((id: number) => supporterMap.get(id) ?? `Supporter #${id}`, [supporterMap])

  const allTrendMonths = useMemo(
    () => [...new Set((reports?.donationTrends ?? []).map((t) => t.month))].sort(),
    [reports],
  )

  const selectedMonths = useMemo(
    () => selectMonthsForPreset(filters.preset, filters.customStart, filters.customEnd, allTrendMonths),
    [filters.preset, filters.customStart, filters.customEnd, allTrendMonths],
  )

  const monthSet = useMemo(() => new Set(selectedMonths), [selectedMonths])

  const filteredTrends = useMemo(() => {
    if (!reports) return []
    return reports.donationTrends.filter((t) => monthSet.has(t.month))
  }, [reports, monthSet])

  const priorMonths = useMemo(
    () => priorPeriodMonths(selectedMonths, allTrendMonths),
    [selectedMonths, allTrendMonths],
  )
  const priorSet = useMemo(() => new Set(priorMonths), [priorMonths])

  const currSum = useMemo(() => {
    if (!reports) return { php: 0, count: 0 }
    return sumTrendPhp(reports.donationTrends, monthSet)
  }, [reports, monthSet])

  const priorSum = useMemo(() => {
    if (!reports) return { php: 0, count: 0 }
    return sumTrendPhp(reports.donationTrends, priorSet)
  }, [reports, priorSet])

  const { startMs, endMs } = useMemo(
    () => rangeBoundsMs(filters.preset, filters.customStart, filters.customEnd),
    [filters.preset, filters.customStart, filters.customEnd],
  )

  const campaignsFiltered = useMemo(() => {
    const list = marketing?.campaigns ?? []
    const inRange = list.filter((c) => {
      const t = new Date(c.lastDonation).getTime()
      return !Number.isNaN(t) && t >= startMs && t <= endMs
    })
    if (filters.campaign === 'all') return inRange
    return inRange.filter((c) => c.campaignName === filters.campaign)
  }, [marketing, startMs, endMs, filters.campaign])

  const residentsFiltered = useMemo(() => {
    let r = residents
    if (filters.safehouseId !== 'all') r = r.filter((x) => x.safehouseId === filters.safehouseId)
    return r
  }, [residents, filters.safehouseId])

  const incidentsFiltered = useMemo(
    () => incidents.filter((i) => {
      const t = new Date(i.incidentDate).getTime()
      return !Number.isNaN(t) && t >= startMs && t <= endMs
    }),
    [incidents, startMs, endMs],
  )

  const homeVisitsFiltered = useMemo(
    () => homeVisits.filter((v) => {
      const t = new Date(v.visitDate).getTime()
      return !Number.isNaN(t) && t >= startMs && t <= endMs
    }),
    [homeVisits, startMs, endMs],
  )

  const interventionsFiltered = useMemo(
    () =>
      interventions.filter((p) => {
        const t = new Date(p.updatedAt).getTime()
        return !Number.isNaN(t) && t >= startMs && t <= endMs
      }),
    [interventions, startMs, endMs],
  )

  const educationFiltered = useMemo(
    () =>
      educationRecords.filter((e) => {
        const t = new Date(e.recordDate).getTime()
        return !Number.isNaN(t) && t >= startMs && t <= endMs
      }),
    [educationRecords, startMs, endMs],
  )

  const healthFiltered = useMemo(
    () =>
      healthRecords.filter((h) => {
        const t = new Date(h.recordDate).getTime()
        return !Number.isNaN(t) && t >= startMs && t <= endMs
      }),
    [healthRecords, startMs, endMs],
  )

  const plannedPostsFiltered = useMemo(() => {
    let p = plannedPosts
    if (filters.socialPlatform !== 'all') {
      p = p.filter((x) => (x.platform ?? '').trim() === filters.socialPlatform)
    }
    return p.filter((x) => {
      const raw = x.scheduledForUtc || x.createdAtUtc
      if (!raw) return true
      const t = new Date(raw).getTime()
      return !Number.isNaN(t) && t >= startMs && t <= endMs
    })
  }, [plannedPosts, filters.socialPlatform, startMs, endMs])

  const safehousesFiltered = useMemo(() => {
    const perf = reports?.safehousePerformance ?? []
    if (filters.safehouseId === 'all') return perf
    return perf.filter((s) => s.safehouseId === filters.safehouseId)
  }, [reports, filters.safehouseId])

  const allocationsFiltered = useMemo(() => {
    if (filters.safehouseId === 'all') return allocations
    return allocations.filter((a) => a.safehouseId === filters.safehouseId)
  }, [allocations, filters.safehouseId])

  const activeSupporterCount = useMemo(
    () => supporters.filter((s) => (s.status ?? '').toLowerCase() !== 'inactive').length,
    [supporters],
  )

  const atRiskIdSet = useMemo(() => {
    const s = new Set<number>()
    for (const a of atRisk) {
      if (a.supporter_id != null) s.add(a.supporter_id)
    }
    return s
  }, [atRisk])

  const atRiskOverlapCount = useMemo(
    () => supporters.filter((s) => atRiskIdSet.has(s.id)).length,
    [supporters, atRiskIdSet],
  )

  const atRiskPctOfSupporters = useMemo(() => {
    if (supporters.length === 0) return null
    return (atRiskOverlapCount / supporters.length) * 100
  }, [supporters.length, atRiskOverlapCount])

  const highRiskResidents = useMemo(
    () => residentsFiltered.filter((r) => /high|elevated|critical/i.test(r.currentRiskLevel ?? '')),
    [residentsFiltered],
  )

  const incidentTrendUp = useMemo(() => {
    const byMonth = new Map<string, number>()
    for (const i of incidentsFiltered) {
      const k = i.incidentDate.slice(0, 7)
      byMonth.set(k, (byMonth.get(k) ?? 0) + 1)
    }
    const keys = [...byMonth.keys()].sort()
    if (keys.length < 2) return null
    const half = Math.ceil(keys.length / 2)
    const first = keys.slice(0, half).reduce((s, k) => s + (byMonth.get(k) ?? 0), 0)
    const second = keys.slice(half).reduce((s, k) => s + (byMonth.get(k) ?? 0), 0)
    return second > first
  }, [incidentsFiltered])

  const { bestSafehouseName, weakSafehouseName } = useMemo(() => {
    const list = safehousesFiltered.filter((s) => s.activeResidents > 0)
    if (list.length < 2) {
      const only = list[0]?.name ?? null
      return { bestSafehouseName: only, weakSafehouseName: only }
    }
    const scored = list.map((s) => ({
      s,
      score: (s.avgEducationProgress ?? 0) + (s.avgHealthScore ?? 0) * 10,
    }))
    scored.sort((a, b) => b.score - a.score)
    return {
      bestSafehouseName: scored[0]?.s.name ?? null,
      weakSafehouseName: scored[scored.length - 1]?.s.name ?? null,
    }
  }, [safehousesFiltered])

  const bestSocialPlatform = useMemo(() => {
    const ch = marketing?.channels
    if (ch && ch.length > 0) {
      const top = [...ch].sort((a, b) => b.totalPhp - a.totalPhp)[0]
      return top.channelSource
    }
    const c = marketing?.causalEstimates?.social_media_spotlight
    if (c && typeof c === 'object') {
      const keys = Object.keys(c).filter((k) => typeof c[k] === 'number' && (c[k] as number) > 0)
      return keys[0] ?? null
    }
    return null
  }, [marketing])

  const topAtRiskIds = useMemo(() => {
    return atRisk
      .filter((a) => a.supporter_id != null)
      .slice(0, 8)
      .map((a) => ({
        supporterId: a.supporter_id as number,
        label: supporterLabel(a.supporter_id as number),
      }))
  }, [atRisk, supporterLabel])

  const topUpgradeIds = useMemo(() => {
    return upgrades
      .filter((u) => u.supporter_id != null)
      .sort((a, b) => b.upgrade_probability - a.upgrade_probability)
      .slice(0, 8)
      .map((u) => ({
        supporterId: u.supporter_id as number,
        label: supporterLabel(u.supporter_id as number),
      }))
  }, [upgrades, supporterLabel])

  const donationDeltaPct = pctDelta(currSum.php, priorSum.php)

  const kpiCards: KPICardModel[] = useMemo(() => {
    if (!reports || !dashboard) return []
    const spotlight = marketing?.socialMediaSpotlight
    return [
      {
        id: 'don',
        label: 'Donations (PHP, window)',
        value: `₱${Math.round(currSum.php).toLocaleString()}`,
        sublabel: `${currSum.count} gifts in selected months`,
        deltaPct: donationDeltaPct,
        tone: donationDeltaPct != null && donationDeltaPct < -5 ? 'negative' : 'neutral',
        helper: 'Monetary monthly trends from reports API; filters control which months are included.',
      },
      {
        id: 'sup',
        label: 'Active supporters',
        value: String(activeSupporterCount),
        sublabel: 'Non-inactive status in supporter list',
        deltaPct: null,
        helper: 'TODO: filter by supporter created_at in range when API exposes it.',
      },
      {
        id: 'risk',
        label: 'At-risk donors (ML batch)',
        value: String(atRisk.length),
        sublabel: `${atRiskOverlapCount} overlap loaded supporter profiles`,
        deltaPct: null,
        tone: atRisk.length > 0 ? 'alert' : 'neutral',
        helper: 'From /api/donors/at-risk — not deduplicated against filters beyond supporter overlap.',
      },
      {
        id: 'res',
        label: 'Residents in view',
        value: String(residentsFiltered.length),
        sublabel: `${residentsFiltered.filter((r) => (r.caseStatus ?? '').toLowerCase() === 'active').length} marked active`,
        deltaPct: null,
      },
      {
        id: 'hr',
        label: 'High-risk residents',
        value: String(highRiskResidents.length),
        sublabel: 'Labels match high / elevated / critical',
        deltaPct: null,
        tone: highRiskResidents.length > 0 ? 'alert' : 'neutral',
      },
      {
        id: 'reint',
        label: 'Reintegration success',
        value: `${dashboard.reintegration.successRatePercent.toFixed(1)}%`,
        sublabel: `Completed ${dashboard.reintegration.completedCount}`,
        deltaPct: null,
        helper: 'Dashboard-wide rate; not recomputed per date filter yet.',
      },
      {
        id: 'posts',
        label: 'Social posts (planner)',
        value: String(plannedPostsFiltered.length),
        sublabel: 'Filtered by platform + date',
        deltaPct: null,
      },
      {
        id: 'socd',
        label: 'Social-attributed gifts',
        value: spotlight ? String(spotlight.donationCount) : '—',
        sublabel: spotlight ? `₱${Math.round(spotlight.totalPhp).toLocaleString()}` : 'Marketing API unavailable',
        deltaPct: null,
        helper: 'From marketing analytics spotlight aggregate (not date-filtered server-side).',
      },
    ]
  }, [
    reports,
    dashboard,
    marketing,
    currSum,
    donationDeltaPct,
    activeSupporterCount,
    atRisk.length,
    atRiskOverlapCount,
    residentsFiltered,
    highRiskResidents.length,
    plannedPostsFiltered.length,
  ])

  const pickSafehouse = useCallback((id: number) => {
    setFilters((f) => ({ ...f, safehouseId: id }))
    setTab('safehouses')
  }, [])

  const donationTypeOptions = useMemo(() => {
    const s = new Set<string>(['all', 'Monetary', 'In-Kind'])
    return [...s]
  }, [])

  if (loading && !reports) return <ReportLoadingSkeleton />

  if (error || !reports || !dashboard) {
    return (
      <div className="space-y-4">
        <div className={alertError}>{error ?? 'Unable to load reports.'}</div>
        <button
          type="button"
          className="rounded-lg border border-border px-4 py-2 text-sm"
          onClick={() => void load()}
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-16">
      <ReportsHeader
        filters={filters}
        onFiltersChange={setFilters}
        safehouses={reports.safehousePerformance}
        campaigns={marketing?.campaigns ?? []}
        plannedPosts={plannedPosts}
        donationTypeOptions={donationTypeOptions}
      />

      {loading ? <p className="text-sm text-muted-foreground">Refreshing data…</p> : null}

      <KPIOverviewCards cards={kpiCards} />

      <ReportsTabs active={tab} onChange={setTab}>
        <ReportTabPanel id="overview" active={tab}>
          <OverviewReportTab
            filteredTrends={filteredTrends}
            reports={reports}
            dashboard={dashboard}
            marketing={marketing}
            safehousesFiltered={safehousesFiltered}
            atRiskCount={atRisk.length}
            supporterCount={supporters.length}
            atRiskPctOfSupporters={atRiskPctOfSupporters}
            incidentTrendUp={incidentTrendUp}
            bestSafehouseName={bestSafehouseName}
            weakSafehouseName={weakSafehouseName}
            bestSocialPlatform={bestSocialPlatform}
            topAtRiskIds={topAtRiskIds}
            topUpgradeIds={topUpgradeIds}
            upgradeBatchCount={upgrades.length}
            onSetTab={setTab}
            onPickSafehouse={pickSafehouse}
          />
        </ReportTabPanel>

        <ReportTabPanel id="donors" active={tab}>
          <DonorsReportTab
            filteredTrends={filteredTrends}
            marketing={marketing}
            campaignsFiltered={campaignsFiltered}
            allocationsFiltered={allocationsFiltered}
            atRisk={atRisk}
            upgrades={upgrades}
            supporterLabel={supporterLabel}
          />
        </ReportTabPanel>

        <ReportTabPanel id="residents" active={tab}>
          <ResidentsReportTab
            reports={reports}
            residentsFiltered={residentsFiltered}
            incidentsFiltered={incidentsFiltered}
            homeVisitsFiltered={homeVisitsFiltered}
            interventionsFiltered={interventionsFiltered}
            educationFiltered={educationFiltered}
            healthFiltered={healthFiltered}
            readiness={readiness}
          />
        </ReportTabPanel>

        <ReportTabPanel id="safehouses" active={tab}>
          <SafehousesReportTab safehousesFiltered={safehousesFiltered} onPickSafehouse={pickSafehouse} />
        </ReportTabPanel>

        <ReportTabPanel id="social" active={tab}>
          <SocialMediaInsightsTab marketing={marketing} plannedPostsFiltered={plannedPostsFiltered} />
        </ReportTabPanel>

        <ReportTabPanel id="impact" active={tab}>
          <ImpactReportingTab
            reports={reports}
            allocationsFiltered={allocationsFiltered}
            impactSnapshots={impactSnapshots}
          />
        </ReportTabPanel>
      </ReportsTabs>
    </div>
  )
}
