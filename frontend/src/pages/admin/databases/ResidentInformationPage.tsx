import { useEffect, useState } from 'react'
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
  const [visited, setVisited] = useState<Record<Tab, boolean>>({
    residents: true,
    'process-recordings': false,
    'home-visitations': false,
    'case-conferences': false,
  })

  useEffect(() => {
    setVisited((current) => (current[active] ? current : { ...current, [active]: true }))
  }, [active])

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

      {visited.residents && (
        <div className={active === 'residents' ? 'block' : 'hidden'} aria-hidden={active !== 'residents'}>
          <ResidentsPage />
        </div>
      )}
      {visited['process-recordings'] && (
        <div className={active === 'process-recordings' ? 'block' : 'hidden'} aria-hidden={active !== 'process-recordings'}>
          <ProcessRecordingsPage />
        </div>
      )}
      {visited['home-visitations'] && (
        <div className={active === 'home-visitations' ? 'block' : 'hidden'} aria-hidden={active !== 'home-visitations'}>
          <HomeVisitationsAdminPage />
        </div>
      )}
      {visited['case-conferences'] && (
        <div className={active === 'case-conferences' ? 'block' : 'hidden'} aria-hidden={active !== 'case-conferences'}>
          <CaseConferencesAdminPage />
        </div>
      )}
    </div>
  )
}
