'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Check, Clipboard, KeyRound, RotateCcw, Shield } from 'lucide-react'

import {
  Card,
  ErrorState,
  LoadingState,
  PageHeader,
} from '@/components/primitives'
import { useSchoolTwin } from '@/components/providers/schooltwin-provider'
import {
  DEMO_CLASS_PULSE_CODES,
  DEMO_CODES,
} from '@/lib/schooltwin/domain/seed'
import type { OperatorDailyCoverageView } from '@/lib/schooltwin/domain/daily-coverage'
import type { KioskSession } from '@/lib/schooltwin/domain/types'
import type { TranslationKey } from '@/lib/schooltwin/i18n'
import { cn } from '@/lib/utils'

type DemoCodeStatus = 'available' | 'used' | 'expired'

interface DemoCodeRow {
  id: string
  label: string
  code: string
  href: string
  status: DemoCodeStatus
}

export function DemoCodeTools() {
  const { repository, clock, refresh, revision, t } = useSchoolTwin()
  const [sectionCodes, setSectionCodes] = useState<DemoCodeRow[] | null>(null)
  const [studentCode, setStudentCode] = useState<DemoCodeRow | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    let active = true
    const now = clock.now()
    Promise.all([
      repository.getOperatorDailyCoverage(now),
      repository.getSession('session-student-pulse-demo'),
    ])
      .then(([coverage, studentSession]) => {
        if (!active) return
        setSectionCodes(toSectionCodeRows(coverage))
        setStudentCode(toStudentCodeRow(studentSession, now))
      })
      .catch((cause: unknown) => {
        if (!active) return
        setError(
          cause instanceof Error
            ? cause.message
            : 'Demo codes could not be loaded.',
        )
      })
    return () => {
      active = false
    }
  }, [clock, repository, revision])

  async function copyCode(row: DemoCodeRow) {
    try {
      await navigator.clipboard.writeText(row.code)
    } catch {
      const input = document.createElement('textarea')
      input.value = row.code
      input.style.position = 'fixed'
      input.style.opacity = '0'
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      input.remove()
    }
    setCopiedId(row.id)
    window.setTimeout(() => setCopiedId(null), 1_500)
  }

  async function resetCodes() {
    if (!window.confirm(t('demoCodes.resetConfirm'))) return
    setResetting(true)
    try {
      await repository.resetDemo()
      setCopiedId(null)
      refresh()
    } finally {
      setResetting(false)
    }
  }

  if (error) return <ErrorState message={error} />
  if (!sectionCodes || !studentCode)
    return <LoadingState label="Loading demo codes…" />

  return (
    <div className="space-y-7">
      <PageHeader
        title={t('demoCodes.title')}
        description={t('demoCodes.description')}
      />

      <div className="border-primary/25 bg-primary/5 flex gap-3 rounded-xl border px-4 py-3 text-sm">
        <KeyRound className="text-primary mt-0.5 size-5 shrink-0" aria-hidden />
        <p>{t('demoCodes.warning')}</p>
      </div>

      <Card className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg">
            <Shield className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-semibold">
              {t('demoCodes.studentCheck')}
            </h2>
            <p className="text-muted-foreground mt-1 text-sm leading-6">
              {t('demoCodes.studentHelp')}
            </p>
          </div>
        </div>
        <div className="mt-5">
          <CodeRow
            row={studentCode}
            copied={copiedId === studentCode.id}
            onCopy={copyCode}
            t={t}
          />
        </div>
      </Card>

      <section aria-labelledby="section-code-heading">
        <div className="mb-4">
          <h2 id="section-code-heading" className="text-lg font-semibold">
            {t('demoCodes.sectionChecks')}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {t('demoCodes.sectionHelp')}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sectionCodes.map((row) => (
            <CodeRow
              key={row.id}
              row={row}
              copied={copiedId === row.id}
              onCopy={copyCode}
              t={t}
            />
          ))}
        </div>
      </section>

      <div className="border-border flex flex-col items-start justify-between gap-4 border-t pt-6 sm:flex-row sm:items-center">
        <p className="text-muted-foreground max-w-xl text-xs leading-5">
          Reset restores the original fictional Sundarpur scenario and deletes
          locally captured demo evidence.
        </p>
        <button
          type="button"
          disabled={resetting}
          onClick={() => void resetCodes()}
          className="border-destructive/30 text-destructive inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold disabled:opacity-50"
        >
          <RotateCcw className="size-4" aria-hidden />
          {resetting ? t('common.loading') : t('demoCodes.reset')}
        </button>
      </div>
    </div>
  )
}

function CodeRow({
  row,
  copied,
  onCopy,
  t,
}: {
  row: DemoCodeRow
  copied: boolean
  onCopy: (row: DemoCodeRow) => Promise<void>
  t: (key: TranslationKey) => string
}) {
  return (
    <article className="border-border/80 bg-card rounded-xl border p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{row.label}</h3>
          <code className="mt-2 block text-lg font-semibold tracking-[0.12em]">
            {row.code}
          </code>
        </div>
        <StatusBadge status={row.status} t={t} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => void onCopy(row)}
          className="border-border hover:bg-muted inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold"
        >
          {copied ? (
            <Check className="size-4" aria-hidden />
          ) : (
            <Clipboard className="size-4" aria-hidden />
          )}
          {copied ? t('demoCodes.copied') : t('demoCodes.copy')}
        </button>
        <Link
          href={row.href}
          className="primary-action inline-flex min-h-12 items-center justify-center rounded-lg px-3 text-center text-sm font-semibold"
        >
          {t('demoCodes.open')}
        </Link>
      </div>
    </article>
  )
}

function StatusBadge({
  status,
  t,
}: {
  status: DemoCodeStatus
  t: (key: TranslationKey) => string
}) {
  const key = `demoCodes.${status}` as const
  return (
    <span
      className={cn(
        'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold',
        status === 'available' && 'status-now',
        status === 'used' && 'status-done',
        status === 'expired' && 'status-missed',
      )}
    >
      {t(key)}
    </span>
  )
}

function toSectionCodeRows(coverage: OperatorDailyCoverageView): DemoCodeRow[] {
  return coverage.rows.map((row) => {
    const sectionName = row.sectionName.replace('Class ', '')
    return {
      id: row.classPulse.sessionId,
      label: row.sectionName,
      code: DEMO_CLASS_PULSE_CODES[sectionName],
      href: `/school-pulse/${row.classPulse.sessionId}`,
      status:
        row.classPulse.status === 'submitted'
          ? 'used'
          : row.classPulse.status === 'missed' ||
              row.classPulse.status === 'failed'
            ? 'expired'
            : 'available',
    }
  })
}

function toStudentCodeRow(
  session: KioskSession | null,
  now: Date,
): DemoCodeRow {
  const expired = !session || new Date(session.expiresAt) < now
  return {
    id: session?.id ?? 'session-student-pulse-demo',
    label: 'Student Private Check',
    code: DEMO_CODES.studentPulse,
    href: '/pulse/session-student-pulse-demo',
    status:
      session?.status === 'completed'
        ? 'used'
        : expired || session?.status === 'expired'
          ? 'expired'
          : 'available',
  }
}
