/** Base URL for the ASP.NET API (no trailing slash). Empty = same origin. */
const PRODUCTION_API_FALLBACK =
  'https://eban-haven-backend-hrb6hua3baf6hngc.canadacentral-01.azurewebsites.net'

export function apiBaseUrl(): string {
  const configuredBase = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
  if (configuredBase) return configuredBase

  if (typeof window !== 'undefined' && window.location.hostname.endsWith('.vercel.app')) {
    return PRODUCTION_API_FALLBACK
  }

  return ''
}

function resolveUrl(input: string): string {
  if (input.startsWith('http://') || input.startsWith('https://')) return input
  const base = apiBaseUrl()
  if (!base) return input
  return `${base}${input.startsWith('/') ? '' : '/'}${input}`
}

const TOKEN_KEY = 'haven_staff_token'

export function getStaffToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setStaffToken(token: string | null) {
  try {
    if (!token) localStorage.removeItem(TOKEN_KEY)
    else localStorage.setItem(TOKEN_KEY, token)
  } catch {
    /* ignore */
  }
}

/** All API calls: Bearer token (no cookies). */
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers)
  if (init?.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const token = getStaffToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return fetch(resolveUrl(input), {
    ...init,
    headers,
  })
}

export async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  if (!res.ok) {
    let message = text || res.statusText
    try {
      const j = JSON.parse(text) as { error?: string }
      if (j.error) message = j.error
    } catch {
      /* keep text */
    }
    throw new Error(message)
  }
  const trimmed = text.trimStart()
  if (trimmed.startsWith('<!') || trimmed.toLowerCase().startsWith('<html')) {
    throw new Error(
      'Received HTML instead of JSON — there is no /api backend on this host. Either set VITE_USE_SUPABASE_DATA=true ' +
        '(and redeploy) so admin data loads from Supabase, or deploy the .NET API and set VITE_API_BASE_URL to its URL.',
    )
  }
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(text.slice(0, 160) || 'Invalid JSON response')
  }
}
