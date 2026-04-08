import { Routes, Route } from 'react-router-dom'
import { PublicLayout } from './layouts/PublicLayout'
import { AdminLayout } from './layouts/AdminLayout'
import { RequireAdmin } from './components/RequireAdmin'
import { RequireStaff } from './components/RequireStaff'
import { RequireAuth } from './components/RequireAuth'
import { HomePage } from './pages/HomePage'
import { ImpactPage } from './pages/ImpactPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { LoginPage } from './pages/LoginPage'
import { AccessibilityPage } from './pages/AccessibilityPage'
import { DonorDashboardPage } from './pages/DonorDashboardPage'
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage'
import { DonorsAdminPage } from './pages/admin/DonorsAdminPage'
import { DonorDetailPage } from './pages/admin/DonorDetailPage'
import { DonorPipelinePage } from './pages/admin/DonorPipelinePage'
import { ContributionsAdminPage } from './pages/admin/ContributionsAdminPage'
import { AllocationsAdminPage } from './pages/admin/AllocationsAdminPage'
import { ResidentsPage } from './pages/admin/ResidentsPage'
import { ResidentDetailPage } from './pages/admin/ResidentDetailPage'
import { ResidentPipelinePage } from './pages/admin/ResidentPipelinePage'
import { ProcessRecordingsPage } from './pages/admin/ProcessRecordingsPage'
import { HomeVisitationsAdminPage } from './pages/admin/HomeVisitationsAdminPage'
import { CaseConferencesAdminPage } from './pages/admin/CaseConferencesAdminPage'
import { ReportsPage } from './pages/admin/ReportsPage'
import { SocialPlannerPage } from './pages/admin/SocialPlannerPage'
import { SocialWorkerDashboardPage } from './pages/admin/SocialWorkerDashboardPage'

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
            <RequireAuth>
              <DonorDashboardPage />
            </RequireAuth>
          }
        />
      </Route>
      <Route
        path="/admin"
        element={
          <RequireStaff>
            <AdminLayout />
          </RequireStaff>
        }
      >
        <Route index element={<AdminDashboardPage />} />
        <Route path="social-worker-dashboard" element={<SocialWorkerDashboardPage />} />
        <Route path="donor-dashboard" element={<DonorDashboardPage />} />
        <Route path="donors" element={<DonorsAdminPage />} />
        <Route path="donors/:id" element={<DonorDetailPage />} />
        <Route path="donor-pipeline" element={<DonorPipelinePage />} />
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
