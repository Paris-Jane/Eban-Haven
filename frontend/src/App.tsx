import { Routes, Route } from 'react-router-dom'
import { PublicLayout } from './layouts/PublicLayout'
import { AdminLayout } from './layouts/AdminLayout'
import { RequireAdmin } from './components/RequireAdmin'
import { HomePage } from './pages/public/HomePage'
import { ImpactPage } from './pages/public/ImpactPage'
import { PrivacyPage } from './pages/public/PrivacyPage'
import { LoginPage } from './pages/public/LoginPage'
import { AccessibilityPage } from './pages/public/AccessibilityPage'
import { RequireDonor } from './components/RequireDonor'
import { DonorDashboardPage } from './pages/donor/DonorDashboardPage'
import { AdminDashboardPage } from './pages/admin/dashboards/AdminDashboardPage'
import { DonorsAdminPage } from './pages/admin/databases/DonorsAdminPage'
import { DonorDetailPage } from './pages/admin/databases/DonorDetailPage'
import { DonorPipelinePage } from './pages/admin/tools/DonorPipelinePage'
import { ContributionsAdminPage } from './pages/admin/databases/ContributionsAdminPage'
import { AllocationsAdminPage } from './pages/admin/databases/AllocationsAdminPage'
import { ResidentsPage } from './pages/admin/databases/ResidentsPage'
import { ResidentDetailPage } from './pages/admin/databases/ResidentDetailPage'
import { ResidentPipelinePage } from './pages/admin/tools/ResidentPipelinePage'
import { ProcessRecordingsPage } from './pages/admin/databases/ProcessRecordingsPage'
import { HomeVisitationsAdminPage } from './pages/admin/databases/HomeVisitationsAdminPage'
import { CaseConferencesAdminPage } from './pages/admin/databases/CaseConferencesAdminPage'
import { ReportsPage } from './pages/admin/dashboards/ReportsPage'
import { SocialPlannerPage } from './pages/admin/tools/SocialPlannerPage'
import { SocialWorkerDashboardPage } from './pages/admin/dashboards/SocialWorkerDashboardPage'
import { EmailHubPage } from './pages/admin/tools/EmailHubPage'

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/impact" element={<ImpactPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/accessibility" element={<AccessibilityPage />} />
        <Route
          path="/donor-dashboard"
          element={
            <RequireDonor>
              <DonorDashboardPage />
            </RequireDonor>
          }
        />
      </Route>
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route index element={<AdminDashboardPage />} />
        <Route path="social-worker-dashboard" element={<SocialWorkerDashboardPage />} />
        <Route path="donors" element={<DonorsAdminPage />} />
        <Route path="donors/:id" element={<DonorDetailPage />} />
        <Route path="donor-pipeline" element={<DonorPipelinePage />} />
        <Route path="email-hub" element={<EmailHubPage />} />
        <Route path="contributions" element={<ContributionsAdminPage />} />
        <Route path="allocations" element={<AllocationsAdminPage />} />
        <Route path="residents" element={<ResidentsPage />} />
        <Route path="residents/:id" element={<ResidentDetailPage />} />
        <Route path="resident-pipeline" element={<ResidentPipelinePage />} />
        <Route path="process-recordings" element={<ProcessRecordingsPage />} />
        <Route path="home-visitations" element={<HomeVisitationsAdminPage />} />
        <Route path="case-conferences" element={<CaseConferencesAdminPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route
          path="social-planner"
          element={
            <RequireAdmin>
              <SocialPlannerPage />
            </RequireAdmin>
          }
        />
      </Route>
    </Routes>
  )
}
