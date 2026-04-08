import { useState } from 'react'
import { pageDesc, pageTitle } from '../shared/adminStyles'
import { DonorsAdminPage } from './DonorsAdminPage'
import { ContributionsAdminPage } from './ContributionsAdminPage'
import { AllocationsAdminPage } from './AllocationsAdminPage'

type Tab = 'donors' | 'donations' | 'allocations'

const tabs: { id: Tab; label: string }[] = [
  { id: 'donors', label: 'Donors' },
  { id: 'donations', label: 'Donations' },
  { id: 'allocations', label: 'Allocations' },
]

export function DonorAllPage() {
  const [active, setActive] = useState<Tab>('donors')

  return (
    <div className="space-y-6">
      <div>
        <h2 className={pageTitle}>Donor All</h2>
        <p className={pageDesc}>Donors, donations, and allocations in one place.</p>
      </div>

      {/* Tab strip */}
      <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActive(t.id)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              active === t.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content — each component manages its own state */}
      {active === 'donors' && <DonorsAdminPage />}
      {active === 'donations' && <ContributionsAdminPage />}
      {active === 'allocations' && <AllocationsAdminPage />}
    </div>
  )
}
