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
  const res = await apiFetch('/api/auth/logout', { method: 'POST' })
  setStaffToken(null)
  if (!res.ok && res.status !== 401) await parseJson(res)
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
