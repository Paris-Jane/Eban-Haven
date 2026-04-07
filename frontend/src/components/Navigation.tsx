import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Heart, Menu, X } from 'lucide-react'
import { SITE_DISPLAY_NAME } from '../site'

const links = [
  { to: '/', label: 'Home' },
  { to: '/impact', label: 'Our Impact' },
] as const

export function Navigation() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const isActive = (path: string) => location.pathname === path

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:h-20 lg:px-8">
          <Link to="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
              <Heart className="h-5 w-5 fill-current text-primary-foreground" />
            </div>
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
            <Link
              to="/login"
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Login
            </Link>
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
                <Link
                  to="/login"
                  className="block text-sm font-medium text-primary"
                  onClick={() => setOpen(false)}
                >
                  Login →
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </>
  )
}
