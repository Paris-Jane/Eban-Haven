import { useEffect, useState, useCallback } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { getMe } from '../api/auth'

type Gate = 'loading' | 'in' | 'out' | 'denied'

export function RequireDonor({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Gate>('loading')
  const location = useLocation()

  const refresh = useCallback(async () => {
    const user = await getMe()
    if (!user) {
      setState('out')
      return
    }

    setState(user.role === 'donor' ? 'in' : 'denied')
  }, [])

  useEffect(() => {
    void refresh()
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

  if (state === 'denied') {
    return <Navigate to="/admin" replace />
  }

  return <>{children}</>
}
