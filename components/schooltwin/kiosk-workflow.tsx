'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2, KeyRound } from 'lucide-react'

import { useSchoolTwin } from '@/components/providers/schooltwin-provider'
import { Card, ErrorState, LoadingState } from '@/components/primitives'
import {
  AnswerButtons,
  GuidedWizard,
} from '@/components/schooltwin/guided-wizard'
import { CryptoIdGenerator } from '@/lib/schooltwin/adapters/browser'
import { PULSE_QUESTIONS } from '@/lib/schooltwin/domain/questions'
import type {
  ObservationAnswer,
  StudentPulseSession,
} from '@/lib/schooltwin/domain/types'

const ids = new CryptoIdGenerator()

export function StudentPulseWorkflow({ sessionId }: { sessionId: string }) {
  const { repository, clock, refresh, locale, t } = useSchoolTwin()
  const [session, setSession] = useState<StudentPulseSession | null>(null)
  const [code, setCode] = useState('')
  const [grantId, setGrantId] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, ObservationAnswer>>({})
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    repository
      .getSession(sessionId)
      .then(async (value) => {
        if (value?.type !== 'student_pulse') return
        setSession(value)
        setDone(value.status === 'completed')
        const active = await repository.getActiveRedeemedGrant(
          sessionId,
          clock.now(),
        )
        setGrantId(active?.accessGrantId ?? null)
      })
      .catch(() => setError('This private check could not be opened.'))
      .finally(() => setLoading(false))
  }, [repository, sessionId, clock])

  async function redeem(event: FormEvent) {
    event.preventDefault()
    if (!session) return
    const result = await repository.redeemAccessGrant(
      sessionId,
      code,
      clock.now(),
    )
    if (!result.ok) {
      setError(
        result.reason === 'used'
          ? t('error.usedCode')
          : result.reason === 'expired'
            ? t('error.expiredCode')
            : t('error.invalidCode'),
      )
      return
    }
    setGrantId(result.accessGrantId)
    setCode('')
    setError('')
    await repository.appendAuditEvent({
      id: ids.create('audit'),
      schoolId: session.schoolId,
      type: 'pulse_session_started',
      targetId: sessionId,
      occurredAtLocal: clock.now().toISOString(),
      detail: 'A restricted private Student Check session started.',
    })
  }
  async function submit() {
    if (
      !session ||
      !grantId ||
      PULSE_QUESTIONS.some((question) => !answers[question.id])
    )
      return
    const now = clock.now()
    await repository.saveStudentPulseResponse({
      id: ids.create('student-pulse'),
      schoolId: session.schoolId,
      taskId: session.taskId,
      sessionId,
      accessGrantId: grantId,
      answers: PULSE_QUESTIONS.map((question) => ({
        questionId: question.id,
        answer: answers[question.id],
      })),
      submittedAtLocal: now.toISOString(),
    })
    await repository.saveSubmission({
      id: ids.create('submission'),
      schoolId: session.schoolId,
      taskId: session.taskId,
      sourceRecordId: sessionId,
      kind: 'student_pulse',
      title: 'Student Private Check',
      status: 'submitted',
      visibility: 'protected',
      submittedAtLocal: now.toISOString(),
    })
    await repository.appendAuditEvent({
      id: ids.create('audit'),
      schoolId: session.schoolId,
      type: 'pulse_submitted',
      targetId: sessionId,
      occurredAtLocal: now.toISOString(),
      detail: 'A private student response was stored locally.',
    })
    await repository.completeSession(sessionId, now)
    setAnswers({})
    setGrantId(null)
    setDone(true)
    refresh()
  }
  if (loading) return <LoadingState />
  if (!session)
    return (
      <ErrorState message={error || 'This private check is unavailable.'} />
    )
  if (done)
    return (
      <Card className="p-8 text-center">
        <CheckCircle2 className="success-enter text-stable mx-auto size-11" />
        <h1 className="mt-4 text-2xl font-semibold">
          {locale === 'or' ? 'ଧନ୍ୟବାଦ' : 'Thank you'}
        </h1>
        <p className="text-muted-foreground mt-3">{t('wizard.handBack')}</p>
      </Card>
    )
  if (!grantId)
    return (
      <Card className="mx-auto max-w-xl p-6 sm:p-8">
        <h1 className="text-2xl font-semibold">{t('task.studentPrivate')}</h1>
        <p className="text-muted-foreground mt-2">
          {locale === 'or'
            ? 'ଆପଣଙ୍କ ନିଜ ଅନୁଭବ ବିଷୟରେ ୧–୨ଟି ସହଜ ପ୍ରଶ୍ନ।'
            : 'Answer one or two simple questions about your own experience.'}
        </p>
        <form onSubmit={(event) => void redeem(event)} className="mt-7">
          <label htmlFor="student-code" className="text-sm font-semibold">
            {locale === 'or'
              ? 'ଆପଣଙ୍କ କୋଡ୍ ଲେଖନ୍ତୁ'
              : 'Enter your one-time code'}
          </label>
          <input
            id="student-code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            required
            autoComplete="off"
            className="input-control border-input mt-2 min-h-12 w-full rounded-lg border px-4 font-mono uppercase"
          />
          <button className="primary-action mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg px-5 font-semibold">
            <KeyRound className="size-4" />
            {t('common.start')}
          </button>
        </form>
        {error ? (
          <p role="alert" className="text-destructive mt-4 text-sm">
            {error}
          </p>
        ) : null}
      </Card>
    )
  const steps = PULSE_QUESTIONS.map((question) => ({
    id: question.id,
    question: question.prompt,
    valid: Boolean(answers[question.id]),
    content: (
      <AnswerButtons
        value={answers[question.id] ?? ''}
        options={question.allowedAnswers.map((answer) => [
          answer,
          answerLabel(answer, locale),
        ])}
        onChange={(answer) =>
          setAnswers((current) => ({
            ...current,
            [question.id]: answer as ObservationAnswer,
          }))
        }
      />
    ),
  }))
  return <GuidedWizard steps={steps} onComplete={submit} />
}

function answerLabel(answer: ObservationAnswer, locale: 'en' | 'or') {
  if (locale === 'or')
    return answer === 'yes'
      ? 'ହଁ'
      : answer === 'no'
        ? 'ନା'
        : answer === 'did_not_check'
          ? 'ଦେଖିନାହିଁ'
          : answer === 'not_applicable'
            ? 'ଲାଗୁ ହୁଏ ନାହିଁ'
            : 'ନିଶ୍ଚିତ ନୁହେଁ'
  return answer === 'yes'
    ? 'Yes'
    : answer === 'no'
      ? 'No'
      : answer === 'did_not_check'
        ? 'Didn’t check'
        : answer === 'not_applicable'
          ? 'Not applicable'
          : 'Not sure'
}
