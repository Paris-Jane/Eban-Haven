import { useEffect, useId, useState } from 'react'
import { useLocation } from 'react-router-dom'

declare global {
  interface Window {
    google?: {
      translate?: {
        TranslateElement: {
          new (
            options: {
              pageLanguage: string
              includedLanguages: string
              autoDisplay?: boolean
              multilanguagePage?: boolean
            },
            elementId: string,
          ): unknown
          InlineLayout: {
            SIMPLE: unknown
          }
        }
      }
    }
    googleTranslateElementInit?: () => void
    __havenGoogleTranslateReady?: boolean
    __havenGoogleTranslatePromise?: Promise<void>
  }
}

const STORAGE_KEY = 'haven_selected_language'
const SCRIPT_ID = 'google-translate-script'
const ELEMENT_ID = 'google_translate_element'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

const languageOptions = [
  { code: 'en', label: 'English' },
  { code: 'ak', label: 'Akan' },
  { code: 'tw', label: 'Twi' },
  { code: 'ee', label: 'Ewe' },
  { code: 'gaa', label: 'Ga' },
  { code: 'dag', label: 'Dagbani' },
  { code: 'ha', label: 'Hausa' },
  { code: 'fr', label: 'French' },
] as const

type SupportedLanguageCode = (typeof languageOptions)[number]['code']

function isSupportedLanguage(value: string | null): value is SupportedLanguageCode {
  return languageOptions.some((language) => language.code === value)
}

function setGoogleTranslateCookie(language: SupportedLanguageCode) {
  const value = language === 'en' ? '/auto/en' : `/auto/${language}`
  document.cookie = `googtrans=${value}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
}

function clearGoogleTranslateCookie() {
  document.cookie = 'googtrans=; path=/; max-age=0; SameSite=Lax'
}

function getStoredLanguage(): SupportedLanguageCode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isSupportedLanguage(stored) ? stored : 'en'
  } catch {
    return 'en'
  }
}

function storeLanguage(language: SupportedLanguageCode) {
  try {
    localStorage.setItem(STORAGE_KEY, language)
  } catch {
    /* ignore storage errors */
  }
}

function getGoogleTranslateCombo() {
  return document.querySelector<HTMLSelectElement>('.goog-te-combo')
}

function triggerGoogleTranslate(language: SupportedLanguageCode) {
  const combo = getGoogleTranslateCombo()
  if (!combo) {
    return false
  }

  combo.value = language
  combo.dispatchEvent(new Event('change', { bubbles: true }))
  return true
}

async function ensureGoogleTranslateLoaded() {
  if (typeof window === 'undefined') {
    return
  }

  if (window.__havenGoogleTranslateReady) {
    return
  }

  if (window.__havenGoogleTranslatePromise) {
    await window.__havenGoogleTranslatePromise
    return
  }

  window.__havenGoogleTranslatePromise = new Promise<void>((resolve) => {
    window.googleTranslateElementInit = () => {
      if (!window.google?.translate?.TranslateElement) {
        resolve()
        return
      }

      const host = document.getElementById(ELEMENT_ID)
      if (host && host.childElementCount === 0) {
        new window.google.translate.TranslateElement(
          {
            pageLanguage: 'en',
            includedLanguages: languageOptions
              .filter((language) => language.code !== 'en')
              .map((language) => language.code)
              .join(','),
            autoDisplay: false,
            multilanguagePage: true,
          },
          ELEMENT_ID,
        )
      }

      window.__havenGoogleTranslateReady = true
      resolve()
    }

    const existingScript = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
    if (existingScript) {
      if (window.google?.translate?.TranslateElement) {
        window.googleTranslateElementInit?.()
      }
      return
    }

    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit'
    script.async = true
    script.onerror = () => resolve()
    document.body.appendChild(script)
  })

  await window.__havenGoogleTranslatePromise
}

function applySelectedLanguage(language: SupportedLanguageCode) {
  if (language === 'en') {
    clearGoogleTranslateCookie()
    return
  }

  setGoogleTranslateCookie(language)
  const translated = triggerGoogleTranslate(language)

  if (!translated) {
    window.setTimeout(() => {
      triggerGoogleTranslate(language)
    }, 250)
  }
}

type GoogleTranslateProps = {
  variant?: 'footer' | 'admin'
}

export function GoogleTranslate({ variant = 'footer' }: GoogleTranslateProps) {
  const location = useLocation()
  const selectId = useId()
  const [language, setLanguage] = useState<SupportedLanguageCode>(() => getStoredLanguage())

  useEffect(() => {
    void ensureGoogleTranslateLoaded().then(() => {
      if (getStoredLanguage() !== 'en') {
        applySelectedLanguage(getStoredLanguage())
      }
    })
  }, [])

  useEffect(() => {
    if (language === 'en') {
      return
    }

    const timer = window.setTimeout(() => {
      applySelectedLanguage(language)
    }, 150)

    return () => window.clearTimeout(timer)
  }, [language, location.pathname, location.search])

  function onLanguageChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextLanguage = event.target.value as SupportedLanguageCode
    setLanguage(nextLanguage)
    storeLanguage(nextLanguage)

    if (nextLanguage === 'en') {
      clearGoogleTranslateCookie()
      window.location.reload()
      return
    }

    applySelectedLanguage(nextLanguage)
  }

  const wrapperClassName =
    variant === 'admin'
      ? 'flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 shadow-sm'
      : 'rounded-2xl border border-border bg-background/70 p-4 shadow-sm backdrop-blur-sm'

  const labelClassName =
    variant === 'admin'
      ? 'text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground'
      : 'text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground'

  return (
    <div className={wrapperClassName}>
      <div className="min-w-0 flex-1">
        <label htmlFor={selectId} className={labelClassName}>
          Language
        </label>
        <div className={variant === 'admin' ? 'mt-1' : 'mt-2'}>
          <select
            id={selectId}
            value={language}
            onChange={onLanguageChange}
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            aria-label="Choose website language"
          >
            {languageOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Powered by Google Translate. Your selection stays active as you move between pages.
        </p>
      </div>
      <div id={ELEMENT_ID} className="google-translate-host" aria-hidden />
    </div>
  )
}
