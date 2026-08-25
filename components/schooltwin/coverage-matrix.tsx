'use client'

import Link from 'next/link'
import { CheckCircle2, Circle, Clock3, TriangleAlert } from 'lucide-react'

import { useSchoolTwin } from '@/components/providers/schooltwin-provider'
import type {
  OperatorDailyCoverageView,
  OperatorCoverageRow,
} from '@/lib/schooltwin/domain/daily-coverage'
import type { DerivedTaskStatus } from '@/lib/schooltwin/domain/types'

export function CoverageMatrix({
  coverage,
  limit,
}: {
  coverage: OperatorDailyCoverageView
  limit?: number
}) {
  const { t } = useSchoolTwin()
  const rows = limit ? coverage.rows.slice(0, limit) : coverage.rows
  return (
    <div>
      <div className="surface-shadow bg-card hidden overflow-hidden rounded-[0.875rem] md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/45 text-muted-foreground">
            <tr>
              <th className="px-4 py-3">{localeClass(t)}</th>
              <th className="px-4 py-3">{t('task.classCheck')}</th>
              <th className="px-4 py-3">{t('task.classVideo')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <CoverageRow key={row.sectionId} row={row} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 md:hidden">
        {rows.map((row) => (
          <div
            key={row.sectionId}
            className={`rounded-xl p-4 ${isIncomplete(row) ? 'bg-primary/[0.045] ring-primary/10 ring-1' : 'surface-shadow bg-card'}`}
          >
            <p className="font-semibold">{row.sectionName}</p>
            <div className="mt-3 grid min-w-0 grid-cols-2 gap-2">
              <StatusBlock
                label={t('task.classCheck')}
                status={row.classPulse.status}
                href={`/school-pulse/${row.classPulse.sessionId}`}
              />
              <StatusBlock
                label={t('task.classVideo')}
                status={row.liveEvidence.status}
                href={`/tasks/${row.liveEvidence.taskId}`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function localeClass(t: ReturnType<typeof useSchoolTwin>['t']) {
  return t('school.title') === 'Our School' ? 'Class' : 'ଶ୍ରେଣୀ'
}
function CoverageRow({ row }: { row: OperatorCoverageRow }) {
  return (
    <tr
      className={isIncomplete(row) ? 'bg-primary/[0.04]' : 'hover:bg-muted/25'}
    >
      <th scope="row" className="px-4 py-3 font-semibold">
        {row.sectionName}
      </th>
      <td className="px-4 py-3">
        <Status
          status={row.classPulse.status}
          href={`/school-pulse/${row.classPulse.sessionId}`}
        />
      </td>
      <td className="px-4 py-3">
        <Status
          status={row.liveEvidence.status}
          href={`/tasks/${row.liveEvidence.taskId}`}
        />
      </td>
    </tr>
  )
}
function isIncomplete(row: OperatorCoverageRow): boolean {
  return (
    row.classPulse.status !== 'submitted' ||
    row.liveEvidence.status !== 'submitted'
  )
}
function StatusBlock({
  label,
  status,
  href,
}: {
  label: string
  status: DerivedTaskStatus
  href: string
}) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground text-xs">{label}</p>
      <div className="mt-1">
        <Status status={status} href={href} />
      </div>
    </div>
  )
}
function Status({ status, href }: { status: DerivedTaskStatus; href: string }) {
  const { t } = useSchoolTwin()
  const meta =
    status === 'submitted'
      ? {
          label: t('common.done'),
          icon: CheckCircle2,
          color: 'status-done',
        }
      : status === 'missed' || status === 'failed'
        ? {
            label: t('common.notDone'),
            icon: TriangleAlert,
            color: 'status-missed',
          }
        : status === 'available' || status === 'in_progress'
          ? {
              label: t('common.doNow'),
              icon: Clock3,
              color: 'status-now',
            }
          : {
              label: t('common.notOpenYet'),
              icon: Circle,
              color: 'status-later',
            }
  const Icon = meta.icon
  const content = (
    <span
      className={`inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.color}`}
    >
      <Icon className="size-3.5" />
      {meta.label}
    </span>
  )
  return status === 'available' || status === 'in_progress' ? (
    <Link
      href={href}
      className="rounded-sm hover:underline focus-visible:outline-2"
    >
      {content}
    </Link>
  ) : (
    content
  )
}
