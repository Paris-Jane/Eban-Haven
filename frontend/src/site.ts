/**
 * Public branding and contact (aligned with Eban Haven).
 *
 * Home hero/mission photos were previously hotlinked from media.base44.com; those URLs often stop
 * working (expired assets, host changes, or TLS issues). Prefer self-hosted files under
 * `frontend/public/images/` (e.g. `/images/home-hero.jpg`) for production.
 */
export const IMAGES = {
  /** Sunlight through trees — calm, hopeful; Unsplash (replace with `/images/...` for brand photos). */
  hero: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1920&q=80',
  mission:
    'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80',
  /** CTA / join section (reuse or swap for a campaign photo) */
  joinUs:
    'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80',
} as const

/**
 * Impact page visuals — same Unsplash sources as haven-hope-flow.base44.app /impact.
 * Swap to `/images/...` under public/ when you have licensed brand photography.
 */
export const IMPACT_PAGE_IMAGES = {
  hero: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=1600&q=80',
  quoteBreak: 'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=1600&q=80',
  lifeA: 'https://images.unsplash.com/photo-1526976668912-1a811878dd37?auto=format&fit=crop&w=800&q=80',
  lifeB: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80',
  finalCta: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=1400&q=80',
} as const

/** Display name in nav, footer, and body copy */
export const SITE_DISPLAY_NAME = 'Eban Haven'

/** Browser tab title */
export const SITE_BROWSER_TITLE = 'Eban Haven'

export const DEFAULT_SITE_NAME = SITE_DISPLAY_NAME

export const SITE_META_DESCRIPTION =
  'A comprehensive platform to manage survivor rehabilitation programs, track case outcomes, and provide transparent impact reporting for supporters.'

export const PUBLIC_CONTACT = {
  infoEmail: 'info@ebanhaven.org',
  privacyEmail: 'privacy@ebanhaven.org',
  accessibilityEmail: 'accessibility@ebanhaven.org',
  phone: '+233 XX XXX XXXX',
  addressLine: 'Ghana',
} as const

/** Footer / share — set to your live profiles */
export const SOCIAL_LINKS = {
  facebook: 'https://www.facebook.com/ebanhaven',
  instagram: 'https://www.instagram.com/ebanhaven',
  linkedin: 'https://www.linkedin.com/company/eban-haven',
  x: 'https://x.com/ebanhaven',
} as const
