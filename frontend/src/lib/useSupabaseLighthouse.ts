import { isSupabaseConfigured } from './supabase'

/**
 * When true, admin + impact data load from Supabase (PostgREST) instead of the .NET API.
 * Requires schema in supabase/migrations and CSV import (or manual rows).
 */
export function useSupabaseForLighthouseData(): boolean {
  return (
    import.meta.env.VITE_USE_SUPABASE_DATA === 'true' && isSupabaseConfigured()
  )
}
