/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** When `"true"`, admin + impact data use Supabase tables instead of `/api/admin` and `/api/impact`. */
  readonly VITE_USE_SUPABASE_DATA?: string
  /** Base URL of the .NET API (no trailing slash). Empty = same-origin `/api`. */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
