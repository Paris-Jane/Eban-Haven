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
  UserCheck,
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
  /** Use when leaving the `/admin` tree (e.g. donor portal). */
  plainLink?: boolean
}

type NavGroup = {
  title: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    title: 'Dashboards',
    items: [
      { to: '/admin', label: 'Admin Dashboard', icon: LayoutDashboard, end: true },
      { to: '/admin/donor-dashboard', label: 'Donor Dashboard', icon: Heart },
      { to: '/admin/social-worker-dashboard', label: 'Social Worker Dashboard', icon: UserCheck },
      { to: '/admin/reports', label: 'Reports & analytics', icon: BarChart3 },
    ],
  },
  {
    title: 'Databases',
    items: [
      { to: '/admin/donors', label: 'Donors', icon: Heart },
      { to: '/admin/contributions', label: 'Contributions', icon: Gift },
      { to: '/admin/allocations', label: 'Allocations', icon: PieChart },
      { to: '/admin/residents', label: 'Residents', icon: ClipboardList },
      { to: '/admin/process-recordings', label: 'Process recording', icon: FileText },
      { to: '/admin/home-visitations', label: 'Home visitations', icon: Video },
      { to: '/admin/case-conferences', label: 'Case conferences', icon: CalendarDays },
    ],
  },
  {
    title: 'Tools',
    items: [
      { to: '/admin/donor-pipeline', label: 'Donor tools', icon: GitBranch },
      { to: '/admin/resident-pipeline', label: 'Resident tools', icon: Waypoints },
      { to: '/admin/social-planner', label: 'Marketing tools', icon: Bot },
    ],
  },
]

function navItemClassName(active: boolean) {
  return `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
    active
      ? 'bg-sidebar-primary/25 text-sidebar-primary-foreground'
      : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
  }`
}

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
        <nav className="flex-1 space-y-6 overflow-y-auto p-3">
          {navGroups.map((group) => (
            <div key={group.title}>
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) =>
                  item.plainLink ? (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setSidebarOpen(false)}
                      className={navItemClassName(false)}
                    >
                      <item.icon className="h-4 w-4 shrink-0 opacity-90" />
                      {item.label}
                    </Link>
                  ) : (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end === true}
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) => navItemClassName(isActive)}
                    >
                      <item.icon className="h-4 w-4 shrink-0 opacity-90" />
                      {item.label}
                    </NavLink>
                  ),
                )}
              </div>
            </div>
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
