import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, ClipboardList, FileText, Video } from 'lucide-react'
import { linkTile, pageDesc, pageTitle } from './adminStyles'

const shortcuts = [
  {
    to: '/admin/residents',
    label: 'Residents',
    hint: 'Case files, status, and resident records',
    icon: ClipboardList,
  },
  {
    to: '/admin/process-recordings',
    label: 'Process recording',
    hint: 'Session notes and counseling documentation',
    icon: FileText,
  },
  {
    to: '/admin/home-visitations',
    label: 'Home visitations',
    hint: 'Field visits and family contact',
    icon: Video,
  },
  {
    to: '/admin/case-conferences',
    label: 'Case conferences',
    hint: 'Intervention plans and conference dates',
    icon: CalendarDays,
  },
] as const

export function SocialWorkerDashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className={pageTitle}>Social Worker Dashboard</h2>
        <p className={pageDesc}>
          Quick access to caseload data, documentation, and visits. Use the sections below to open the databases you
          use most often in daily work.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {shortcuts.map(({ to, label, hint, icon: Icon }) => (
          <Link key={to} to={to} className={`${linkTile} flex-col items-stretch gap-2 py-5`}>
            <span className="flex w-full items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Icon className="h-4 w-4 shrink-0" />
                <span>{label}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 opacity-70" />
            </span>
            <span className="text-xs font-normal text-muted-foreground">{hint}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
