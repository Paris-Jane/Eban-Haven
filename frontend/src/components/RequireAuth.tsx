import { useEffect, useState, useCallback } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { getMe } from '../api/auth'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'

/** Any signed-in user (Supabase session or legacy cookie). */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'loading' | 'in' | 'out'>('loading')
  const location = useLocation()

  const refresh = useCallback(() => {
    void getMe().then((u) => setState(u ? 'in' : 'out'))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!isSupabaseConfigured()) return
    try {
      const supabase = getSupabase()
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(() => refresh())
      return () => subscription.unsubscribe()
    } catch {
      return
    }
  }, [refresh])

  if (state === 'loading') {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background text-muted-foreground">
        Verifying session…
      </div>
    )
  }
  if (state === 'out') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}
