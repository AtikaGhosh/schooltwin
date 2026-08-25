'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import {
  Building2,
  ClipboardList,
  FileClock,
  HelpCircle,
  Home,
  Languages,
  MessageSquareWarning,
  type LucideIcon,
} from 'lucide-react'

import { useSchoolTwin } from '@/components/providers/schooltwin-provider'
import { ErrorState, LoadingState } from '@/components/primitives'
import { ThemeControl } from '@/components/theme-control'
import type { TranslationKey } from '@/lib/schooltwin/i18n'
import { cn } from '@/lib/utils'

const primaryNavigation: Array<{
  href: string
  label: TranslationKey
  icon: LucideIcon
}> = [
  { href: '/home', label: 'nav.home', icon: Home },
  { href: '/tasks', label: 'nav.work', icon: ClipboardList },
  { href: '/twin', label: 'nav.school', icon: Building2 },
  { href: '/report', label: 'nav.report', icon: MessageSquareWarning },
  { href: '/submissions', label: 'nav.history', icon: FileClock },
]

export function OperatorShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { ready, error, t } = useSchoolTwin()
  return (
    <div className="min-h-screen bg-transparent">
      <aside className="sidebar-premium border-sidebar-border/70 text-sidebar-foreground fixed inset-y-0 left-0 z-30 hidden w-56 border-r md:flex md:flex-col">
        <Brand />
        <nav aria-label="Primary" className="flex-1 space-y-1.5 px-3 py-6">
          {primaryNavigation.map((item) => (
            <NavigationLink key={item.href} item={item} pathname={pathname} />
          ))}
        </nav>
        <div className="border-sidebar-border/70 border-t p-3">
          <NavigationLink
            item={{ href: '/privacy', label: 'nav.help', icon: HelpCircle }}
            pathname={pathname}
          />
        </div>
      </aside>
      <div className="md:pl-56">
        <header className="bg-background/92 sticky top-0 z-20 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 md:px-8">
            <div className="flex items-center gap-2 md:hidden">
              <div>
                <Image
                  src="/drishtishala-logo.svg"
                  alt="DrishtiShala"
                  width={680}
                  height={200}
                  priority
                  className="h-auto w-32 dark:brightness-0 dark:invert"
                />
                <p className="text-muted-foreground hidden max-w-40 truncate text-[10px] min-[440px]:block">
                  Sundarpur Government High School
                </p>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2 md:hidden">
              <LanguageControl />
              <ThemeControl />
              <Link
                href="/privacy"
                aria-label={t('nav.help')}
                className="border-border flex size-11 items-center justify-center rounded-lg border"
              >
                <HelpCircle className="size-5" />
              </Link>
            </div>
            <div className="hidden w-full items-center justify-end gap-2 md:flex">
              <LanguageControl />
              <ThemeControl />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 pb-24 sm:px-6 md:px-8 md:py-9">
          <div key={pathname} className="page-enter">
            {error ? (
              <ErrorState message={error} />
            ) : ready ? (
              children
            ) : (
              <LoadingState />
            )}
          </div>
        </main>
      </div>
      <nav
        aria-label="Mobile primary"
        className="border-border bg-card/98 fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t px-1 pt-1 pb-[max(env(safe-area-inset-bottom),0.25rem)] shadow-[0_-4px_16px_rgba(15,23,42,0.06)] md:hidden"
      >
        {primaryNavigation.map((item) => (
          <MobileNavigationLink
            key={item.href}
            item={item}
            pathname={pathname}
          />
        ))}
      </nav>
    </div>
  )
}

function Brand() {
  return (
    <div className="border-sidebar-border/70 flex min-h-[73px] items-center border-b px-4 py-3">
      <div>
        <Image
          src="/drishtishala-logo.svg"
          alt="DrishtiShala"
          width={680}
          height={200}
          priority
          className="h-auto w-[172px] brightness-0 invert"
        />
        <p className="text-sidebar-foreground/60 mt-0.5 text-[10px]">
          Sundarpur Government High School
        </p>
      </div>
    </div>
  )
}

function LanguageControl({ dark = false }: { dark?: boolean }) {
  const { locale, setLocale, t } = useSchoolTwin()
  return (
    <div
      role="group"
      aria-label={t('language.label')}
      className={cn(
        'flex min-h-10 items-center rounded-lg p-1 text-xs font-semibold',
        dark
          ? 'bg-sidebar-accent text-sidebar-foreground/80'
          : 'bg-secondary text-muted-foreground',
      )}
    >
      <Languages className="mx-1.5 size-3.5" aria-hidden />
      {(['en', 'or'] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={locale === option}
          onClick={() => void setLocale(option)}
          className={cn(
            'quiet-action min-h-8 rounded-md px-2.5',
            locale === option
              ? dark
                ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                : 'bg-card text-foreground shadow-sm'
              : 'opacity-70 hover:opacity-100',
          )}
        >
          {option === 'en' ? 'English' : 'ଓଡ଼ିଆ'}
        </button>
      ))}
    </div>
  )
}

function NavigationLink({
  item,
  pathname,
}: {
  item: (typeof primaryNavigation)[number]
  pathname: string
}) {
  const { t } = useSchoolTwin()
  const active = isActivePath(pathname, item.href)
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'nav-interactive flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
        active
          ? 'nav-active text-sidebar-primary-foreground shadow-[inset_3px_0_0_var(--sidebar-ring)]'
          : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground',
      )}
    >
      <Icon className="size-4" />
      {t(item.label)}
    </Link>
  )
}

function MobileNavigationLink({
  item,
  pathname,
}: {
  item: (typeof primaryNavigation)[number]
  pathname: string
}) {
  const { t } = useSchoolTwin()
  const active = isActivePath(pathname, item.href)
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'mobile-nav-interactive flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-center text-[10px] leading-tight font-medium',
        active ? 'text-primary' : 'text-muted-foreground',
      )}
    >
      <Icon className="size-5" />
      {t(item.label)}
    </Link>
  )
}

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}
