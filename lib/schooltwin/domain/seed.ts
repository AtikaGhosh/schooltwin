import {
  previousOperationalDateKeys,
  schoolDayWindow,
  schoolDateKey,
  SCHOOL_TIME_ZONE,
} from './daily-coverage'
import type {
  AccessGrant,
  AuditEvent,
  ClassPulseAssignment,
  ClassPulseResponse,
  FacilityPulseAssignment,
  FacilityPulseResponse,
  KioskSession,
  PrototypeStorageStatus,
  School,
  SchoolArea,
  SchoolDevice,
  SchoolPulseDay,
  Section,
  SectionCoverageHistoryRecord,
  Submission,
  VerificationTask,
} from './types'

export const DEMO_SCHOOL_ID = 'school-sundarpur'
export const DEMO_DEVICE_ID = 'device-sundarpur-01'

export const DEMO_CODES = {
  classPulse8A: 'C8A-M9T',
  studentPulse: 'P7K-4M9',
  privateReport: 'R3T-8Q2',
} as const

const CLASS_NAMES = [
  '1A',
  '1B',
  '2A',
  '2B',
  '3A',
  '3B',
  '4A',
  '4B',
  '5A',
  '5B',
  '6A',
  '6B',
  '7A',
  '7B',
  '8A',
  '8B',
  '9A',
  '9B',
] as const
const CODE_SUFFIXES = [
  'K2F',
  'P7M',
  'T4Q',
  'N8R',
  'V3H',
  'D9L',
  'W5C',
  'G2X',
  'R7J',
  'B4N',
  'Y8P',
  'F6K',
  'Q3V',
  'H7D',
  'M9T',
  'X2G',
  'L5W',
  'S8B',
] as const

export const DEMO_CLASS_PULSE_CODES: Record<string, string> =
  Object.fromEntries(
    CLASS_NAMES.map((name, index) => [
      name,
      name === '8A'
        ? DEMO_CODES.classPulse8A
        : `C${name}-${CODE_SUFFIXES[index]}`,
    ]),
  )

export interface DemoSeed {
  school: School
  device: SchoolDevice
  areas: SchoolArea[]
  sections: Section[]
  pulseDays: SchoolPulseDay[]
  classPulseAssignments: ClassPulseAssignment[]
  classPulseResponses: ClassPulseResponse[]
  facilityPulseAssignments: FacilityPulseAssignment[]
  facilityPulseResponses: FacilityPulseResponse[]
  coverageHistory: SectionCoverageHistoryRecord[]
  tasks: VerificationTask[]
  sessions: KioskSession[]
  accessGrants: AccessGrant[]
  submissions: Submission[]
  auditEvents: AuditEvent[]
  storageStatus: PrototypeStorageStatus
}

function atOffset(now: Date, minutes: number): string {
  return new Date(now.getTime() + minutes * 60_000).toISOString()
}

export async function createDemoSeed(
  now: Date,
  hashCode: (code: string) => Promise<string>,
): Promise<DemoSeed> {
  const currentDateKey = schoolDateKey(now)
  const historyDateKeys = previousOperationalDateKeys(currentDateKey, 4)
  const allDateKeys = [...historyDateKeys, currentDateKey]
  const currentDayId = `pulse-day-${currentDateKey}`
  const pairedAtLocal = atOffset(now, -60 * 24 * 5)
  const school: School = {
    id: DEMO_SCHOOL_ID,
    schoolTwinId: 'ST-OD-1048',
    name: 'Sundarpur Government High School',
    district: 'Sundarpur',
    state: 'Odisha',
    studentCount: 684,
    teacherCount: 31,
    sectionCount: 18,
    timeZone: SCHOOL_TIME_ZONE,
    openingTime: '10:00',
    closingTime: '16:00',
    pairedAtLocal,
  }
  const dailyWindow = schoolDayWindow(school, currentDateKey)
  const opensAt = dailyWindow.opensAt.getTime()
  const closesAt = dailyWindow.closesAt.getTime()
  const withinSchoolDay = (minutesAfterOpening: number) =>
    new Date(opensAt + minutesAfterOpening * 60_000).toISOString()
  const dailyStart = dailyWindow.opensAt.toISOString()
  const dailyEnd = dailyWindow.closesAt.toISOString()
  const participantExpiry = new Date(closesAt + 5 * 60_000).toISOString()
  const device: SchoolDevice = {
    id: DEMO_DEVICE_ID,
    schoolId: school.id,
    label: 'Sundarpur SchoolTwin device',
    pairedAtLocal,
    prototypePairing: true,
  }
  const mainBuilding: SchoolArea = {
    id: 'area-main-building',
    schoolId: school.id,
    name: 'Main Building',
    kind: 'building',
    description: 'Teaching rooms and the school office.',
  }
  const classroomAreas: SchoolArea[] = CLASS_NAMES.map((name) => ({
    id: `area-class-${name.toLowerCase()}`,
    schoolId: school.id,
    parentAreaId: mainBuilding.id,
    name: `Class ${name}`,
    kind: 'classroom',
    description: `Operational area for Class ${name}.`,
    markerValue: `schooltwin://ST-OD-1048/class/${name}`,
  }))
  const facilities: SchoolArea[] = [
    ['water', 'Drinking Water', 'Monitored drinking-water point.'],
    ['boys-toilet', 'Boys Toilet', 'Boys sanitation facility.'],
    ['girls-toilet', 'Girls Toilet', 'Girls sanitation facility.'],
    ['kitchen', 'Kitchen', 'Mid-day meal preparation area.'],
    ['electricity', 'Electricity', 'School-wide electricity supply.'],
    ['library', 'Library', 'School library and reading area.'],
    ['playground', 'Playground', 'Outdoor school activity area.'],
  ].map(([key, name, description]) => ({
    id: `area-${key}`,
    schoolId: school.id,
    name,
    kind: key === 'playground' ? 'outdoor' : 'facility',
    description,
    markerValue: `schooltwin://ST-OD-1048/facility/${key}`,
  }))
  const sections: Section[] = CLASS_NAMES.map((name, index) => ({
    id: `section-${name.toLowerCase()}`,
    schoolId: school.id,
    areaId: `area-class-${name.toLowerCase()}`,
    name: `Class ${name}`,
    expectedStrength: 34 + (index % 9),
  }))
  const pulseDays: SchoolPulseDay[] = allDateKeys.map((dateKey) => ({
    id: `pulse-day-${dateKey}`,
    schoolId: school.id,
    dateKey,
    timeZone: SCHOOL_TIME_ZONE,
    createdAtLocal: now.toISOString(),
  }))
  const openPulseSections = new Set(['7B', '8A', '8B', '9A'])
  const contextualPrompts = [
    'Was Mathematics class conducted today?',
    'Was drinking water available after lunch?',
    'Were the classroom fans usable during the last period?',
    'Was the classroom cleaned before lessons began?',
  ]

  const classPulseAssignments: ClassPulseAssignment[] = sections.map(
    (section, index) => {
      const name = section.name.replace('Class ', '')
      const submitted = !openPulseSections.has(name)
      return {
        id: `class-pulse-${currentDateKey}-${name.toLowerCase()}`,
        dayId: currentDayId,
        schoolId: school.id,
        sectionId: section.id,
        sessionId: `session-class-pulse-${currentDateKey}-${name.toLowerCase()}`,
        scheduledStart: dailyStart,
        scheduledEnd: dailyEnd,
        startedAtLocal: submitted ? withinSchoolDay(12 + index * 4) : undefined,
        completedAtLocal: submitted
          ? withinSchoolDay(14 + index * 4)
          : undefined,
        status: submitted ? 'submitted' : 'scheduled',
        contextualQuestion: {
          id: `context-${name.toLowerCase()}`,
          prompt: contextualPrompts[index % contextualPrompts.length],
          allowedAnswers: ['yes', 'no', 'not_sure'],
        },
        createdAt: atOffset(now, -120),
      }
    },
  )

  const classPulseResponses: ClassPulseResponse[] = classPulseAssignments
    .filter((assignment) => assignment.status === 'submitted')
    .map((assignment, index) => {
      const section = sections.find((item) => item.id === assignment.sectionId)!
      return {
        id: `response-${assignment.id}`,
        dayId: assignment.dayId,
        assignmentId: assignment.id,
        sessionId: assignment.sessionId,
        schoolId: school.id,
        sectionId: assignment.sectionId,
        accessGrantId: `grant-${assignment.id}`,
        approximateStudentsPresent: Math.max(
          0,
          section.expectedStrength - (index % 5),
        ),
        firstPeriodTeacherPresent: 'yes',
        scheduledClassesHeld: index % 6 === 0 ? 'partial' : 'all',
        electricityAvailable: 'yes',
        fansAndLightsWorking: index % 4 === 0 ? 'some' : 'all',
        classroomUsable: 'yes',
        drinkingWaterAvailable: 'yes',
        toiletsAccessible: 'yes',
        mealStatus: 'served',
        unusualCondition: index % 6 === 0 ? 'other' : 'no_issue',
        contextualAnswers: [
          {
            questionId: assignment.contextualQuestion.id,
            answer: index % 7 === 0 ? 'not_sure' : 'yes',
          },
        ],
        submittedAtLocal: assignment.completedAtLocal!,
      }
    })

  const classSessions: KioskSession[] = classPulseAssignments.map(
    (assignment) => ({
      id: assignment.sessionId,
      schoolId: school.id,
      type: 'class_pulse',
      assignmentId: assignment.id,
      sectionId: assignment.sectionId,
      status: assignment.status === 'submitted' ? 'completed' : 'issued',
      issuedAtLocal: dailyStart,
      activatedAtLocal: assignment.startedAtLocal,
      completedAtLocal: assignment.completedAtLocal,
      expiresAt: participantExpiry,
    }),
  )

  const classGrants: AccessGrant[] = await Promise.all(
    classPulseAssignments.map(async (assignment) => {
      const section = sections.find((item) => item.id === assignment.sectionId)!
      const name = section.name.replace('Class ', '')
      const submitted = assignment.status === 'submitted'
      return {
        id: `grant-${assignment.id}`,
        sessionId: assignment.sessionId,
        hashedCode: await hashCode(DEMO_CLASS_PULSE_CODES[name]),
        allowedSessionType: 'class_pulse',
        sectionId: section.id,
        expiresAt: participantExpiry,
        usedAt: submitted ? assignment.startedAtLocal : undefined,
        status: submitted ? 'redeemed' : 'issued',
      }
    }),
  )

  const tasks = createTodayLiveEvidenceTasks(
    now,
    currentDayId,
    school.id,
    dailyWindow.opensAt,
    dailyWindow.closesAt,
  )
  const facilityPulseAssignments: FacilityPulseAssignment[] = [
    {
      id: `facility-pulse-${currentDateKey}`,
      dayId: currentDayId,
      schoolId: school.id,
      scheduledStart: dailyStart,
      scheduledEnd: dailyEnd,
      startedAtLocal: withinSchoolDay(8),
      completedAtLocal: withinSchoolDay(12),
      status: 'submitted',
      createdAt: atOffset(now, -120),
    },
  ]
  const facilityPulseResponses: FacilityPulseResponse[] = [
    {
      id: `response-facility-pulse-${currentDateKey}`,
      dayId: currentDayId,
      assignmentId: facilityPulseAssignments[0].id,
      schoolId: school.id,
      attributedTo: 'school_operator',
      drinkingWater: 'available',
      boysToilet: 'usable',
      girlsToilet: 'usable',
      kitchen: 'operational',
      electricity: 'available',
      library: 'operational',
      playground: 'operational',
      submittedAtLocal: facilityPulseAssignments[0].completedAtLocal!,
    },
  ]
  const studentSession: KioskSession = {
    id: 'session-student-pulse-demo',
    schoolId: school.id,
    type: 'student_pulse',
    sectionId: 'section-8a',
    status: 'issued',
    issuedAtLocal: now.toISOString(),
    expiresAt: participantExpiry,
  }
  const privateReportSession: KioskSession = {
    id: 'session-private-report-demo',
    schoolId: school.id,
    type: 'private_report',
    status: 'issued',
    issuedAtLocal: now.toISOString(),
    expiresAt: participantExpiry,
  }
  const supplementalGrants: AccessGrant[] = [
    {
      id: 'grant-student-pulse-demo',
      sessionId: studentSession.id,
      hashedCode: await hashCode(DEMO_CODES.studentPulse),
      allowedSessionType: 'student_pulse',
      sectionId: studentSession.sectionId,
      expiresAt: studentSession.expiresAt,
      status: 'issued',
    },
    {
      id: 'grant-private-report-demo',
      sessionId: privateReportSession.id,
      hashedCode: await hashCode(DEMO_CODES.privateReport),
      allowedSessionType: 'private_report',
      expiresAt: privateReportSession.expiresAt,
      status: 'issued',
    },
  ]
  const coverageHistory = createCoverageHistory(
    historyDateKeys,
    sections,
    school.id,
  )
  const submissions: Submission[] = []
  const auditEvents: AuditEvent[] = [
    {
      id: 'audit-demo-reset',
      schoolId: school.id,
      type: 'demo_reset',
      occurredAtLocal: now.toISOString(),
      detail:
        'Sundarpur daily coverage prototype data was reset and re-seeded.',
    },
  ]

  for (const response of classPulseResponses) {
    const section = sections.find((item) => item.id === response.sectionId)!
    submissions.push({
      id: `submission-${response.assignmentId}`,
      schoolId: school.id,
      sourceRecordId: response.id,
      kind: 'class_pulse',
      title: `${section.name} School Pulse`,
      status: 'submitted',
      visibility: 'operator',
      submittedAtLocal: response.submittedAtLocal,
    })
    auditEvents.push({
      id: `audit-${response.assignmentId}`,
      schoolId: school.id,
      type: 'class_pulse_submitted',
      targetId: response.assignmentId,
      occurredAtLocal: response.submittedAtLocal,
      detail: `${section.name} School Pulse completion was stored locally.`,
    })
  }
  for (const task of tasks.filter((item) => item.status === 'submitted')) {
    submissions.push({
      id: `submission-${task.id}`,
      schoolId: school.id,
      taskId: task.id,
      sourceRecordId: `seed-record-${task.id}`,
      kind: 'live_evidence',
      title: task.title,
      status: 'submitted',
      visibility: 'operator',
      submittedAtLocal: task.completedAtLocal!,
    })
    auditEvents.push({
      id: `audit-${task.id}`,
      schoolId: school.id,
      type: 'capture_submitted',
      targetId: task.id,
      occurredAtLocal: task.completedAtLocal!,
      detail: `${task.title} has a seeded local completion record.`,
    })
  }
  for (const response of facilityPulseResponses) {
    submissions.push({
      id: `submission-${response.assignmentId}`,
      schoolId: school.id,
      sourceRecordId: response.id,
      kind: 'facility_pulse',
      title: 'Daily Facility Check',
      status: 'submitted',
      visibility: 'operator',
      submittedAtLocal: response.submittedAtLocal,
    })
    auditEvents.push({
      id: `audit-${response.assignmentId}`,
      schoolId: school.id,
      type: 'facility_pulse_submitted',
      targetId: response.assignmentId,
      occurredAtLocal: response.submittedAtLocal,
      detail: 'The daily Facility Check completion was stored locally.',
    })
  }

  return {
    school,
    device,
    areas: [mainBuilding, ...classroomAreas, ...facilities],
    sections,
    pulseDays,
    classPulseAssignments,
    classPulseResponses,
    facilityPulseAssignments,
    facilityPulseResponses,
    coverageHistory,
    tasks,
    sessions: [...classSessions, studentSession, privateReportSession],
    accessGrants: [...classGrants, ...supplementalGrants],
    submissions,
    auditEvents,
    storageStatus: {
      id: 'prototype-storage',
      persistenceRequested: false,
      persistenceGranted: null,
    },
  }
}

function createTodayLiveEvidenceTasks(
  now: Date,
  dayId: string,
  schoolId: string,
  opensAt: Date,
  closesAt: Date,
): VerificationTask[] {
  const dailyStart = opensAt.toISOString()
  const dailyEnd = closesAt.toISOString()
  const completedAt = (index: number) =>
    new Date(opensAt.getTime() + (35 + index * 6) * 60_000).toISOString()
  const classTasks: VerificationTask[] = CLASS_NAMES.map((name, index) => {
    const submitted = index < 12
    return {
      id: `task-live-${name.toLowerCase()}-daily`,
      schoolId,
      collectionDayId: dayId,
      areaId: `area-class-${name.toLowerCase()}`,
      sectionId: `section-${name.toLowerCase()}`,
      type: 'live_evidence',
      liveEvidenceScope: 'class',
      title: `Class ${name} Live Attendance Evidence`,
      instructions: `Record one continuous view of Class ${name} using today’s prototype challenge.`,
      scheduledStart: dailyStart,
      scheduledEnd: dailyEnd,
      startedAtLocal: submitted ? completedAt(index - 1) : undefined,
      completedAtLocal: submitted ? completedAt(index) : undefined,
      status: submitted ? 'submitted' : 'scheduled',
      participantType: 'school_operator',
      challengeRequired: true,
      createdAt: atOffset(now, -120),
    }
  })
  return [
    ...classTasks,
    {
      id: 'task-live-kitchen-daily',
      schoolId,
      collectionDayId: dayId,
      areaId: 'area-kitchen',
      type: 'live_evidence',
      liveEvidenceScope: 'facility',
      title: 'Kitchen Live Evidence',
      instructions:
        'Record one continuous view of the kitchen operational area.',
      scheduledStart: dailyStart,
      scheduledEnd: dailyEnd,
      startedAtLocal: completedAt(12),
      completedAtLocal: completedAt(13),
      status: 'submitted',
      participantType: 'school_operator',
      challengeRequired: true,
      createdAt: atOffset(now, -120),
    },
    {
      id: 'task-live-water-daily',
      schoolId,
      collectionDayId: dayId,
      areaId: 'area-water',
      type: 'live_evidence',
      liveEvidenceScope: 'facility',
      title: 'Drinking Water Live Evidence',
      instructions: 'Record one continuous view of the drinking-water point.',
      scheduledStart: dailyStart,
      scheduledEnd: dailyEnd,
      status: 'scheduled',
      participantType: 'school_operator',
      challengeRequired: true,
      createdAt: atOffset(now, -120),
    },
  ]
}

function createCoverageHistory(
  dateKeys: string[],
  sections: Section[],
  schoolId: string,
): SectionCoverageHistoryRecord[] {
  return dateKeys.flatMap((dateKey, dayIndex) =>
    sections.map((section) => {
      const name = section.name.replace('Class ', '')
      const latestDay = dayIndex === dateKeys.length - 1
      const previousDay = dayIndex === dateKeys.length - 2
      const classPulseStatus =
        latestDay && (name === '8B' || name === '7B') ? 'missed' : 'submitted'
      const liveEvidenceStatus =
        (latestDay && name === '8B') || (previousDay && name === '8B')
          ? 'missed'
          : 'submitted'
      return {
        id: `coverage-${dateKey}-${section.id}`,
        dayId: `pulse-day-${dateKey}`,
        schoolId,
        sectionId: section.id,
        dateKey,
        classPulseStatus,
        liveEvidenceStatus,
      }
    }),
  )
}
