'use client'

import { useRef, type KeyboardEvent } from 'react'
import { Check, MonitorCog, Moon, Sun } from 'lucide-react'

import { useSchoolTwin } from '@/components/providers/schooltwin-provider'
import { useTheme } from '@/components/providers/theme-provider'
import type { ThemePreference } from '@/lib/schooltwin/theme'
import { cn } from '@/lib/utils'

const options = [
  {
    value: 'light',
    label: 'appearance.light',
    description: 'appearance.useLight',
    icon: Sun,
  },
  {
    value: 'dark',
    label: 'appearance.dark',
    description: 'appearance.useDark',
    icon: Moon,
  },
  {
    value: 'system',
    label: 'appearance.system',
    description: 'appearance.useSystem',
    icon: MonitorCog,
  },
] as const

export function ThemeControl() {
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const { preference, resolvedTheme, setPreference } = useTheme()
  const { t } = useSchoolTwin()
  const TriggerIcon = resolvedTheme === 'dark' ? Moon : Sun

  function select(nextPreference: ThemePreference) {
    setPreference(nextPreference)
    detailsRef.current?.removeAttribute('open')
  }

  function navigateMenu(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        '[role="menuitemradio"]',
      ),
    )
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const direction = event.key === 'ArrowDown' ? 1 : -1
    buttons[(current + direction + buttons.length) % buttons.length]?.focus()
  }

  return (
    <details ref={detailsRef} className="group relative">
      <summary
        aria-label={t('appearance.change')}
        title={t('appearance.change')}
        className="border-border bg-card text-muted-foreground hover:text-foreground flex size-11 cursor-pointer list-none items-center justify-center rounded-lg border transition-colors [&::-webkit-details-marker]:hidden"
      >
        <TriggerIcon className="theme-icon-motion size-4.5" aria-hidden />
      </summary>
      <div
        role="menu"
        aria-label={t('appearance.title')}
        onKeyDown={navigateMenu}
        className="border-border bg-popover text-popover-foreground absolute top-[calc(100%+0.5rem)] right-0 z-50 w-64 rounded-xl border p-2 shadow-[var(--popover-shadow)]"
      >
        <p className="text-muted-foreground px-3 pt-2 pb-1 text-xs font-semibold">
          {t('appearance.title')}
        </p>
        {options.map((option) => {
          const Icon = option.icon
          const selected = preference === option.value
          return (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={selected}
              onClick={() => select(option.value)}
              className={cn(
                'flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors',
                selected
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-muted',
              )}
            >
              <Icon className="size-4.5 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">
                  {t(option.label)}
                </span>
                <span className="text-muted-foreground block text-xs">
                  {t(option.description)}
                </span>
              </span>
              {selected ? (
                <Check className="size-4 shrink-0" aria-hidden />
              ) : null}
            </button>
          )
        })}
      </div>
    </details>
  )
}
