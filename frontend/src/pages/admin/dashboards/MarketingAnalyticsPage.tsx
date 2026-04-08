import { Link } from 'react-router-dom'
import { ArrowRight, Bot, LineChart } from 'lucide-react'
import { card, linkTile, pageDesc, pageTitle } from '../shared/adminStyles'

export function MarketingAnalyticsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className={`${pageTitle} flex items-center gap-2`}>
          <LineChart className="h-6 w-6 text-primary" />
          Marketing Analytics
        </h2>
        <p className={pageDesc}>
          Track social media reach, campaign performance, and outreach engagement across platforms.
        </p>
      </div>

      <div className={card}>
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <LineChart className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-foreground">Coming Soon</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Marketing analytics — including social reach, campaign metrics, and donor acquisition
            tracking — will be available here. Use Marketing Support in the meantime to manage
            content and scheduling.
          </p>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Related Tools</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link to="/admin/social-planner" className={linkTile}>
            <span className="flex items-center gap-2"><Bot className="h-4 w-4" /> Marketing Support</span>
            <ArrowRight className="h-4 w-4 opacity-70" />
          </Link>
          <Link to="/admin/reports" className={linkTile}>
            <span className="flex items-center gap-2"><LineChart className="h-4 w-4" /> Reports &amp; Analytics</span>
            <ArrowRight className="h-4 w-4 opacity-70" />
          </Link>
        </div>
      </div>
    </div>
  )
}
