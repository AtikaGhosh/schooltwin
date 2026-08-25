import type {
  ClassPulseAssignment,
  ClassPulseResponse,
  FacilityPulseAssignment,
  FacilityPulseResponse,
  Section,
  SectionCoverageHistoryRecord,
  School,
  VerificationTask,
} from './types'
import { deriveTaskStatus } from './task-state'

export const SCHOOL_TIME_ZONE = 'Asia/Kolkata' as const

export function schoolDateKey(
  now: Date,
  timeZone: string = SCHOOL_TIME_ZONE,
): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

export interface SchoolDayWindow {
  dateKey: string
  opensAt: Date
  closesAt: Date
}

export function schoolDayWindow(
  school: Pick<School, 'timeZone' | 'openingTime' | 'closingTime'>,
  dateKey: string,
): SchoolDayWindow {
  const opensAt = zonedWallTime(dateKey, school.openingTime, school.timeZone)
  const closesAt = zonedWallTime(dateKey, school.closingTime, school.timeZone)
  if (closesAt <= opensAt) {
    throw new Error('School closing time must be after opening time.')
  }
  return { dateKey, opensAt, closesAt }
}

function zonedWallTime(
  dateKey: string,
  wallTime: string,
  timeZone: string,
): Date {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(wallTime)
  if (!dateMatch || !timeMatch) throw new Error('Invalid school date or time.')
  const desired = {
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
  }
  if (desired.hour > 23 || desired.minute > 59)
    throw new Error('Invalid school operating time.')

  const desiredUtc = Date.UTC(
    desired.year,
    desired.month - 1,
    desired.day,
    desired.hour,
    desired.minute,
  )
  let instant = desiredUtc
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(instant))
        .map((part) => [part.type, part.value]),
    )
    const observedUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
    )
    instant += desiredUtc - observedUtc
  }
  return new Date(instant)
}

export function previousOperationalDateKeys(
  currentDateKey: string,
  count: number,
): string[] {
  const results: string[] = []
  let cursor = dateKeyAtNoon(currentDateKey)
  while (results.length < count) {
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1_000)
    const weekday = cursor.getUTCDay()
    if (weekday !== 0 && weekday !== 6) results.push(toDateKey(cursor))
  }
  return results.reverse()
}

export function validateClassPulseResponse(
  response: ClassPulseResponse,
  section: Section,
): ValidationCode[] {
  const errors: ValidationCode[] = []
  if (!Number.isInteger(response.approximateStudentsPresent))
    errors.push('students_integer')
  if (
    response.approximateStudentsPresent < 0 ||
    response.approximateStudentsPresent > section.expectedStrength
  ) {
    errors.push('students_range')
  }
  if (response.contextualAnswers.length !== 1) errors.push('contextual_once')
  if (!isOneOf(response.firstPeriodTeacherPresent, ['yes', 'no']))
    errors.push('invalid_answer')
  if (!isOneOf(response.scheduledClassesHeld, ['all', 'partial', 'none']))
    errors.push('invalid_answer')
  if (!isOneOf(response.electricityAvailable, ['yes', 'no']))
    errors.push('invalid_answer')
  if (!isOneOf(response.fansAndLightsWorking, ['all', 'some', 'none']))
    errors.push('invalid_answer')
  if (!isOneOf(response.classroomUsable, ['yes', 'no']))
    errors.push('invalid_answer')
  if (
    !isOneOf(response.drinkingWaterAvailable, ['yes', 'no', 'did_not_check']) ||
    !isOneOf(response.toiletsAccessible, ['yes', 'no', 'did_not_check'])
  )
    errors.push('invalid_answer')
  if (!isOneOf(response.mealStatus, ['served', 'not_served', 'not_yet']))
    errors.push('invalid_answer')
  if (
    !isOneOf(response.unusualCondition, [
      'no_issue',
      'teacher_absent',
      'water_issue',
      'meal_issue',
      'infrastructure_issue',
      'other',
    ])
  )
    errors.push('invalid_answer')
  if (
    response.contextualAnswers.some(
      (item) =>
        !isOneOf(item.answer, [
          'yes',
          'no',
          'did_not_check',
          'not_sure',
          'not_applicable',
        ]),
    )
  )
    errors.push('invalid_answer')
  return [...new Set(errors)]
}

export type ValidationCode =
  | 'students_integer'
  | 'students_range'
  | 'contextual_once'
  | 'invalid_answer'
  | 'operator_required'

export function validateFacilityPulseResponse(
  response: FacilityPulseResponse,
): ValidationCode[] {
  return response.attributedTo === 'school_operator'
    ? []
    : ['operator_required']
}

export interface OperatorCoverageRow {
  sectionId: string
  sectionName: string
  classPulse: {
    assignmentId: string
    sessionId: string
    status: ReturnType<typeof deriveTaskStatus>
    submittedAtLocal?: string
    scheduledStart: string
    scheduledEnd: string
  }
  liveEvidence: {
    status: ReturnType<typeof deriveTaskStatus>
    submittedAtLocal?: string
    taskId: string
  }
}

export interface OperatorDailyCoverageView {
  dayId: string
  dateKey: string
  totalSections: number
  classPulseSubmitted: number
  liveEvidenceSubmitted: number
  rows: OperatorCoverageRow[]
  facilityPulse: {
    assignmentId: string
    status: ReturnType<typeof deriveTaskStatus>
    submittedAtLocal?: string
    scheduledStart: string
    scheduledEnd: string
  }
  privateStudentSampling: 'inactive' | 'active' | 'completed'
}

export function toOperatorDailyCoverageView(input: {
  dayId: string
  dateKey: string
  now: Date
  sections: Section[]
  classPulseAssignments: ClassPulseAssignment[]
  liveEvidenceTasks: VerificationTask[]
  facilityPulse: FacilityPulseAssignment
  privateStudentSampling: 'inactive' | 'active' | 'completed'
}): OperatorDailyCoverageView {
  const rows = input.sections.map((section) => {
    const pulse = required(
      input.classPulseAssignments.find((item) => item.sectionId === section.id),
      `Missing Class Pulse assignment for ${section.id}.`,
    )
    const evidence = required(
      input.liveEvidenceTasks.find(
        (item) =>
          item.sectionId === section.id && item.liveEvidenceScope === 'class',
      ),
      `Missing Live Evidence task for ${section.id}.`,
    )
    return {
      sectionId: section.id,
      sectionName: section.name,
      classPulse: {
        assignmentId: pulse.id,
        sessionId: pulse.sessionId,
        status: deriveTaskStatus(pulse, input.now),
        submittedAtLocal: pulse.completedAtLocal,
        scheduledStart: pulse.scheduledStart,
        scheduledEnd: pulse.scheduledEnd,
      },
      liveEvidence: {
        status: deriveTaskStatus(evidence, input.now),
        submittedAtLocal: evidence.completedAtLocal,
        taskId: evidence.id,
      },
    }
  })
  return {
    dayId: input.dayId,
    dateKey: input.dateKey,
    totalSections: rows.length,
    classPulseSubmitted: rows.filter(
      (row) => row.classPulse.status === 'submitted',
    ).length,
    liveEvidenceSubmitted: rows.filter(
      (row) => row.liveEvidence.status === 'submitted',
    ).length,
    rows,
    facilityPulse: {
      assignmentId: input.facilityPulse.id,
      status: deriveTaskStatus(input.facilityPulse, input.now),
      submittedAtLocal: input.facilityPulse.completedAtLocal,
      scheduledStart: input.facilityPulse.scheduledStart,
      scheduledEnd: input.facilityPulse.scheduledEnd,
    },
    privateStudentSampling: input.privateStudentSampling,
  }
}

export function mergeSectionHistory(input: {
  schoolId: string
  sectionId: string
  prior: SectionCoverageHistoryRecord[]
  today: OperatorCoverageRow
  todayDateKey: string
}): SectionCoverageHistoryRecord[] {
  const todayRecord: SectionCoverageHistoryRecord = {
    id: `coverage-${input.todayDateKey}-${input.sectionId}`,
    dayId: `pulse-day-${input.todayDateKey}`,
    schoolId: input.schoolId,
    sectionId: input.sectionId,
    dateKey: input.todayDateKey,
    classPulseStatus:
      input.today.classPulse.status === 'submitted'
        ? 'submitted'
        : isTerminalMissing(input.today.classPulse.status)
          ? 'missed'
          : 'pending',
    liveEvidenceStatus:
      input.today.liveEvidence.status === 'submitted'
        ? 'submitted'
        : isTerminalMissing(input.today.liveEvidence.status)
          ? 'missed'
          : 'pending',
  }
  return [
    ...input.prior.filter((item) => item.sectionId === input.sectionId),
    todayRecord,
  ].sort((a, b) => a.dateKey.localeCompare(b.dateKey))
}

function isTerminalMissing(
  status: ReturnType<typeof deriveTaskStatus>,
): boolean {
  return status === 'missed' || status === 'failed'
}

function required<T>(value: T | undefined, message: string): T {
  if (!value) throw new Error(message)
  return value
}

function isOneOf(value: string, allowed: readonly string[]): boolean {
  return allowed.includes(value)
}

function dateKeyAtNoon(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00.000Z`)
}

function toDateKey(value: Date): string {
  return value.toISOString().slice(0, 10)
}
