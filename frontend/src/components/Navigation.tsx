import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { LayoutDashboard, LogIn, LogOut, Menu, Shield, X } from 'lucide-react'
import { SiteLogoMark } from './SiteLogoMark'
import { SITE_DISPLAY_NAME } from '../site'
import { logoutAndReload } from '../api/auth'
import { useAuthSession } from '../hooks/useAuthSession'

const links = [
  { to: '/', label: 'Home' },
  { to: '/impact', label: 'Our Impact' },
] as const

function isDonorRole(role: string | undefined) {
  return role?.trim().toLowerCase() === 'donor'
}

/** Matches `RequireAdmin`: only full admins use `/admin` in this app. */
function isAdminRole(role: string | undefined) {
  return role?.trim().toLowerCase() === 'admin'
}

export function Navigation() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const session = useAuthSession()
  const isActive = (path: string) => location.pathname === path

  async function onLogout() {
    setOpen(false)
    await logoutAndReload('/')
  }

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:h-20 lg:px-8">
          <Link to="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
            <SiteLogoMark className="lg:h-10 lg:max-w-[12rem]" />
            <span className="font-heading text-xl font-semibold text-foreground">
              {SITE_DISPLAY_NAME}
            </span>
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            {links.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`text-sm font-medium transition-colors ${
                  isActive(item.to)
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {item.label}
              </Link>
            ))}
            {session === undefined ? (
              <span className="h-9 w-24 animate-pulse rounded-lg bg-muted" aria-hidden />
            ) : session === null ? (
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                <LogIn className="h-4 w-4" />
                Login
              </Link>
            ) : isDonorRole(session.role) ? (
              <div className="flex items-center gap-2">
                <Link
                  to="/donor-dashboard"
                  className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    isActive('/donor-dashboard')
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-foreground hover:bg-muted'
                  }`}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  My dashboard
                </Link>
                <button
                  type="button"
                  onClick={() => void onLogout()}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </div>
            ) : isAdminRole(session.role) ? (
              <div className="flex items-center gap-2">
                <Link
                  to="/admin"
                  className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    location.pathname.startsWith('/admin')
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-foreground hover:bg-muted'
                  }`}
                >
                  <Shield className="h-4 w-4" />
                  Staff portal
                </Link>
                <button
                  type="button"
                  onClick={() => void onLogout()}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="hidden text-sm text-muted-foreground sm:inline">Signed in</span>
                <button
                  type="button"
                  onClick={() => void onLogout()}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className="p-2 md:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-border bg-background md:hidden"
            >
              <div className="space-y-3 px-6 py-4">
                {links.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="block text-sm font-medium text-muted-foreground hover:text-foreground"
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
                {session === undefined ? null : session === null ? (
                  <Link
                    to="/login"
                    className="block text-sm font-medium text-primary"
                    onClick={() => setOpen(false)}
                  >
                    Login →
                  </Link>
                ) : isDonorRole(session.role) ? (
                  <div className="flex flex-col gap-2 border-t border-border pt-3">
                    <Link
                      to="/donor-dashboard"
                      className="inline-flex items-center gap-2 text-sm font-medium text-foreground"
                      onClick={() => setOpen(false)}
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      My dashboard
                    </Link>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 text-left text-sm font-medium text-muted-foreground"
                      onClick={() => void onLogout()}
                    >
                      <LogOut className="h-4 w-4" />
                      Log out
                    </button>
                  </div>
                ) : isAdminRole(session.role) ? (
                  <div className="flex flex-col gap-2 border-t border-border pt-3">
                    <Link
                      to="/admin"
                      className="inline-flex items-center gap-2 text-sm font-medium text-foreground"
                      onClick={() => setOpen(false)}
                    >
                      <Shield className="h-4 w-4" />
                      Staff portal
                    </Link>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 text-left text-sm font-medium text-muted-foreground"
                      onClick={() => void onLogout()}
                    >
                      <LogOut className="h-4 w-4" />
                      Log out
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 border-t border-border pt-3">
                    <p className="text-sm text-muted-foreground">Signed in</p>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 text-left text-sm font-medium text-muted-foreground"
                      onClick={() => void onLogout()}
                    >
                      <LogOut className="h-4 w-4" />
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </>
  )
}
