import { useEffect, useState } from 'react'
import { Palette } from 'lucide-react'

const COOKIE_NAME = 'haven_theme'
const DEFAULT_THEME = 'warm'

function readThemeCookie(): string {
  if (typeof document === 'undefined') return DEFAULT_THEME

  const match = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${COOKIE_NAME}=`))

  return match?.split('=')[1] ?? DEFAULT_THEME
}

function applyTheme(theme: string) {
  document.documentElement.dataset.theme = theme
  document.cookie = `${COOKIE_NAME}=${theme}; path=/; max-age=31536000; SameSite=Lax`
}

export function ThemeToggle() {
  const [theme, setTheme] = useState(DEFAULT_THEME)

  useEffect(() => {
    const cookieTheme = readThemeCookie()
    setTheme(cookieTheme)
    applyTheme(cookieTheme)
  }, [])

  function toggleTheme() {
    const nextTheme = theme === 'warm' ? 'ocean' : 'warm'
    setTheme(nextTheme)
    applyTheme(nextTheme)
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      aria-label="Toggle theme preference"
      title="Toggle theme preference"
    >
      <Palette className="h-4 w-4" />
      <span>{theme === 'warm' ? 'Ocean theme' : 'Warm theme'}</span>
    </button>
  )
}
