import { useState } from 'react'
import { ResidentsPage } from './ResidentsPage'
import { ProcessRecordingsPage } from './ProcessRecordingsPage'
import { HomeVisitationsAdminPage } from './HomeVisitationsAdminPage'
import { CaseConferencesAdminPage } from './CaseConferencesAdminPage'

type Tab = 'residents' | 'process-recordings' | 'home-visitations' | 'case-conferences'

const tabs: { id: Tab; label: string }[] = [
  { id: 'residents', label: 'Residents' },
  { id: 'process-recordings', label: 'Counseling Sessions' },
  { id: 'home-visitations', label: 'Home Visitations' },
  { id: 'case-conferences', label: 'Case Conferences' },
]

export function ResidentInformationPage() {
  const [active, setActive] = useState<Tab>('residents')

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

      {active === 'residents' && <ResidentsPage />}
      {active === 'process-recordings' && <ProcessRecordingsPage />}
      {active === 'home-visitations' && <HomeVisitationsAdminPage />}
      {active === 'case-conferences' && <CaseConferencesAdminPage />}
    </div>
  )
}
