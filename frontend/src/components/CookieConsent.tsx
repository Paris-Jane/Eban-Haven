import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Cookie, X } from 'lucide-react'

const STORAGE_KEY = 'cookie_consent'

export function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return
    const t = window.setTimeout(() => setVisible(true), 1500)
    return () => window.clearTimeout(t)
  }, [])

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, 'accepted')
    document.cookie = 'cookie_consent=accepted; path=/; max-age=31536000; SameSite=Lax'
    setVisible(false)
  }

  const decline = () => {
    localStorage.setItem(STORAGE_KEY, 'declined')
    document.cookie = 'cookie_consent=declined; path=/; max-age=31536000; SameSite=Lax'
    setVisible(false)
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-0 left-0 right-0 z-50 p-4 lg:p-6"
        >
          <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-secondary">
                <Cookie className="h-5 w-5 text-accent" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="mb-1 font-serif text-sm font-semibold">We value your privacy</h3>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  We use cookies to enhance your experience and analyze site usage. By accepting, you
                  consent to our use of cookies as described in our Privacy Policy.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={accept}
                    className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
                  >
                    Accept All
                  </button>
                  <button
                    type="button"
                    onClick={decline}
                    className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
                  >
                    Decline
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={decline}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
