import { useEffect } from 'react'
import { useSite } from '../context/SiteContext'
import { SITE_BROWSER_TITLE, SITE_META_DESCRIPTION } from '../site'

/** Sets document title from {@link SITE_BROWSER_TITLE}. */
export function DocumentTitle() {
  const { description } = useSite()

  useEffect(() => {
    document.title = SITE_BROWSER_TITLE
  }, [])

  useEffect(() => {
    const meta = document.querySelector('meta[name="description"]')
    if (meta) {
      meta.setAttribute('content', description?.trim() || SITE_META_DESCRIPTION)
    }
  }, [description])

  return null
}
