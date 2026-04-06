import { Routes, Route } from 'react-router-dom'
import { PublicLayout } from './layouts/PublicLayout'
import { AdminLayout } from './layouts/AdminLayout'
import { HomePage } from './pages/HomePage'
import { ImpactPage } from './pages/ImpactPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage'
import { DonorsPage } from './pages/admin/DonorsPage'
import { CaseloadPage } from './pages/admin/CaseloadPage'
import { ProcessRecordingsPage } from './pages/admin/ProcessRecordingsPage'
import { VisitationsPage } from './pages/admin/VisitationsPage'
import { ReportsPage } from './pages/admin/ReportsPage'

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/impact" element={<ImpactPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
      </Route>
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboardPage />} />
        <Route path="donors" element={<DonorsPage />} />
        <Route path="caseload" element={<CaseloadPage />} />
        <Route path="process-recordings" element={<ProcessRecordingsPage />} />
        <Route path="visitations" element={<VisitationsPage />} />
        <Route path="reports" element={<ReportsPage />} />
      </Route>
    </Routes>
  )
}
