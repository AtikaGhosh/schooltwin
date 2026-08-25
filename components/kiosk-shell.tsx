'use client'

import type { ReactNode } from 'react'
import { LockKeyhole, Waypoints } from 'lucide-react'

import { useSchoolTwin } from '@/components/providers/schooltwin-provider'
import { ErrorState, LoadingState } from '@/components/primitives'

export function KioskShell({ children }: { children: ReactNode }) {
  const { ready, error, locale } = useSchoolTwin()
  return (
    <div className="kiosk-environment min-h-screen">
      <header className="bg-transparent">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-5 sm:px-8">
          <div className="flex items-center gap-2.5">
            <span className="brand-mark text-primary-foreground flex size-9 items-center justify-center rounded-lg">
              <Waypoints className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">SchoolTwin</p>
              <p className="text-muted-foreground text-[11px]">
                {locale === 'or'
                  ? 'ଗୋପନୀୟ ଅଂଶଗ୍ରହଣ ପୃଷ୍ଠା'
                  : 'Private participant screen'}
              </p>
            </div>
          </div>
          <span className="text-muted-foreground inline-flex items-center gap-1.5 px-1 text-xs">
            <LockKeyhole className="size-3.5" />{' '}
            {locale === 'or' ? 'ଗୋପନୀୟ' : 'Private'}
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-4 sm:px-8 sm:py-8">
        {error ? (
          <ErrorState message={error} />
        ) : ready ? (
          children
        ) : (
          <LoadingState />
        )}
      </main>
    </div>
  )
}
