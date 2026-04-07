import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Bot,
  CalendarDays,
  ClipboardList,
  FileText,
  Gift,
  GitBranch,
  Heart,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  PieChart,
  Video,
  Waypoints,
  X,
} from 'lucide-react'
import { logout } from '../api/auth'
import type { LucideIcon } from 'lucide-react'
import { SiteLogoMark } from '../components/SiteLogoMark'
import { SITE_DISPLAY_NAME } from '../site'

type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

const nav: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/donors', label: 'Donors', icon: Heart },
  { to: '/admin/donor-pipeline', label: 'Donor pipeline', icon: GitBranch },
  { to: '/admin/contributions', label: 'Contributions', icon: Gift },
  { to: '/admin/allocations', label: 'Allocations', icon: PieChart },
  { to: '/admin/residents', label: 'Residents', icon: ClipboardList },
  { to: '/admin/resident-pipeline', label: 'Resident pipeline', icon: Waypoints },
  { to: '/admin/process-recordings', label: 'Process recording', icon: FileText },
  { to: '/admin/home-visitations', label: 'Home visitation', icon: Video },
  { to: '/admin/case-conferences', label: 'Case conferences', icon: CalendarDays },
  { to: '/admin/reports', label: 'Reports & Analytics', icon: BarChart3 },
  { to: '/admin/social-planner', label: 'Social planner', icon: Bot },
]

export function AdminLayout() {
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  async function signOut() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-svh bg-background text-foreground">
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
          <Link
            to="/"
            className="flex min-w-0 items-center gap-2 font-heading text-lg font-semibold text-sidebar-primary-foreground"
            onClick={() => setSidebarOpen(false)}
          >
            <span className="flex shrink-0 rounded-lg bg-white p-1 shadow-sm ring-1 ring-sidebar-border/40">
              <SiteLogoMark className="h-7 max-h-7 max-w-[8.5rem] sm:h-8 sm:max-h-8 sm:max-w-[9.5rem]" />
            </span>
            <span className="truncate">{SITE_DISPLAY_NAME}</span>
          </Link>
          <button
            type="button"
            className="rounded-lg p-2 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end === true}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-sidebar-primary/25 text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                }`
              }
            >
              <item.icon className="h-4 w-4 shrink-0 opacity-90" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-1 border-t border-sidebar-border p-3">
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
          <Link
            to="/"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <Home className="h-4 w-4" />
            Back to public site
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:px-6">
          <button
            type="button"
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="font-heading text-lg font-semibold text-foreground">
            {SITE_DISPLAY_NAME} — Management
          </h1>
        </header>
        <main className="flex-1 overflow-auto bg-background p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
