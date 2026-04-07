import { getSupabase, isSupabaseConfigured } from '../lib/supabase'

export type AppRole = 'admin' | 'donor' | 'social_worker' | 'resident'

export type UserProfile = {
  id: string
  email: string | null
  fullName: string
  role: AppRole
}

export async function fetchUserProfile(): Promise<UserProfile | null> {
  if (!isSupabaseConfigured()) return null
  const {
    data: { session },
  } = await getSupabase().auth.getSession()
  const uid = session?.user?.id
  if (!uid) return null
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('id,email,full_name,role')
    .eq('id', uid)
    .maybeSingle()
  if (error || !data) return null
  const role = data.role as AppRole
  if (!['admin', 'donor', 'social_worker', 'resident'].includes(role)) return null
  return {
    id: data.id,
    email: data.email ?? session.user.email ?? null,
    fullName: data.full_name ?? '',
    role,
  }
}

export function isStaffRole(role: AppRole | null | undefined): boolean {
  return role === 'admin' || role === 'social_worker'
}
