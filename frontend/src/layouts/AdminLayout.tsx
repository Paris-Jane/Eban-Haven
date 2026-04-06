import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import {
  BarChart3,
  ClipboardList,
  FileText,
  Heart,
  LayoutDashboard,
  Menu,
  Users,
  Video,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

const nav: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/donors', label: 'Donors & Contributions', icon: Heart },
  { to: '/admin/caseload', label: 'Caseload Inventory', icon: ClipboardList },
  { to: '/admin/process-recordings', label: 'Process Recording', icon: FileText },
  { to: '/admin/visitations', label: 'Visitations', icon: Video },
  { to: '/admin/reports', label: 'Reports & Analytics', icon: BarChart3 },
]

export function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-svh bg-slate-950 text-slate-100">
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-800 bg-slate-900 transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-800 px-4">
          <Link
            to="/admin"
            className="flex items-center gap-2 font-serif text-lg font-semibold text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600">
              <LayoutDashboard className="h-4 w-4 text-white" />
            </div>
            Staff
          </Link>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 lg:hidden"
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
                    ? 'bg-teal-600/20 text-teal-300'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                }`
              }
            >
              <item.icon className="h-4 w-4 shrink-0 opacity-80" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-800 p-3">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <Users className="h-4 w-4" />
            Back to public site
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-800 bg-slate-950/95 px-4 backdrop-blur lg:px-6">
          <button
            type="button"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="font-serif text-lg font-semibold text-white">Eban Haven — Management</h1>
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
