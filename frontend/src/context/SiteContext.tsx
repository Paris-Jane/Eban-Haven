import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import { useSupabaseForLighthouseData } from '../lib/useSupabaseLighthouse'
import { DEFAULT_SITE_NAME } from '../site'

export type SiteInfo = {
  name: string
  description: string | null
}

const SiteContext = createContext<SiteInfo>({ name: DEFAULT_SITE_NAME, description: null })

export function SiteProvider({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState<SiteInfo>({
    name: DEFAULT_SITE_NAME,
    description: null,
  })

  const load = useCallback(async () => {
    if (useSupabaseForLighthouseData() && isSupabaseConfigured()) {
      try {
        const { data, error } = await getSupabase()
          .from('lighthouse_site_settings')
          .select('name,description')
          .eq('id', 1)
          .maybeSingle()
        if (!error && data) {
          setInfo({
            name: data.name?.trim() || DEFAULT_SITE_NAME,
            description: data.description ?? null,
          })
          return
        }
      } catch {
        /* fall through to API / defaults */
      }
    }
    try {
      const res = await fetch('/api/site')
      if (!res.ok) return
      const data = (await res.json()) as { name?: string; description?: string | null }
      setInfo({
        name: data.name?.trim() || DEFAULT_SITE_NAME,
        description: data.description ?? null,
      })
    } catch {
      /* offline or API down — keep defaults */
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const value = useMemo(() => info, [info])

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>
}

export function useSite() {
  return useContext(SiteContext)
}
