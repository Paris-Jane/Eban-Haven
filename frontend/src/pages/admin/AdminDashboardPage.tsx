import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ClipboardList, FileText, Heart, Video } from 'lucide-react'
import { getDashboard, type DashboardSummary } from '../../api/admin'

function Card({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 font-serif text-2xl font-bold text-white">{value}</p>
      {sub && <p className="mt-1 text-sm text-slate-400">{sub}</p>}
    </div>
  )
}

export function AdminDashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const d = await getDashboard()
        if (!cancelled) {
          setData(d)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load dashboard')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return <p className="text-slate-400">Loading dashboard…</p>
  }
  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-red-200">
        {error ?? 'No data'}
      </div>
    )
  }

  const money = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(
    data.totalContributions,
  )

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-serif text-2xl font-bold text-white">Dashboard</h2>
        <p className="mt-1 text-sm text-slate-400">
          Snapshot of donors, cases, and operational activity (in-memory demo data).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card label="Contributions recorded" value={String(data.donorCount)} sub={money + ' total'} />
        <Card label="Active cases" value={String(data.activeCases)} />
        <Card label="Visitations this week" value={String(data.visitationsThisWeek)} />
        <Card label="Process recordings" value={String(data.processRecordingsCount)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link
          to="/admin/donors"
          className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm font-medium text-teal-300 transition-colors hover:border-teal-700 hover:bg-slate-900"
        >
          <span className="flex items-center gap-2">
            <Heart className="h-4 w-4" /> Donors
          </span>
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          to="/admin/caseload"
          className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm font-medium text-teal-300 transition-colors hover:border-teal-700 hover:bg-slate-900"
        >
          <span className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> Caseload
          </span>
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          to="/admin/visitations"
          className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm font-medium text-teal-300 transition-colors hover:border-teal-700 hover:bg-slate-900"
        >
          <span className="flex items-center gap-2">
            <Video className="h-4 w-4" /> Visitations
          </span>
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          to="/admin/process-recordings"
          className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm font-medium text-teal-300 transition-colors hover:border-teal-700 hover:bg-slate-900"
        >
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4" /> Recordings
          </span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
