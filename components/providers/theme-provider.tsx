'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  applyTheme,
  isThemePreference,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from '@/lib/schooltwin/theme'

interface ThemeContextValue {
  preference: ThemePreference
  resolvedTheme: ResolvedTheme
  setPreference: (preference: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function systemQuery(): MediaQueryList {
  return window.matchMedia('(prefers-color-scheme: dark)')
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system')
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light')

  useEffect(() => {
    const query = systemQuery()
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    const initialPreference = isThemePreference(stored) ? stored : 'system'
    const initialization = window.setTimeout(() => {
      setPreferenceState(initialPreference)
      setResolvedTheme(applyTheme(initialPreference, query.matches))
    }, 0)

    const handleSystemChange = (event: MediaQueryListEvent) => {
      const current = document.documentElement.dataset.themePreference
      if (current === 'system') {
        setResolvedTheme(applyTheme('system', event.matches))
      }
    }
    query.addEventListener('change', handleSystemChange)
    return () => {
      window.clearTimeout(initialization)
      query.removeEventListener('change', handleSystemChange)
    }
  }, [])

  const setPreference = useCallback((nextPreference: ThemePreference) => {
    window.localStorage.setItem(THEME_STORAGE_KEY, nextPreference)
    setPreferenceState(nextPreference)
    setResolvedTheme(applyTheme(nextPreference, systemQuery().matches))
  }, [])

  const value = useMemo(
    () => ({ preference, resolvedTheme, setPreference }),
    [preference, resolvedTheme, setPreference],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used within ThemeProvider.')
  return value
}
