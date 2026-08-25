'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2, KeyRound } from 'lucide-react'

import { useSchoolTwin } from '@/components/providers/schooltwin-provider'
import { Card, ErrorState, LoadingState } from '@/components/primitives'
import {
  AnswerButtons,
  GuidedWizard,
  type GuidedWizardStep,
} from '@/components/schooltwin/guided-wizard'
import { CryptoIdGenerator } from '@/lib/schooltwin/adapters/browser'
import { validateClassPulseResponse } from '@/lib/schooltwin/domain/daily-coverage'
import { validationMessage } from '@/lib/schooltwin/i18n'
import {
  deriveTaskStatus,
  transitionTask,
} from '@/lib/schooltwin/domain/task-state'
import type {
  ClassPulseAssignment,
  ClassPulseResponse,
  ClassPulseSession,
  ObservationAnswer,
  Section,
} from '@/lib/schooltwin/domain/types'

const ids = new CryptoIdGenerator()
type Draft = Record<string, string>

export function ClassPulseView({ sessionId }: { sessionId: string }) {
  const { repository, clock, refresh, locale, t } = useSchoolTwin()
  const [session, setSession] = useState<ClassPulseSession | null>(null)
  const [assignment, setAssignment] = useState<ClassPulseAssignment | null>(
    null,
  )
  const [section, setSection] = useState<Section | null>(null)
  const [code, setCode] = useState('')
  const [grantId, setGrantId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [done, setDone] = useState(false)

  useEffect(() => {
    repository
      .getSession(sessionId)
      .then(async (value) => {
        if (value?.type !== 'class_pulse') return
        const [loadedAssignment, loadedSection, activeGrant] =
          await Promise.all([
            repository.getClassPulseAssignment(value.assignmentId),
            repository.getSection(value.sectionId),
            repository.getActiveRedeemedGrant(sessionId, clock.now()),
          ])
        setSession(value)
        setAssignment(loadedAssignment)
        setSection(loadedSection)
        setGrantId(activeGrant?.accessGrantId ?? null)
        setDone(
          value.status === 'completed' ||
            loadedAssignment?.status === 'submitted',
        )
      })
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : 'This Daily Class Check could not be opened.',
        ),
      )
      .finally(() => setLoading(false))
  }, [repository, sessionId, clock])

  async function redeem(event: FormEvent) {
    event.preventDefault()
    if (!session || !assignment) return
    const status = deriveTaskStatus(assignment, clock.now())
    if (status !== 'available' && status !== 'in_progress') {
      setError('This Daily Class Check is not available now.')
      return
    }
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
    const started =
      assignment.status === 'scheduled'
        ? transitionTask(assignment, 'in_progress', clock.now())
        : assignment
    if (started !== assignment)
      await repository.saveClassPulseAssignment(started)
    await repository.appendAuditEvent({
      id: ids.create('audit'),
      schoolId: session.schoolId,
      type: 'class_pulse_session_started',
      targetId: assignment.id,
      occurredAtLocal: clock.now().toISOString(),
      detail: `${section?.name ?? 'Class'} Daily Check started.`,
    })
    setAssignment(started)
    setGrantId(result.accessGrantId)
    setCode('')
    setError('')
  }

  async function submit() {
    if (!session || !assignment || !section || !grantId) return
    const now = clock.now()
    const response: ClassPulseResponse = {
      id: `response-${assignment.id}`,
      dayId: assignment.dayId,
      assignmentId: assignment.id,
      sessionId,
      schoolId: session.schoolId,
      sectionId: section.id,
      accessGrantId: grantId,
      approximateStudentsPresent: Number(draft.students),
      firstPeriodTeacherPresent: draft.teacher as 'yes' | 'no',
      scheduledClassesHeld:
        draft.classes as ClassPulseResponse['scheduledClassesHeld'],
      electricityAvailable: draft.electricity as 'yes' | 'no',
      fansAndLightsWorking:
        draft.equipment as ClassPulseResponse['fansAndLightsWorking'],
      classroomUsable: draft.usable as 'yes' | 'no',
      drinkingWaterAvailable:
        draft.water as ClassPulseResponse['drinkingWaterAvailable'],
      toiletsAccessible:
        draft.toilet as ClassPulseResponse['toiletsAccessible'],
      mealStatus: draft.meal as ClassPulseResponse['mealStatus'],
      unusualCondition: draft.unusual as ClassPulseResponse['unusualCondition'],
      contextualAnswers: [
        {
          questionId: assignment.contextualQuestion.id,
          answer: draft.context as ObservationAnswer,
        },
      ],
      submittedAtLocal: now.toISOString(),
    }
    const errors = validateClassPulseResponse(response, section)
    if (errors.length) {
      setError(
        errors
          .map((code) =>
            validationMessage(locale, code, { max: section.expectedStrength }),
          )
          .join(' '),
      )
      return
    }
    const completed = transitionTask(assignment, 'submitted', now)
    await repository.saveClassPulseResponse(response)
    await repository.saveClassPulseAssignment(completed)
    await repository.saveSubmission({
      id: ids.create('submission'),
      schoolId: session.schoolId,
      sourceRecordId: response.id,
      kind: 'class_pulse',
      title: `${section.name} Daily Class Check`,
      status: 'submitted',
      visibility: 'operator',
      submittedAtLocal: now.toISOString(),
    })
    await repository.appendAuditEvent({
      id: ids.create('audit'),
      schoolId: session.schoolId,
      type: 'class_pulse_submitted',
      targetId: assignment.id,
      occurredAtLocal: now.toISOString(),
      detail: `${section.name} Daily Class Check completion was stored locally.`,
    })
    await repository.completeSession(sessionId, now)
    setDraft({})
    setGrantId(null)
    setDone(true)
    refresh()
  }

  if (loading) return <LoadingState />
  if (!session || !assignment || !section)
    return (
      <ErrorState message={error || 'This Daily Class Check is unavailable.'} />
    )
  if (done)
    return (
      <Card className="mx-auto max-w-xl p-8 text-center">
        <CheckCircle2 className="success-enter text-stable mx-auto size-11" />
        <h1 className="mt-4 text-2xl font-semibold">{t('common.done')}</h1>
        <p className="text-muted-foreground mt-3">{t('wizard.handBack')}</p>
      </Card>
    )

  if (!grantId)
    return (
      <Card className="mx-auto max-w-xl p-6 sm:p-8">
        <p className="text-primary text-sm font-bold">{section.name}</p>
        <h1 className="mt-2 text-2xl font-semibold">{t('task.classCheck')}</h1>
        <form onSubmit={(event) => void redeem(event)} className="mt-7">
          <label htmlFor="class-code" className="text-sm font-semibold">
            {locale === 'or' ? 'ଆପଣଙ୍କ କୋଡ୍ ଲେଖନ୍ତୁ' : 'Enter your class code'}
          </label>
          <input
            id="class-code"
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

  const yesNo: Array<[string, string]> = [
    ['yes', locale === 'or' ? 'ହଁ' : 'Yes'],
    ['no', locale === 'or' ? 'ନା' : 'No'],
  ]
  const steps: GuidedWizardStep[] = [
    {
      id: 'students',
      question:
        locale === 'or'
          ? 'ଆନୁମାନିକ କେତେ ଜଣ ଛାତ୍ରଛାତ୍ରୀ ଅଛନ୍ତି?'
          : 'About how many students are present?',
      valid:
        draft.students !== '' &&
        Number.isInteger(Number(draft.students)) &&
        Number(draft.students) >= 0 &&
        Number(draft.students) <= section.expectedStrength,
      content: (
        <div>
          <input
            aria-label="Students present"
            type="number"
            min={0}
            max={section.expectedStrength}
            value={draft.students ?? ''}
            onChange={(event) =>
              setDraft({ ...draft, students: event.target.value })
            }
            className="input-control border-input min-h-14 w-full rounded-lg border px-4 text-xl"
          />
          <p className="text-muted-foreground mt-2 text-sm">
            {locale === 'or'
              ? `ନାମଲେଖା: ${section.expectedStrength}`
              : `Students enrolled: ${section.expectedStrength}`}
          </p>
        </div>
      ),
    },
    step(
      'teacher',
      locale === 'or'
        ? 'ପ୍ରଥମ ପିରିୟଡ୍‌ର ଶିକ୍ଷକ ଆସିଥିଲେ କି?'
        : 'Was the first-period teacher present?',
      yesNo,
    ),
    step(
      'classes',
      locale === 'or'
        ? 'ଆଜିର ନିର୍ଦ୍ଧାରିତ କ୍ଲାସ୍ ହୋଇଛି କି?'
        : 'Were the scheduled classes held?',
      [
        ['all', locale === 'or' ? 'ସବୁ' : 'All'],
        ['partial', locale === 'or' ? 'କିଛି' : 'Some'],
        ['none', locale === 'or' ? 'କିଛି ନୁହେଁ' : 'None'],
      ],
    ),
    step(
      'electricity',
      locale === 'or'
        ? 'ଶ୍ରେଣୀରେ ଏବେ ବିଦ୍ୟୁତ୍ ଅଛି କି?'
        : 'Is there electricity in the classroom now?',
      yesNo,
    ),
    step(
      'equipment',
      locale === 'or'
        ? 'ପଙ୍ଖା ଓ ଆଲୋକ କାମ କରୁଛି କି?'
        : 'Are the fans and lights working?',
      [
        ['all', locale === 'or' ? 'ସବୁ' : 'All'],
        ['some', locale === 'or' ? 'କିଛି' : 'Some'],
        ['none', locale === 'or' ? 'କିଛି ନୁହେଁ' : 'None'],
      ],
    ),
    step(
      'usable',
      locale === 'or'
        ? 'ଶ୍ରେଣୀ କକ୍ଷ ବ୍ୟବହାର କରିହେଉଛି କି?'
        : 'Can the classroom be used now?',
      yesNo,
    ),
    step(
      'water',
      locale === 'or'
        ? 'ଆଜି ପିଇବା ପାଣି ମିଳୁଛି କି?'
        : 'Is drinking water available today?',
      [
        ...yesNo,
        ['did_not_check', locale === 'or' ? 'ଦେଖିନାହିଁ' : 'Didn’t check'],
      ],
    ),
    step(
      'toilet',
      locale === 'or'
        ? 'ଶୌଚାଳୟ ବ୍ୟବହାର କରିହେଉଛି କି?'
        : 'Can students use the toilets?',
      [
        ...yesNo,
        ['did_not_check', locale === 'or' ? 'ଦେଖିନାହିଁ' : 'Didn’t check'],
      ],
    ),
    step(
      'meal',
      locale === 'or'
        ? 'ମଧ୍ୟାହ୍ନ ଭୋଜନର ଅବସ୍ଥା କଣ?'
        : 'What is the meal status?',
      [
        ['served', locale === 'or' ? 'ମିଳିଛି' : 'Served'],
        ['not_served', locale === 'or' ? 'ମିଳିନାହିଁ' : 'Not served'],
        ['not_yet', locale === 'or' ? 'ଏପର୍ଯ୍ୟନ୍ତ ନୁହେଁ' : 'Not yet'],
      ],
    ),
    step(
      'unusual',
      locale === 'or'
        ? 'ଆଜି କିଛି ଅସାଧାରଣ ହୋଇଛି କି?'
        : 'Was anything unusual today?',
      [
        ['no_issue', locale === 'or' ? 'କିଛି ନାହିଁ' : 'Nothing unusual'],
        [
          'teacher_absent',
          locale === 'or' ? 'ଶିକ୍ଷକ ଅନୁପସ୍ଥିତ' : 'Teacher absent',
        ],
        ['water_issue', locale === 'or' ? 'ପାଣି ସମସ୍ୟା' : 'Water problem'],
        ['meal_issue', locale === 'or' ? 'ଭୋଜନ ସମସ୍ୟା' : 'Meal problem'],
        [
          'infrastructure_issue',
          locale === 'or'
            ? 'କୋଠା/ଉପକରଣ ସମସ୍ୟା'
            : 'Building or equipment problem',
        ],
        ['other', locale === 'or' ? 'ଅନ୍ୟ' : 'Other'],
      ],
    ),
    step(
      'context',
      locale === 'or'
        ? contextualQuestionOdia(assignment.contextualQuestion.prompt)
        : assignment.contextualQuestion.prompt,
      assignment.contextualQuestion.allowedAnswers.map((answer) => [
        answer,
        answer === 'yes'
          ? locale === 'or'
            ? 'ହଁ'
            : 'Yes'
          : answer === 'no'
            ? locale === 'or'
              ? 'ନା'
              : 'No'
            : locale === 'or'
              ? 'ନିଶ୍ଚିତ ନୁହେଁ'
              : 'Not sure',
      ]),
    ),
  ]
  function step(
    id: string,
    question: string,
    options: Array<[string, string]>,
  ): GuidedWizardStep {
    return {
      id,
      question,
      valid: Boolean(draft[id]),
      content: (
        <AnswerButtons
          value={draft[id] ?? ''}
          options={options}
          onChange={(value) => {
            setDraft((current) => ({ ...current, [id]: value }))
            setError('')
          }}
        />
      ),
    }
  }
  return (
    <div>
      {error ? (
        <p
          role="alert"
          className="text-destructive mx-auto mb-4 max-w-2xl text-sm"
        >
          {error}
        </p>
      ) : null}
      <GuidedWizard steps={steps} onComplete={submit} />
    </div>
  )
}

function contextualQuestionOdia(prompt: string): string {
  const translations: Record<string, string> = {
    'Was Mathematics class conducted today?': 'ଆଜି ଗଣିତ କ୍ଲାସ୍ ହୋଇଥିଲା କି?',
    'Was drinking water available after lunch?':
      'ମଧ୍ୟାହ୍ନ ଭୋଜନ ପରେ ପିଇବା ପାଣି ମିଳିଥିଲା କି?',
    'Were the classroom fans usable during the last period?':
      'ଶେଷ ପିରିୟଡ୍‌ରେ ଶ୍ରେଣୀର ପଙ୍ଖା କାମ କରୁଥିଲା କି?',
    'Was the classroom cleaned before lessons began?':
      'ପାଠ ଆରମ୍ଭ ପୂର୍ବରୁ ଶ୍ରେଣୀ କକ୍ଷ ସଫା ଥିଲା କି?',
  }
  return translations[prompt] ?? prompt
}
