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

import { SystemClock } from '@/lib/schooltwin/adapters/browser'
import type { Clock } from '@/lib/schooltwin/adapters/interfaces'
import { IndexedDbSchoolTwinRepository } from '@/lib/schooltwin/repository/indexeddb'
import { ProductionSchoolTwinRepository } from '@/lib/schooltwin/repository/production'
import { getSchoolTwinMode } from '@/lib/schooltwin/backend/config'
import type { SchoolTwinRepository } from '@/lib/schooltwin/repository/types'
import {
  INTL_LOCALES,
  translate,
  type TranslationKey,
  type UiLocale,
} from '@/lib/schooltwin/i18n'

interface SchoolTwinContextValue {
  repository: SchoolTwinRepository
  clock: Clock
  ready: boolean
  error: string | null
  revision: number
  refresh: () => void
  locale: UiLocale
  intlLocale: 'en-IN' | 'or-IN'
  setLocale: (locale: UiLocale) => Promise<void>
  t: (key: TranslationKey, values?: Record<string, string | number>) => string
}

const SchoolTwinContext = createContext<SchoolTwinContextValue | null>(null)

export function SchoolTwinProvider({ children }: { children: ReactNode }) {
  const [repository] = useState<SchoolTwinRepository>(() =>
    getSchoolTwinMode() === 'production'
      ? new ProductionSchoolTwinRepository()
      : new IndexedDbSchoolTwinRepository(),
  )
  const [clock] = useState<Clock>(() => new SystemClock())
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [locale, setLocaleState] = useState<UiLocale>('en')
  const refresh = useCallback(() => setRevision((value) => value + 1), [])

  useEffect(() => {
    let active = true
    repository
      .initialize()
      .then(async () => {
        const storedLocale = await repository.getUiLocale()
        if (active) {
          setLocaleState(storedLocale)
          setReady(true)
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'The local SchoolTwin workspace could not be opened.',
          )
        }
      })
    return () => {
      active = false
    }
  }, [repository])

  useEffect(() => {
    if (!(repository instanceof ProductionSchoolTwinRepository)) return
    const synchronize = () => {
      void repository
        .synchronize()
        .then(refresh)
        .catch(() => undefined)
    }
    window.addEventListener('online', synchronize)
    return () => window.removeEventListener('online', synchronize)
  }, [refresh, repository])

  useEffect(() => {
    document.documentElement.lang = INTL_LOCALES[locale]
  }, [locale])

  const setLocale = useCallback(
    async (nextLocale: UiLocale) => {
      await repository.saveUiLocale(nextLocale)
      setLocaleState(nextLocale)
    },
    [repository],
  )
  const t = useCallback(
    (key: TranslationKey, values?: Record<string, string | number>) =>
      translate(locale, key, values),
    [locale],
  )
  const value = useMemo(
    () => ({
      repository,
      clock,
      ready,
      error,
      revision,
      refresh,
      locale,
      intlLocale: INTL_LOCALES[locale],
      setLocale,
      t,
    }),
    [repository, clock, ready, error, revision, refresh, locale, setLocale, t],
  )

  return (
    <SchoolTwinContext.Provider value={value}>
      {children}
    </SchoolTwinContext.Provider>
  )
}

export function useSchoolTwin(): SchoolTwinContextValue {
  const value = useContext(SchoolTwinContext)
  if (!value) {
    throw new Error('useSchoolTwin must be used within SchoolTwinProvider.')
  }
  return value
}
