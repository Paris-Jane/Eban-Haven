import { apiFetch, parseJson, setStaffToken } from './client'

export async function login(username: string, password: string, rememberMe = false): Promise<void> {
  const res = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password, rememberMe }),
  })
  const data = await parseJson<{ token: string }>(res)
  setStaffToken(data.token)
}

export async function logout(): Promise<void> {
  try {
    const res = await apiFetch('/api/auth/logout', { method: 'POST' })
    if (!res.ok && res.status !== 401) await parseJson(res)
  } catch {
    /* offline or API error — still clear local session below */
  } finally {
    setStaffToken(null)
  }
}

/** Clears the session and performs a full page load so all React state resets. */
export async function logoutAndReload(redirectTo = '/'): Promise<void> {
  await logout()
  window.location.assign(redirectTo)
}

export type SessionUser = {
  user: string
  role: string
}

export async function getMe(): Promise<SessionUser | null> {
  try {
    const res = await apiFetch('/api/auth/me')
    if (res.status === 401) return null
    return await parseJson<SessionUser>(res)
  } catch {
    return null
  }
}
