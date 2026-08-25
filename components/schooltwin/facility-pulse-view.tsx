'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'

import { useSchoolTwin } from '@/components/providers/schooltwin-provider'
import { Card, ErrorState, LoadingState } from '@/components/primitives'
import {
  AnswerButtons,
  GuidedWizard,
  type GuidedWizardStep,
} from '@/components/schooltwin/guided-wizard'
import { CryptoIdGenerator } from '@/lib/schooltwin/adapters/browser'
import { isWaitingToSendError } from '@/lib/schooltwin/backend/errors'
import { validateFacilityPulseResponse } from '@/lib/schooltwin/domain/daily-coverage'
import { validationMessage } from '@/lib/schooltwin/i18n'
import {
  deriveTaskStatus,
  transitionTask,
} from '@/lib/schooltwin/domain/task-state'
import type {
  FacilityPulseAssignment,
  FacilityPulseResponse,
} from '@/lib/schooltwin/domain/types'

const ids = new CryptoIdGenerator()

export function FacilityPulseView({ assignmentId }: { assignmentId: string }) {
  const { repository, clock, refresh, locale, t } = useSchoolTwin()
  const [assignment, setAssignment] = useState<FacilityPulseAssignment | null>(
    null,
  )
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [waitingToSend, setWaitingToSend] = useState(false)
  useEffect(() => {
    repository
      .getFacilityPulseAssignment(assignmentId)
      .then(setAssignment)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : 'This check could not be opened.',
        ),
      )
      .finally(() => setLoading(false))
  }, [assignmentId, repository])
  if (loading) return <LoadingState />
  if (!assignment)
    return (
      <ErrorState message={error || 'This Facility Check is unavailable.'} />
    )
  if (assignment.status === 'submitted')
    return (
      <Card className="mx-auto max-w-xl p-8 text-center">
        <CheckCircle2 className="success-enter text-stable mx-auto size-11" />
        <h1 className="mt-4 text-2xl font-semibold">
          {t('task.facilityCheck')} — {t('common.done')}
        </h1>
        <Link
          href="/tasks"
          className="text-primary mt-5 inline-flex min-h-12 items-center font-semibold"
        >
          {t('nav.work')}
        </Link>
      </Card>
    )
  const currentAssignment = assignment

  const questions =
    locale === 'or'
      ? [
          'ଆଜି ପିଇବା ପାଣି ମିଳୁଛି କି?',
          'ପୁଅମାନଙ୍କ ଶୌଚାଳୟ କେମିତି ଅଛି?',
          'ଝିଅମାନଙ୍କ ଶୌଚାଳୟ କେମିତି ଅଛି?',
          'ରୋଷେଇ ଘର କାମ କରୁଛି କି?',
          'ସ୍କୁଲରେ ବିଦ୍ୟୁତ୍ ଅଛି କି?',
          'ପାଠାଗାର ବ୍ୟବହାର କରିହେଉଛି କି?',
          'ଖେଳ ପଡ଼ିଆ ବ୍ୟବହାର କରିହେଉଛି କି?',
        ]
      : [
          'Is drinking water available today?',
          'What is the condition of the boys’ toilet?',
          'What is the condition of the girls’ toilet?',
          'Is the kitchen operating?',
          'Is electricity available at school?',
          'Can the library be used?',
          'Can the playground be used?',
        ]
  const definitions: Array<[string, Array<[string, string]>]> = [
    ['drinkingWater', binary('available', 'unavailable')],
    ['boysToilet', condition()],
    ['girlsToilet', condition()],
    ['kitchen', binary('operational', 'issue')],
    ['electricity', binary('available', 'unavailable')],
    ['library', binary('operational', 'issue')],
    ['playground', binary('operational', 'issue')],
  ]
  const steps: GuidedWizardStep[] = definitions.map(([id, options], index) => ({
    id,
    question: questions[index],
    valid: Boolean(values[id]),
    content: (
      <AnswerButtons
        value={values[id] ?? ''}
        options={options}
        onChange={(value) =>
          setValues((current) => ({ ...current, [id]: value }))
        }
      />
    ),
  }))
  function binary(yes: string, no: string): Array<[string, string]> {
    return [
      [yes, locale === 'or' ? 'ହଁ' : 'Yes'],
      [no, locale === 'or' ? 'ନା' : 'No'],
    ]
  }
  function condition(): Array<[string, string]> {
    return [
      ['usable', locale === 'or' ? 'ବ୍ୟବହାର କରିହେଉଛି' : 'Usable'],
      [
        'partially_usable',
        locale === 'or' ? 'କିଛି ଅଂଶ ବ୍ୟବହାର କରିହେଉଛି' : 'Partly usable',
      ],
      ['unusable', locale === 'or' ? 'ବ୍ୟବହାର କରିହେଉନାହିଁ' : 'Not usable'],
    ]
  }

  async function submit() {
    const now = clock.now()
    const status = deriveTaskStatus(currentAssignment, now)
    if (status !== 'available' && status !== 'in_progress') {
      setError('This check is not available now.')
      return
    }
    const started =
      currentAssignment.status === 'scheduled'
        ? transitionTask(currentAssignment, 'in_progress', now)
        : currentAssignment
    const response: FacilityPulseResponse = {
      id: `response-${currentAssignment.id}`,
      dayId: currentAssignment.dayId,
      assignmentId: currentAssignment.id,
      schoolId: currentAssignment.schoolId,
      attributedTo: 'school_operator',
      drinkingWater:
        values.drinkingWater as FacilityPulseResponse['drinkingWater'],
      boysToilet: values.boysToilet as FacilityPulseResponse['boysToilet'],
      girlsToilet: values.girlsToilet as FacilityPulseResponse['girlsToilet'],
      kitchen: values.kitchen as FacilityPulseResponse['kitchen'],
      electricity: values.electricity as FacilityPulseResponse['electricity'],
      library: values.library as FacilityPulseResponse['library'],
      playground: values.playground as FacilityPulseResponse['playground'],
      submittedAtLocal: now.toISOString(),
    }
    const errors = validateFacilityPulseResponse(response)
    if (errors.length) {
      setError(errors.map((code) => validationMessage(locale, code)).join(' '))
      return
    }
    const completed = transitionTask(started, 'submitted', now)
    try {
      await repository.saveFacilityPulseResponse(response)
    } catch (cause) {
      if (isWaitingToSendError(cause)) {
        setWaitingToSend(true)
        setError('')
        return
      }
      setError(
        cause instanceof Error
          ? cause.message
          : 'The server did not accept this check.',
      )
      return
    }
    await repository.saveFacilityPulseAssignment(completed)
    await repository.saveSubmission({
      id: ids.create('submission'),
      schoolId: currentAssignment.schoolId,
      sourceRecordId: response.id,
      kind: 'facility_pulse',
      title: 'Daily Facility Check',
      status: 'submitted',
      visibility: 'operator',
      submittedAtLocal: now.toISOString(),
    })
    await repository.appendAuditEvent({
      id: ids.create('audit'),
      schoolId: currentAssignment.schoolId,
      type: 'facility_pulse_submitted',
      targetId: currentAssignment.id,
      occurredAtLocal: now.toISOString(),
      detail: 'The Daily Facility Check was stored locally.',
    })
    setAssignment(completed)
    refresh()
  }
  return (
    <div className="space-y-5">
      <header>
        <p className="text-primary text-sm font-semibold">
          {locale === 'or' ? 'ସ୍କୁଲ ଖାତା' : 'School account'}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">
          {t('task.facilityCheck')}
        </h1>
      </header>
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
      {waitingToSend ? (
        <Card className="border-primary/20 bg-primary/5 p-5">
          <p className="font-semibold" role="status">
            Saved on this device
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            Waiting to send. It will show as Done only after the server accepts
            it.
          </p>
          <Link
            href="/tasks"
            className="text-primary mt-3 inline-flex min-h-12 items-center font-semibold"
          >
            Back to today&apos;s work
          </Link>
        </Card>
      ) : (
        <GuidedWizard steps={steps} onComplete={submit} />
      )}
    </div>
  )
}
