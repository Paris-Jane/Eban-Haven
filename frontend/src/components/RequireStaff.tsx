import { useEffect, useState, useCallback } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { getMe } from '../api/auth'
import { fetchUserProfile, isStaffRole } from '../api/profile'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'

type Gate = 'loading' | 'in' | 'out' | 'donor' | 'resident'

export function RequireStaff({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Gate>('loading')
  const location = useLocation()

  const refresh = useCallback(() => {
    void (async () => {
      const u = await getMe()
      if (!u) {
        setState('out')
        return
      }
      if (isSupabaseConfigured()) {
        const p = await fetchUserProfile()
        if (p?.role === 'donor') {
          setState('donor')
          return
        }
        if (p?.role === 'resident') {
          setState('resident')
          return
        }
        if (p && !isStaffRole(p.role)) {
          setState('out')
          return
        }
      }
      setState('in')
    })()
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
      } = supabase.auth.onAuthStateChange(() => {
        refresh()
      })
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
  if (state === 'donor') {
    return <Navigate to="/donor-dashboard" replace />
  }
  if (state === 'resident') {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}
