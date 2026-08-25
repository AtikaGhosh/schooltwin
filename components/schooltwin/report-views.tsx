'use client'

import { FormEvent, useEffect, useState } from 'react'
import { CheckCircle2, KeyRound, ShieldAlert } from 'lucide-react'

import {
  Card,
  ErrorState,
  LoadingState,
  PageHeader,
  PrototypeNotice,
} from '@/components/primitives'
import { useSchoolTwin } from '@/components/providers/schooltwin-provider'
import { CryptoIdGenerator } from '@/lib/schooltwin/adapters/browser'
import { isWaitingToSendError } from '@/lib/schooltwin/backend/errors'
import {
  requiresProtectedReporting,
  SENSITIVE_REPORT_CATEGORY,
} from '@/lib/schooltwin/domain/report-policy'
import type {
  IncidentCategory,
  KioskSession,
} from '@/lib/schooltwin/domain/types'

const ids = new CryptoIdGenerator()
const categories: Array<{
  value: IncidentCategory | typeof SENSITIVE_REPORT_CATEGORY
  label: string
}> = [
  { value: 'water', label: 'Drinking water' },
  { value: 'sanitation', label: 'Toilet or sanitation' },
  { value: 'meals', label: 'School meal' },
  { value: 'electricity', label: 'Electricity' },
  { value: 'classroom', label: 'Classroom issue' },
  { value: 'teacher_availability', label: 'Teacher' },
  { value: 'infrastructure', label: 'Building or equipment' },
  { value: 'other', label: 'Other operational issue' },
  {
    value: SENSITIVE_REPORT_CATEGORY,
    label: 'Sensitive or immediate safety concern',
  },
]

export function OperatorReportView() {
  const { repository, clock, refresh, t } = useSchoolTwin()
  const [category, setCategory] = useState<string>('water')
  const [description, setDescription] = useState('')
  const [done, setDone] = useState(false)
  const [waitingToSend, setWaitingToSend] = useState(false)
  const [error, setError] = useState('')
  const [protectedFlow, setProtectedFlow] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (requiresProtectedReporting(category)) {
      setDescription('')
      setProtectedFlow(true)
      return
    }
    const school = await repository.getSchool()
    const now = clock.now()
    const reportId = ids.create('report')
    try {
      await repository.saveIncidentReport({
        id: reportId,
        schoolId: school.id,
        mode: 'school_operator',
        category: category as IncidentCategory,
        description,
        submittedAtLocal: now.toISOString(),
      })
    } catch (cause) {
      if (isWaitingToSendError(cause)) {
        setDescription('')
        setWaitingToSend(true)
        setError('')
        return
      }
      setError(
        cause instanceof Error
          ? cause.message
          : 'The server did not accept this report.',
      )
      return
    }
    await repository.saveSubmission({
      id: ids.create('submission'),
      schoolId: school.id,
      sourceRecordId: reportId,
      kind: 'operator_report',
      title: `${categoryLabel(category)} issue`,
      status: 'submitted',
      visibility: 'operator',
      submittedAtLocal: now.toISOString(),
    })
    await repository.appendAuditEvent({
      id: ids.create('audit'),
      schoolId: school.id,
      type: 'report_submitted',
      targetId: reportId,
      occurredAtLocal: now.toISOString(),
      detail: 'A School Operator operational report was stored locally.',
    })
    setDescription('')
    setDone(true)
    refresh()
  }

  if (protectedFlow) return <ProtectedGuidance />
  return (
    <ReportForm
      title={t('report.title')}
      description={t('report.attribution')}
      category={category}
      setCategory={setCategory}
      details={description}
      setDetails={setDescription}
      onSubmit={submit}
      done={done}
      waitingToSend={waitingToSend}
      error={error}
    />
  )
}

export function PrivateReportView({ sessionId }: { sessionId: string }) {
  const { repository, clock } = useSchoolTwin()
  const [session, setSession] = useState<KioskSession | null>(null)
  const [code, setCode] = useState('')
  const [grantId, setGrantId] = useState<string | null>(null)
  const [category, setCategory] = useState<string>('water')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [protectedFlow, setProtectedFlow] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    repository.getSession(sessionId).then(async (value) => {
      setSession(value)
      setDone(value?.status === 'completed')
      const active = await repository.getActiveRedeemedGrant(
        sessionId,
        clock.now(),
      )
      setGrantId(active?.accessGrantId ?? null)
      setLoading(false)
    })
  }, [repository, sessionId, clock])

  async function redeem(event: FormEvent) {
    event.preventDefault()
    const result = await repository.redeemAccessGrant(
      sessionId,
      code,
      clock.now(),
    )
    if (!result.ok) {
      setError(
        result.reason === 'used'
          ? 'This prototype code has already been used.'
          : result.reason === 'expired'
            ? 'This prototype code has expired.'
            : 'The code is invalid for this private-report session.',
      )
      return
    }
    setGrantId(result.accessGrantId)
    setCode('')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!session || !grantId) return
    if (requiresProtectedReporting(category)) {
      setDescription('')
      setCategory('water')
      setProtectedFlow(true)
      return
    }
    const now = clock.now()
    const reportId = ids.create('private-report')
    await repository.saveIncidentReport({
      id: reportId,
      schoolId: session.schoolId,
      mode: 'private_student',
      category: category as IncidentCategory,
      description,
      submittedAtLocal: now.toISOString(),
    })
    await repository.saveSubmission({
      id: ids.create('submission'),
      schoolId: session.schoolId,
      sourceRecordId: reportId,
      kind: 'private_report',
      title: 'Private operational report',
      status: 'submitted',
      visibility: 'protected',
      submittedAtLocal: now.toISOString(),
    })
    await repository.appendAuditEvent({
      id: ids.create('audit'),
      schoolId: session.schoolId,
      type: 'report_submitted',
      targetId: reportId,
      occurredAtLocal: now.toISOString(),
      detail:
        'A private operational report was stored locally without a participant reference.',
    })
    await repository.completeSession(sessionId, now)
    setDescription('')
    setDone(true)
  }

  if (loading) return <LoadingState />
  if (!session || session.type !== 'private_report')
    return <ErrorState message="This private-report session is unavailable." />
  if (protectedFlow) return <ProtectedGuidance />
  if (done)
    return (
      <Card className="p-8 text-center">
        <CheckCircle2 className="text-stable mx-auto size-10" />
        <h1 className="mt-4 text-xl font-semibold">Private report submitted</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          The School Operator history cannot reveal this report’s content,
          category, or timestamp.
        </p>
      </Card>
    )
  if (!grantId)
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Private operational report"
          title="Enter your one-time code"
          description="Eligibility is checked before report content is entered."
        />
        <Card className="p-6">
          <form onSubmit={(event) => void redeem(event)}>
            <label htmlFor="private-code" className="text-sm font-semibold">
              Prototype participant code
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="private-code"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                className="input-control border-input bg-background min-w-0 flex-1 rounded-lg border px-3 py-2 font-mono"
                required
              />
              <button className="primary-action inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold">
                <KeyRound className="size-4" /> Continue
              </button>
            </div>
          </form>
        </Card>
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
      </div>
    )
  return (
    <ReportForm
      title="Private operational report"
      description="Report an ordinary school operational problem. This frontend models privacy but cannot guarantee anonymity against someone controlling this device."
      category={category}
      setCategory={setCategory}
      details={description}
      setDetails={setDescription}
      onSubmit={submit}
      done={false}
    />
  )
}

function ReportForm({
  title,
  description,
  category,
  setCategory,
  details,
  setDetails,
  onSubmit,
  done,
  waitingToSend = false,
  error = '',
}: {
  title: string
  description: string
  category: string
  setCategory: (value: string) => void
  details: string
  setDetails: (value: string) => void
  onSubmit: (event: FormEvent) => void
  done: boolean
  waitingToSend?: boolean
  error?: string
}) {
  const { t, locale } = useSchoolTwin()
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      {done ? (
        <p
          role="status"
          className="border-stable/30 bg-stable/10 rounded-lg border p-4 text-sm font-semibold"
        >
          Report submitted locally.
        </p>
      ) : null}
      {waitingToSend ? (
        <p
          role="status"
          className="border-primary/30 bg-primary/10 rounded-lg border p-4 text-sm font-semibold"
        >
          Saved on this device. Waiting to send. It is not submitted until the
          server accepts it.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <Card className="p-6">
        <form onSubmit={onSubmit} className="space-y-5">
          <fieldset>
            <legend className="text-lg font-semibold">
              {t('report.question')}
            </legend>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {categories.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={category === item.value}
                  onClick={() => {
                    setCategory(item.value)
                    if (requiresProtectedReporting(item.value)) setDetails('')
                  }}
                  className={`category-choice min-h-16 rounded-lg border px-3 text-left text-sm font-semibold ${category === item.value ? 'border-primary text-primary' : 'border-border bg-card'}`}
                >
                  <span className="flex items-center gap-2">
                    <span aria-hidden="true">{categoryIcon(item.value)}</span>
                    <span className="flex-1">
                      {localizedCategory(item.value, item.label, locale)}
                    </span>
                    {category === item.value ? (
                      <CheckCircle2
                        className="success-enter size-4 shrink-0"
                        aria-hidden
                      />
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
          {!requiresProtectedReporting(category) ? (
            <div>
              <label htmlFor="report-details" className="text-sm font-semibold">
                {t('report.describe')}
              </label>
              <textarea
                id="report-details"
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                required
                minLength={10}
                rows={5}
                className="input-control border-input bg-background mt-2 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
          ) : (
            <PrototypeNotice>
              Sensitive content will not be accepted or stored in this
              prototype. Continue to protected-channel guidance.
            </PrototypeNotice>
          )}
          <button className="primary-action min-h-12 w-full rounded-lg px-5 py-3 text-sm font-semibold">
            {requiresProtectedReporting(category)
              ? 'Open protected guidance'
              : t('report.send')}
          </button>
        </form>
      </Card>
    </div>
  )
}

function categoryIcon(value: string): string {
  return (
    (
      {
        water: '💧',
        sanitation: '🚻',
        meals: '🍛',
        electricity: '💡',
        classroom: '🏫',
        teacher_availability: '👩‍🏫',
        infrastructure: '🛠',
        other: '⚠',
        sensitive_or_immediate_safety: '🛡',
      } as Record<string, string>
    )[value] ?? '•'
  )
}

function localizedCategory(
  value: string,
  fallback: string,
  locale: 'en' | 'or',
): string {
  if (locale === 'en') return fallback
  return (
    (
      {
        water: 'ପାଣି',
        sanitation: 'ଶୌଚାଳୟ',
        meals: 'ଭୋଜନ',
        electricity: 'ବିଦ୍ୟୁତ୍',
        classroom: 'ଶ୍ରେଣୀ କକ୍ଷ',
        teacher_availability: 'ଶିକ୍ଷକ',
        infrastructure: 'କୋଠା/ଉପକରଣ',
        other: 'ଅନ୍ୟ',
        sensitive_or_immediate_safety: 'ତୁରନ୍ତ ସୁରକ୍ଷା',
      } as Record<string, string>
    )[value] ?? fallback
  )
}

function ProtectedGuidance() {
  return (
    <Card className="p-8">
      <ShieldAlert className="text-primary size-9" />
      <h1 className="mt-4 text-xl font-semibold">
        Use an approved protected reporting channel
      </h1>
      <p className="text-muted-foreground mt-2 max-w-xl text-sm leading-6">
        This prototype did not store your description, evidence, identity, or
        draft. A production deployment would direct this concern through
        government-approved child-protection or immediate-safety channels. No
        unverified contact information is shown here.
      </p>
    </Card>
  )
}

function categoryLabel(value: string): string {
  return categories.find((item) => item.value === value)?.label ?? 'Operational'
}
