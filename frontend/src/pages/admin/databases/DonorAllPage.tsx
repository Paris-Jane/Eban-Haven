import { useState } from 'react'
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
      {/* Full-width tab bar */}
      <div className="flex border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActive(t.id)}
            className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              active === t.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active === 'donors' && <DonorsAdminPage />}
      {active === 'donations' && <ContributionsAdminPage />}
      {active === 'allocations' && <AllocationsAdminPage />}
    </div>
  )
}
