/**
 * Public branding and contact (aligned with Eban Haven).
 *
 * Home hero/mission photos were previously hotlinked from media.base44.com; those URLs often stop
 * working (expired assets, host changes, or TLS issues). Prefer self-hosted files under
 * `frontend/public/images/` (e.g. `/images/home-hero.jpg`) for production.
 */
export const IMAGES = {
  /** Warm sunrise / hope — Unsplash (replace with `/images/...` when you have brand photos). */
  hero: 'https://images.unsplash.com/photo-1470252649370-9ba69227c16f?auto=format&fit=crop&w=1920&q=80',
  mission:
    'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80',
  /** CTA / join section (reuse or swap for a campaign photo) */
  joinUs:
    'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80',
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
