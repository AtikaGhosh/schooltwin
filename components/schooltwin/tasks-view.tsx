'use client'

import Link from 'next/link'
import { ArrowLeft, ArrowRight, ChevronDown } from 'lucide-react'

import { useSchoolTwin } from '@/components/providers/schooltwin-provider'
import {
  Card,
  ErrorState,
  LoadingState,
  TaskStatusBadge,
} from '@/components/primitives'
import { CoverageMatrix } from '@/components/schooltwin/coverage-matrix'
import { isProductionMode } from '@/lib/schooltwin/backend/config'
import { formatTime, workLabel } from '@/components/schooltwin/home-view'
import type { TodayWorkItem } from '@/lib/schooltwin/domain/today-work'
import { toTodayWorkView } from '@/lib/schooltwin/domain/today-work'
import { deriveTaskStatus } from '@/lib/schooltwin/domain/task-state'
import { useNow } from '@/lib/schooltwin/hooks/use-now'
import { useWorkspace } from '@/lib/schooltwin/hooks/use-workspace'

export function TasksView() {
  const workspace = useWorkspace()
  const { t, intlLocale } = useSchoolTwin()
  const now = useNow()
  if (workspace.loading || !workspace.data)
    return workspace.error ? (
      <ErrorState message={workspace.error} />
    ) : (
      <LoadingState />
    )
  const { coverage, tasks, areas } = workspace.data
  const work = toTodayWorkView({
    coverage,
    tasks,
    now,
    areaNames: Object.fromEntries(areas.map((area) => [area.id, area.name])),
  })
  return (
    <div className="space-y-7">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">
          {t('work.title')}
        </h1>
        <p className="text-muted-foreground mt-2">{t('work.subtitle')}</p>
      </header>
      <WorkGroup
        title={t('work.doNow')}
        items={work.doNow}
        locale={intlLocale}
      />
      <WorkGroup
        title={t('work.notOpenYet')}
        items={work.notOpenYet}
        locale={intlLocale}
      />
      <WorkGroup
        title={t('work.notDone')}
        items={work.notDone}
        locale={intlLocale}
        notDone
      />
      <details className="surface-shadow group bg-card overflow-clip rounded-[0.875rem]">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-5 font-semibold">
          {t('work.doneToday')}{' '}
          <span className="flex items-center gap-2 text-sm">
            {work.done.length}
            <ChevronDown className="accordion-chevron size-4 group-open:rotate-180" />
          </span>
        </summary>
        <div className="border-border grid gap-2 border-t p-4 sm:grid-cols-2">
          {work.done.map((item) => (
            <WorkItem key={item.id} item={item} locale={intlLocale} compact />
          ))}
        </div>
      </details>
      <details className="surface-shadow group bg-card overflow-clip rounded-[0.875rem]">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-5 font-semibold">
          {t('work.allClasses')}{' '}
          <ChevronDown className="accordion-chevron size-4 group-open:rotate-180" />
        </summary>
        <div className="border-border border-t p-4">
          <CoverageMatrix coverage={coverage} />
        </div>
      </details>
    </div>
  )
}

function WorkGroup({
  title,
  items,
  locale,
  notDone = false,
}: {
  title: string
  items: TodayWorkItem[]
  locale: string
  notDone?: boolean
}) {
  if (!items.length) return null
  return (
    <section className="space-y-3">
      <h2
        className={
          notDone
            ? 'text-attention text-lg font-semibold'
            : 'text-lg font-semibold'
        }
      >
        {title}
      </h2>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <WorkItem
            key={item.id}
            item={item}
            locale={locale}
            notDone={notDone}
          />
        ))}
      </div>
    </section>
  )
}

function WorkItem({
  item,
  locale,
  notDone = false,
  compact = false,
}: {
  item: TodayWorkItem
  locale: string
  notDone?: boolean
  compact?: boolean
}) {
  const { t } = useSchoolTwin()
  const demoMode = !isProductionMode()
  const content = (
    <>
      <div>
        <p className="font-semibold">
          {item.sectionName ?? item.areaName ?? t('task.facilityCheck')}
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          {workLabel(item, t)}
        </p>
        {!compact ? (
          <p
            className={
              notDone
                ? 'text-attention mt-2 text-xs font-medium'
                : 'text-muted-foreground mt-2 text-xs'
            }
          >
            {notDone
              ? t('work.windowMissed')
              : item.status === 'not_open_yet'
                ? t('common.notOpenYet')
                : demoMode
                  ? t('work.availableAnytime')
                  : t('work.completeBefore', {
                      time: formatTime(item.scheduledEnd, locale),
                    })}
          </p>
        ) : null}
      </div>
      {!notDone && item.status !== 'done' ? (
        <ArrowRight className="text-primary size-5 shrink-0" />
      ) : null}
    </>
  )
  return item.status === 'do_now' ? (
    <Link
      href={item.href}
      className="pressable elevated-surface flex min-h-20 items-center justify-between gap-3 rounded-xl p-4"
    >
      {content}
    </Link>
  ) : (
    <div
      className={`flex min-h-16 items-center justify-between gap-3 rounded-xl p-4 ${notDone ? 'status-missed ring-attention/25 ring-1' : 'bg-card'}`}
    >
      {content}
    </div>
  )
}

export function TaskDetailView({ taskId }: { taskId: string }) {
  const workspace = useWorkspace()
  const now = useNow(10_000)
  const { t, intlLocale } = useSchoolTwin()
  const demoMode = !isProductionMode()
  if (workspace.loading || !workspace.data)
    return workspace.error ? (
      <ErrorState message={workspace.error} />
    ) : (
      <LoadingState />
    )
  const task = workspace.data.tasks.find((item) => item.id === taskId)
  if (!task)
    return (
      <Card className="p-8 text-center">
        <h1 className="text-lg font-semibold">Task not found</h1>
        <Link
          href="/tasks"
          className="text-primary mt-4 inline-flex min-h-12 items-center"
        >
          Back to today’s work
        </Link>
      </Card>
    )
  const status = deriveTaskStatus(task, now)
  const item = workspace.data.work.done
    .concat(
      workspace.data.work.doNow,
      workspace.data.work.notOpenYet,
      workspace.data.work.notDone,
    )
    .find((candidate) => candidate.id === task.id)
  return (
    <div className="space-y-5">
      <Link
        href="/tasks"
        className="text-muted-foreground inline-flex min-h-12 items-center gap-2 text-sm font-semibold"
      >
        <ArrowLeft className="size-4" />
        {t('nav.work')}
      </Link>
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-sm">
              {item?.sectionName ?? item?.areaName}
            </p>
            <h1 className="mt-1 text-2xl font-semibold">
              {item ? workLabel(item, t) : task.title}
            </h1>
          </div>
          <TaskStatusBadge status={status} />
        </div>
        <p className="text-muted-foreground mt-4 text-sm">
          {item
            ? demoMode
              ? t('work.availableAnytime')
              : t('work.completeBefore', {
                  time: formatTime(item.scheduledEnd, intlLocale),
                })
            : ''}
        </p>
        {status === 'available' || status === 'in_progress' ? (
          <Link
            href={`/capture/${task.id}`}
            className="primary-action mt-6 inline-flex min-h-12 items-center gap-2 rounded-lg px-5 font-semibold"
          >
            {t('home.recordNow')}
            <ArrowRight className="size-4" />
          </Link>
        ) : null}
      </Card>
    </div>
  )
}
