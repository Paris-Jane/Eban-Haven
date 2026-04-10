import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import {
  BarChart3,
  Bot,
  Layers,
  LayoutDashboard,
  LineChart,
  LogOut,
  Mail,
  PanelLeftClose,
  PanelLeft,
  Star,
  X,
} from 'lucide-react'
import { logoutAndReload } from '../api/auth'
import type { LucideIcon } from 'lucide-react'
import { SiteLogoMark } from '../components/SiteLogoMark'
import { SITE_DISPLAY_NAME } from '../site'

const SIDEBAR_COLLAPSED_KEY = 'admin_sidebar_collapsed'

type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  plainLink?: boolean
}

type NavGroup = {
  title: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    title: 'All',
    items: [
      { to: '/admin', label: 'Admin Dashboard', icon: LayoutDashboard, end: true },
      { to: '/admin/reports', label: 'Reports & Insights', icon: BarChart3 },
    ],
  },
  {
    title: 'Residents',
    items: [
      { to: '/admin/resident-information', label: 'Resident Information', icon: Layers },
      { to: '/admin/reintigration-readiness', label: 'Reintigration Readiness', icon: Star },
    ],
  },
  {
    title: 'Funding',
    items: [
      { to: '/admin/donor-all', label: 'Donor Information', icon: Layers },
      { to: '/admin/email-hub', label: 'Donor Outreach', icon: Mail },
    ],
  },
  {
    title: 'Social Media',
    items: [
      { to: '/admin/marketing-analytics', label: 'Marketing Analytics', icon: LineChart },
      { to: '/admin/social-planner', label: 'Marketing Support', icon: Bot },
    ],
  },
]

function navItemClassName(active: boolean, collapsed: boolean) {
  return `flex items-center gap-3 rounded-lg text-sm font-medium transition-colors ${
    collapsed ? 'justify-center px-2 py-2.5 lg:px-2' : 'px-3 py-2.5'
  } ${
    active
      ? 'bg-sidebar-primary/25 text-sidebar-primary-foreground'
      : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
  }`
}

export function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed])

  async function signOut() {
    await logoutAndReload('/login')
  }

  const asideWidthMobile = 'w-[min(16rem,85vw)]'
  const asideWidthLg = sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-dvh flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[transform,width] duration-200 ease-out ${asideWidthMobile} ${asideWidthLg} ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div
          className={`flex h-16 shrink-0 items-center border-b border-sidebar-border px-3 ${
            sidebarCollapsed ? 'lg:justify-center lg:px-2' : 'justify-between'
          }`}
        >
          {/* Logo — hidden on desktop when collapsed */}
          <Link
            to="/"
            className={`flex min-w-0 items-center gap-2 font-heading font-semibold text-sidebar-primary-foreground text-lg ${
              sidebarCollapsed ? 'lg:hidden' : ''
            }`}
            onClick={() => setSidebarOpen(false)}
            title={SITE_DISPLAY_NAME}
          >
            <SiteLogoMark className="h-7 max-h-7 max-w-[8.5rem] sm:h-8 sm:max-h-8 sm:max-w-[9.5rem]" />
            <span className="truncate">{SITE_DISPLAY_NAME}</span>
          </Link>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="hidden rounded-lg p-2 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:inline-flex"
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={() => setSidebarCollapsed((c) => !c)}
            >
              {sidebarCollapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </button>
            <button
              type="button"
              className="rounded-lg p-2 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <nav className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-3">
          {navGroups.map((group) => (
            <div key={group.title}>
              <p
                className={`mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/45 ${
                  sidebarCollapsed ? 'lg:hidden' : ''
                }`}
              >
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) =>
                  item.plainLink ? (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setSidebarOpen(false)}
                      className={navItemClassName(false, sidebarCollapsed)}
                      title={sidebarCollapsed ? item.label : undefined}
                    >
                      <item.icon className="h-4 w-4 shrink-0 opacity-90" />
                      {!sidebarCollapsed && item.label}
                    </Link>
                  ) : (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end === true}
                      onClick={() => setSidebarOpen(false)}
                      title={sidebarCollapsed ? item.label : undefined}
                      className={({ isActive }) => navItemClassName(isActive, sidebarCollapsed)}
                    >
                      <item.icon className="h-4 w-4 shrink-0 opacity-90" />
                      {!sidebarCollapsed && item.label}
                    </NavLink>
                  ),
                )}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 space-y-3 border-t border-sidebar-border bg-sidebar p-3">
          <button
            type="button"
            onClick={() => void signOut()}
            className={`flex w-full items-center gap-2 rounded-lg text-left text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${
              sidebarCollapsed ? 'justify-center px-2 py-2 lg:px-2' : 'px-3 py-2'
            }`}
            title={sidebarCollapsed ? 'Sign out' : undefined}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && 'Sign out'}
          </button>
        </div>
      </aside>

      <div
        className={`flex min-h-dvh min-w-0 flex-col transition-[padding] duration-200 ease-out ${
          sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64'
        }`}
      >
        <main className="flex-1 bg-background p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
