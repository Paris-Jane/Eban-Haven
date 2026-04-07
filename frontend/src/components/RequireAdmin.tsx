import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchUserProfile } from '../api/profile'
import { isSupabaseConfigured } from '../lib/supabase'

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'loading' | 'allowed' | 'denied'>(
    isSupabaseConfigured() ? 'loading' : 'allowed',
  )

  useEffect(() => {
    if (!isSupabaseConfigured()) return

    let cancelled = false
    void fetchUserProfile()
      .then((profile) => {
        if (!cancelled) setState(profile?.role === 'admin' ? 'allowed' : 'denied')
      })
      .catch(() => {
        if (!cancelled) setState('denied')
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (state === 'loading') {
    return <p className="text-sm text-muted-foreground">Checking admin access…</p>
  }

  if (state === 'denied') {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
        This page is limited to administrator accounts.
        <div className="mt-3">
          <Link to="/admin" className="font-medium underline underline-offset-4">
            Return to dashboard
          </Link>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
