import { useEffect } from 'react'
import { usePreferences } from '@/hooks/usePreferences'

const THEME_COLOR_LIGHT = '#4f645b'
const THEME_COLOR_DARK = '#1a1c1b'

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(resolved: 'light' | 'dark') {
  document.documentElement.setAttribute('data-theme', resolved)

  // Update <meta name="theme-color"> for browser chrome / PWA status bar
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', resolved === 'dark' ? THEME_COLOR_DARK : THEME_COLOR_LIGHT)
  }
}

/**
 * Reads the theme preference and applies `data-theme` to <html>.
 * Listens for system theme changes when set to 'system'.
 */
export function useTheme() {
  const { preferences } = usePreferences()

  useEffect(() => {
    const { theme } = preferences

    if (theme === 'light' || theme === 'dark') {
      applyTheme(theme)
      return
    }

    // System mode — apply current system pref and listen for changes
    applyTheme(getSystemTheme())

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      applyTheme(e.matches ? 'dark' : 'light')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [preferences.theme])
}
