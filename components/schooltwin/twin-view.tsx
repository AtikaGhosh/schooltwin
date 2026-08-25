'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  BookOpen,
  Building2,
  Check,
  Circle,
  CookingPot,
  Droplets,
  Library,
  Toilet,
  Trees,
  Users,
  Zap,
} from 'lucide-react'

import {
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  TaskStatusBadge,
} from '@/components/primitives'
import { formatDateTime } from '@/components/schooltwin/task-card'
import { deriveTaskStatus } from '@/lib/schooltwin/domain/task-state'
import { useNow } from '@/lib/schooltwin/hooks/use-now'
import { useWorkspace } from '@/lib/schooltwin/hooks/use-workspace'
import { useSchoolTwin } from '@/components/providers/schooltwin-provider'
import type { SectionCoverageHistoryRecord } from '@/lib/schooltwin/domain/types'

export function TwinView() {
  const workspace = useWorkspace()
  const { locale, t } = useSchoolTwin()

  if (workspace.loading || !workspace.data) {
    return workspace.error ? (
      <ErrorState message={workspace.error} />
    ) : (
      <LoadingState label="Loading operational Twin…" />
    )
  }

  const { areas, sections, coverage } = workspace.data
  const facilities = areas.filter(
    (area) => area.kind === 'facility' || area.kind === 'outdoor',
  )

  return (
    <div className="space-y-10">
      <PageHeader
        title={t('school.title')}
        description="Choose a class or facility to see today’s work."
      />

      <section>
        <div className="flex items-center gap-2.5">
          <Building2 className="text-muted-foreground size-5" />
          <h2 className="text-xl font-semibold">
            {locale === 'or' ? 'ଶ୍ରେଣୀଗୁଡ଼ିକ' : 'Classes'}
          </h2>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sections.map((section) => {
            const area = areas.find((item) => item.id === section.areaId)!
            const row = coverage.rows.find(
              (item) => item.sectionId === section.id,
            )!
            const incomplete =
              row.classPulse.status !== 'submitted' ||
              row.liveEvidence.status !== 'submitted'
            return (
              <Link
                key={area.id}
                href={`/twin/${area.id}`}
                className={`pressable elevated-surface rounded-xl p-4 ${incomplete ? 'ring-primary/15 ring-1' : ''}`}
              >
                <p className="font-semibold">{area.name}</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {section.expectedStrength} {t('school.students')}
                </p>
                <div className="mt-4 flex items-center gap-4">
                  <MiniStatus
                    label={t('task.classCheck')}
                    done={row.classPulse.status === 'submitted'}
                  />
                  <MiniStatus
                    label={t('task.classVideo')}
                    done={row.liveEvidence.status === 'submitted'}
                  />
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2.5">
          <Library className="text-muted-foreground size-5" />
          <h2 className="text-xl font-semibold">
            {locale === 'or' ? 'ସ୍କୁଲ ସୁବିଧା' : 'Facilities'}
          </h2>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {facilities.map((area) => {
            const Icon = facilityIcon(area.id)
            return (
              <Link
                key={area.id}
                href={`/twin/${area.id}`}
                className="pressable elevated-surface flex min-h-20 items-center gap-3.5 rounded-xl p-4"
              >
                <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-lg">
                  <Icon className="size-5" />
                </span>
                <div>
                  <p className="font-semibold">{area.name}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {area.description}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function MiniStatus({ label, done }: { label: string; done: boolean }) {
  return (
    <span
      className="text-muted-foreground flex items-center gap-1 text-[11px]"
      title={label}
    >
      {done ? (
        <Check className="text-stable size-3.5" />
      ) : (
        <Circle className="text-primary size-3.5 fill-current" />
      )}
      <span className="sr-only">{label}</span>
    </span>
  )
}

function facilityIcon(id: string) {
  if (id.includes('water')) return Droplets
  if (id.includes('toilet')) return Toilet
  if (id.includes('kitchen')) return CookingPot
  if (id.includes('electricity')) return Zap
  if (id.includes('library')) return BookOpen
  return Trees
}

export function TwinAreaView({ areaId }: { areaId: string }) {
  const workspace = useWorkspace()
  const now = useNow()
  const { t } = useSchoolTwin()

  if (workspace.loading || !workspace.data) {
    return workspace.error ? (
      <ErrorState message={workspace.error} />
    ) : (
      <LoadingState label="Loading operational area…" />
    )
  }

  const area = workspace.data.areas.find((item) => item.id === areaId)
  if (!area) {
    return (
      <EmptyState
        title="Area not found"
        description="This operational area does not exist or the demo was reset."
      />
    )
  }

  const section = workspace.data.sections.find(
    (item) => item.areaId === area.id,
  )
  const tasks = workspace.data.tasks.filter((task) => task.areaId === area.id)
  const submissions = workspace.data.submissions.filter(
    (submission) =>
      tasks.some((task) => task.id === submission.taskId) ||
      (section ? submission.title.startsWith(section.name) : false),
  )
  const childAreas = workspace.data.areas.filter(
    (item) => item.parentAreaId === area.id,
  )

  return (
    <div className="space-y-6">
      <Link
        href="/twin"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium"
      >
        <ArrowLeft className="size-4" /> {t('school.title')}
      </Link>
      <PageHeader
        title={area.name}
        description={
          section
            ? `${section.expectedStrength} ${t('school.students')}`
            : area.description
        }
      />

      {section ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <span className="bg-accent text-accent-foreground flex size-10 items-center justify-center rounded-lg">
                <Users className="size-5" />
              </span>
              <div>
                <p className="text-muted-foreground text-xs">
                  {t('school.students')}
                </p>
                <p className="text-xl font-semibold tabular-nums">
                  {section.expectedStrength}
                </p>
              </div>
            </div>
          </Card>
          <TodayCoverage sectionId={section.id} />
          <SectionHistory sectionId={section.id} />
        </div>
      ) : null}

      {!section && (area.kind === 'facility' || area.kind === 'outdoor') ? (
        <Card className="p-5">
          <h2 className="font-semibold">{t('school.todayWork')}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Link
              href={`/facility-pulse/${workspace.data.coverage.facilityPulse.assignmentId}`}
              className="border-border flex min-h-16 items-center justify-between rounded-lg border p-4"
            >
              <span className="text-sm font-semibold">
                {t('task.facilityCheck')}
              </span>
              <TaskStatusBadge
                status={workspace.data.coverage.facilityPulse.status}
              />
            </Link>
            <div className="border-border flex min-h-16 items-center justify-between rounded-lg border p-4">
              <span className="text-sm font-semibold">
                {t('task.facilityVideo')}
              </span>
              {tasks[0] ? (
                <TaskStatusBadge status={deriveTaskStatus(tasks[0], now)} />
              ) : (
                <span className="text-muted-foreground text-xs">
                  {t('common.notOpenYet')}
                </span>
              )}
            </div>
          </div>
        </Card>
      ) : null}

      {childAreas.length ? (
        <Card>
          <CardHeader
            title="Contained areas"
            subtitle="Operational structure"
          />
          <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {childAreas.map((child) => (
              <Link
                key={child.id}
                href={`/twin/${child.id}`}
                className="border-border hover:bg-accent/30 rounded-lg border p-3 text-sm font-semibold"
              >
                {child.name}
              </Link>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={t('school.todayWork')}
            subtitle="Open a job directly from here."
          />
          {tasks.length ? (
            <div className="divide-border divide-y">
              {tasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  className="hover:bg-accent/30 flex items-center justify-between gap-3 px-5 py-4"
                >
                  <span className="text-sm font-semibold">{task.title}</span>
                  <TaskStatusBadge status={deriveTaskStatus(task, now)} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-5">
              <EmptyState
                title="No task assigned"
                description="There is no collection task for this area in today’s demo schedule."
              />
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Permitted submissions"
            subtitle="Private participant content is never included"
          />
          {submissions.length ? (
            <div className="divide-border divide-y">
              {submissions.map((submission) => (
                <div key={submission.id} className="px-5 py-4">
                  <p className="text-sm font-semibold">{submission.title}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Submitted · {formatDateTime(submission.submittedAtLocal)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-5">
              <EmptyState
                title="No permitted submissions"
                description="No operator-visible submission has been stored for this area."
              />
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function TodayCoverage({ sectionId }: { sectionId: string }) {
  const workspace = useWorkspace()
  if (!workspace.data) return null
  const row = workspace.data.coverage.rows.find(
    (item) => item.sectionId === sectionId,
  )
  if (!row) return null
  return (
    <Card className="p-5">
      <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        Today
      </p>
      <div className="mt-4 space-y-3">
        <CoverageLine
          label="School Pulse"
          submitted={row.classPulse.status === 'submitted'}
        />
        <CoverageLine
          label="Attendance Evidence"
          submitted={row.liveEvidence.status === 'submitted'}
        />
      </div>
    </Card>
  )
}

function SectionHistory({ sectionId }: { sectionId: string }) {
  const { repository, clock, intlLocale, t } = useSchoolTwin()
  const [history, setHistory] = useState<SectionCoverageHistoryRecord[]>([])
  useEffect(() => {
    repository
      .getSectionCoverageHistory(sectionId, clock.now())
      .then(setHistory)
  }, [clock, repository, sectionId])
  return (
    <Card className="p-5 md:col-span-1">
      <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        {t('school.lastFive')}
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground">
              <th className="py-1 text-left">Day</th>
              <th className="py-1 text-center">Pulse</th>
              <th className="py-1 text-center">Evidence</th>
            </tr>
          </thead>
          <tbody>
            {history.map((record) => (
              <tr key={record.id} className="border-border border-t">
                <th className="py-2 text-left font-medium">
                  {formatHistoryDay(record.dateKey, intlLocale)}
                </th>
                <td
                  className="py-2 text-center"
                  aria-label={`Pulse ${record.classPulseStatus}`}
                >
                  {formatCoverageMark(record.classPulseStatus)}
                </td>
                <td
                  className="py-2 text-center"
                  aria-label={`Evidence ${record.liveEvidenceStatus}`}
                >
                  {formatCoverageMark(record.liveEvidenceStatus)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function CoverageLine({
  label,
  submitted,
}: {
  label: string
  submitted: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <span
        className={
          submitted
            ? 'text-stable font-semibold'
            : 'text-muted-foreground font-semibold'
        }
      >
        {submitted ? 'Submitted' : 'Required'}
      </span>
    </div>
  )
}
function formatHistoryDay(dateKey: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${dateKey}T12:00:00Z`))
}

function formatCoverageMark(
  status: SectionCoverageHistoryRecord['classPulseStatus'],
): string {
  if (status === 'submitted') return '✓'
  if (status === 'pending') return '○'
  return '—'
}
