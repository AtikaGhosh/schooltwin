'use client'

import Link from 'next/link'
import {
  ArrowRight,
  Camera,
  Check,
  ClipboardCheck,
  Clock3,
  LockKeyhole,
} from 'lucide-react'

import { useSchoolTwin } from '@/components/providers/schooltwin-provider'
import { Card, ErrorState, LoadingState } from '@/components/primitives'
import { isProductionMode } from '@/lib/schooltwin/backend/config'
import type { TodayWorkItem } from '@/lib/schooltwin/domain/today-work'
import { toTodayWorkView } from '@/lib/schooltwin/domain/today-work'
import { useNow } from '@/lib/schooltwin/hooks/use-now'
import { useWorkspace } from '@/lib/schooltwin/hooks/use-workspace'

export function HomeView() {
  const workspace = useWorkspace()
  const now = useNow()
  const { t, intlLocale } = useSchoolTwin()
  const demoMode = !isProductionMode()
  if (workspace.loading || !workspace.data)
    return workspace.error ? (
      <ErrorState message={workspace.error} />
    ) : (
      <LoadingState />
    )

  const { school, coverage, tasks, areas } = workspace.data
  const work = toTodayWorkView({
    coverage,
    tasks,
    now,
    areaNames: Object.fromEntries(areas.map((area) => [area.id, area.name])),
  })
  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-[1.45rem] leading-tight font-semibold tracking-[-0.025em] sm:text-[1.7rem] lg:text-[2rem]">
          {school.name}
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          {new Intl.DateTimeFormat(intlLocale, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          }).format(now)}
        </p>
        <p className="text-muted-foreground mt-3 text-sm">
          {demoMode ? (
            <span className="font-medium">{t('home.demoAnytime')}</span>
          ) : (
            <>
              <span className="font-medium">{t('home.schoolHours')}</span>{' '}
              {formatSchoolHours(
                work.done[0]?.scheduledStart ??
                  work.notOpenYet[0]?.scheduledStart ??
                  work.doNow[0]?.scheduledStart,
                work.done[0]?.scheduledEnd ??
                  work.notOpenYet[0]?.scheduledEnd ??
                  work.doNow[0]?.scheduledEnd,
                intlLocale,
                school.timeZone,
              )}
            </>
          )}
        </p>
      </header>

      <section aria-labelledby="today-heading" className="max-w-3xl">
        <p
          id="today-heading"
          className="text-muted-foreground text-sm font-medium"
        >
          {greeting(now, intlLocale)}
        </p>
        <p className="mt-2 text-2xl font-semibold tracking-tight sm:text-[1.7rem]">
          {t('home.checksDone', {
            completed: work.completed,
            total: work.total,
          })}
        </p>
        <div className="mt-4 flex items-center gap-3">
          <div
            className="bg-muted h-2 flex-1 overflow-hidden rounded-full"
            aria-hidden
          >
            <div
              className="gradient-progress h-full rounded-full motion-reduce:transition-none"
              style={{
                width: `${Math.round((work.completed / work.total) * 100)}%`,
              }}
            />
          </div>
          <span className="text-muted-foreground text-xs font-semibold tabular-nums">
            {Math.round((work.completed / work.total) * 100)}%
          </span>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          {t('home.leftToday', { count: work.remaining })}
          {work.notDone.length ? (
            <>
              {' '}
              ·{' '}
              <span className="text-attention font-semibold">
                {t('home.missed', { count: work.notDone.length })}
              </span>
            </>
          ) : null}
        </p>
        <p className="text-muted-foreground mt-2 text-sm font-medium">
          {demoMode
            ? t('work.availableAnytime')
            : t('home.completeBefore', {
                time: formatTime(
                  work.done[0]?.scheduledEnd ??
                    work.notOpenYet[0]?.scheduledEnd ??
                    work.doNow[0]?.scheduledEnd,
                  intlLocale,
                ),
              })}
        </p>
      </section>

      {work.next ? (
        <NextCard item={work.next} />
      ) : work.notOpenYet.length ? (
        <Card className="p-6">
          <p className="font-semibold">{t('common.notOpenYet')}</p>
          <p className="text-muted-foreground mt-1 text-sm">
            {t('home.opensAt', {
              time: formatTime(work.notOpenYet[0].scheduledStart, intlLocale),
            })}
          </p>
        </Card>
      ) : null}

      {work.doNow.length > 1 ? (
        <section className="space-y-3" aria-labelledby="do-now-heading">
          <div className="flex items-center justify-between gap-4">
            <h2 id="do-now-heading" className="text-lg font-semibold">
              {t('home.additional')}
            </h2>
            <Link
              href="/tasks"
              className="quiet-action text-primary inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold"
            >
              {t('home.seeAll')} <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="surface-shadow bg-card divide-border/60 divide-y overflow-hidden rounded-[0.875rem]">
            {work.doNow.slice(1, 5).map((item) => (
              <WorkRow key={item.id} item={item} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3" aria-labelledby="progress-heading">
        <h2 id="progress-heading" className="text-lg font-semibold">
          {t('home.progress')}
        </h2>
        <div className="max-w-3xl space-y-5">
          <ProgressRow
            label={t('task.classCheck')}
            completed={coverage.classPulseSubmitted}
            total={coverage.totalSections}
          />
          <ProgressRow
            label={t('task.classVideo')}
            completed={coverage.liveEvidenceSubmitted}
            total={coverage.totalSections}
          />
          <ProgressRow
            label={t('task.facilityCheck')}
            value={
              coverage.facilityPulse.status === 'submitted'
                ? t('common.done')
                : coverage.facilityPulse.status === 'missed' ||
                    coverage.facilityPulse.status === 'failed'
                  ? t('common.notDone')
                  : coverage.facilityPulse.status === 'scheduled'
                    ? t('common.notOpenYet')
                    : t('common.doNow')
            }
            done={coverage.facilityPulse.status === 'submitted'}
          />
        </div>
        <Card className="border-0 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <LockKeyhole className="text-muted-foreground size-4" />
                <h3 className="font-semibold">{t('task.studentPrivate')}</h3>
                <span className="bg-primary/10 text-primary rounded-full px-2 py-1 text-[10px] font-bold uppercase">
                  {t('common.private')}
                </span>
              </div>
              <p className="mt-2 text-sm">
                {coverage.privateStudentSampling === 'completed'
                  ? t('common.done')
                  : t('student.ready')}
              </p>
              <p className="text-muted-foreground mt-1 max-w-xl text-xs">
                {t('student.privacy')}
              </p>
            </div>
            {coverage.privateStudentSampling !== 'completed' ? (
              <Link
                href="/pulse"
                className="primary-action inline-flex min-h-12 items-center rounded-lg px-5 text-sm font-semibold"
              >
                {t('student.startMode')}
              </Link>
            ) : (
              <span className="text-stable inline-flex min-h-12 items-center gap-2 font-semibold">
                <Check className="size-5" /> {t('common.done')}
              </span>
            )}
          </div>
        </Card>
      </section>
    </div>
  )
}

function NextCard({ item }: { item: TodayWorkItem }) {
  const { t, intlLocale } = useSchoolTwin()
  const demoMode = !isProductionMode()
  return (
    <Card className="premium-next overflow-hidden">
      <div className="p-5 sm:p-7">
        <p className="text-primary text-sm font-semibold">{t('home.next')}</p>
        <div className="mt-4 flex items-start gap-4">
          <span className="brand-mark text-primary-foreground flex size-11 shrink-0 items-center justify-center rounded-xl">
            {item.kind.includes('video') ? (
              <Camera className="size-5" />
            ) : (
              <ClipboardCheck className="size-5" />
            )}
          </span>
          <div>
            <p className="text-xl font-semibold sm:text-2xl">
              {item.sectionName ?? item.areaName}
            </p>
            <p className="text-muted-foreground mt-1 text-base sm:text-lg">
              {workLabel(item, t)}
            </p>
          </div>
        </div>
        <p className="text-muted-foreground mt-3 flex items-center gap-2 text-sm">
          <Clock3 className="size-4" />
          {demoMode
            ? t('work.availableAnytime')
            : t('work.completeBefore', {
                time: formatTime(item.scheduledEnd, intlLocale),
              })}
        </p>
        <Link
          href={item.href}
          className="primary-action mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold sm:w-auto"
        >
          <Camera className="size-4" />
          {item.kind.includes('video')
            ? t('home.recordNow')
            : t('common.start')}
        </Link>
      </div>
    </Card>
  )
}

function WorkRow({ item }: { item: TodayWorkItem }) {
  const { t } = useSchoolTwin()
  return (
    <Link
      href={item.href}
      className="quiet-action hover:bg-primary/[0.025] flex min-h-20 items-center justify-between gap-4 px-4 py-3.5 sm:px-5"
    >
      <div className="flex items-center gap-3.5">
        <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
          {item.kind.includes('video') ? (
            <Camera className="size-4" />
          ) : (
            <ClipboardCheck className="size-4" />
          )}
        </span>
        <div>
          <p className="font-semibold">
            {item.sectionName ?? item.areaName ?? t('task.facilityCheck')}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {workLabel(item, t)}
          </p>
        </div>
      </div>
      <ArrowRight className="text-primary size-5" />
    </Link>
  )
}

function ProgressRow({
  label,
  value,
  done = false,
  completed,
  total,
}: {
  label: string
  value?: string
  done?: boolean
  completed?: number
  total?: number
}) {
  const countValue = completed !== undefined && total !== undefined
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        <span
          className={
            done ? 'text-stable' : 'text-foreground text-sm font-semibold'
          }
        >
          {done ? (
            <span className="flex items-center gap-1.5">
              <Check className="size-4" />
              {value}
            </span>
          ) : countValue ? (
            `${completed} of ${total} done`
          ) : (
            value
          )}
        </span>
      </div>
      {countValue ? (
        <div className="bg-muted mt-2 h-1.5 overflow-hidden rounded-full">
          <div
            className="gradient-progress h-full rounded-full motion-reduce:transition-none"
            style={{ width: `${(completed / total) * 100}%` }}
          />
        </div>
      ) : null}
    </div>
  )
}

function greeting(now: Date, locale: string): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-IN', {
      hour: 'numeric',
      hourCycle: 'h23',
      timeZone: 'Asia/Kolkata',
    }).format(now),
  )
  if (locale === 'or-IN')
    return hour < 12 ? 'ଶୁଭ ସକାଳ' : hour < 17 ? 'ନମସ୍କାର' : 'ଶୁଭ ସନ୍ଧ୍ୟା'
  return hour < 12
    ? 'Good morning'
    : hour < 17
      ? 'Good afternoon'
      : 'Good evening'
}

type T = ReturnType<typeof useSchoolTwin>['t']
export function workLabel(item: TodayWorkItem, t: T): string {
  if (item.kind === 'class_check') return t('task.classCheck')
  if (item.kind === 'class_video') return t('task.classVideo')
  if (item.kind === 'facility_check') return t('task.facilityCheck')
  return t('task.facilityVideo')
}

export function formatWindow(item: TodayWorkItem, locale: string): string {
  const formatter = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${formatter.format(new Date(item.scheduledStart))} – ${formatter.format(new Date(item.scheduledEnd))}`
}

export function formatTime(
  value: string | undefined,
  locale: string,
  timeZone = 'Asia/Kolkata',
): string {
  if (!value) return ''
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(new Date(value))
}

function formatSchoolHours(
  opening: string | undefined,
  closing: string | undefined,
  locale: string,
  timeZone: string,
) {
  return `${formatTime(opening, locale, timeZone)} – ${formatTime(closing, locale, timeZone)}`
}
