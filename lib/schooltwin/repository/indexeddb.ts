import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

import { sha256Text } from '../adapters/browser'
import {
  mergeSectionHistory,
  schoolDateKey,
  toOperatorDailyCoverageView,
} from '../domain/daily-coverage'
import { toKioskSessionView, toOperatorSubmissionView } from '../domain/privacy'
import { createDemoSeed } from '../domain/seed'
import { reconcileExpiredTask } from '../domain/task-state'
import type {
  AccessGrant,
  AuditEvent,
  CaptureArtifact,
  ClassPulseAssignment,
  ClassPulseResponse,
  FacilityPulseAssignment,
  FacilityPulseResponse,
  IncidentReport,
  KioskSession,
  LegacyClassRealityCheck,
  PrototypeStorageStatus,
  SchoolPulseDay,
  SectionCoverageHistoryRecord,
  StudentPulseResponse,
  School,
  SchoolArea,
  Section,
  Submission,
  TaskChallenge,
  VerificationTask,
} from '../domain/types'
import type {
  ActiveRedeemedGrantView,
  CaptureBlobRecord,
  MetadataRecord,
  RedeemGrantResult,
  RepositoryDependencies,
  SchoolTwinRepository,
} from './types'
import type { UiLocale } from '../i18n'

export const SCHOOLTWIN_DB_VERSION = 5
export const DEFAULT_SCHOOLTWIN_DB_NAME = 'schooltwin-prototype'

interface SchoolTwinDb extends DBSchema {
  metadata: { key: string; value: MetadataRecord }
  schools: { key: string; value: School }
  areas: { key: string; value: SchoolArea }
  sections: { key: string; value: Section }
  tasks: { key: string; value: VerificationTask }
  challenges: { key: string; value: TaskChallenge }
  sessions: { key: string; value: KioskSession }
  access_grants: {
    key: string
    value: AccessGrant
    indexes: { by_session: string }
  }
  submissions: {
    key: string
    value: Submission
    indexes: { by_submitted_at: string }
  }
  audit_events: {
    key: string
    value: AuditEvent
    indexes: { by_occurred_at: string }
  }
  pulse_responses: { key: string; value: StudentPulseResponse }
  reality_checks: { key: string; value: LegacyClassRealityCheck }
  incident_reports: { key: string; value: IncidentReport }
  capture_artifacts: { key: string; value: CaptureArtifact }
  capture_blobs: { key: string; value: CaptureBlobRecord }
  school_pulse_days: { key: string; value: SchoolPulseDay }
  class_pulse_assignments: { key: string; value: ClassPulseAssignment }
  class_pulse_responses: { key: string; value: ClassPulseResponse }
  facility_pulse_assignments: { key: string; value: FacilityPulseAssignment }
  facility_pulse_responses: { key: string; value: FacilityPulseResponse }
  section_coverage_history: { key: string; value: SectionCoverageHistoryRecord }
}

const ALL_STORES = [
  'metadata',
  'schools',
  'areas',
  'sections',
  'tasks',
  'challenges',
  'sessions',
  'access_grants',
  'submissions',
  'audit_events',
  'pulse_responses',
  'reality_checks',
  'incident_reports',
  'capture_artifacts',
  'capture_blobs',
  'school_pulse_days',
  'class_pulse_assignments',
  'class_pulse_responses',
  'facility_pulse_assignments',
  'facility_pulse_responses',
  'section_coverage_history',
] as const

type SchoolTwinStoreName = (typeof ALL_STORES)[number]

export function openSchoolTwinDb(
  name = DEFAULT_SCHOOLTWIN_DB_NAME,
  version = SCHOOLTWIN_DB_VERSION,
): Promise<IDBPDatabase<SchoolTwinDb>> {
  return openDB<SchoolTwinDb>(name, version, {
    upgrade(db, oldVersion, newVersion, transaction) {
      if (oldVersion < 1 && (newVersion ?? version) >= 1) {
        db.createObjectStore('metadata', { keyPath: 'key' })
        db.createObjectStore('schools', { keyPath: 'id' })
        db.createObjectStore('areas', { keyPath: 'id' })
        db.createObjectStore('sections', { keyPath: 'id' })
        db.createObjectStore('tasks', { keyPath: 'id' })
        db.createObjectStore('challenges', { keyPath: 'id' })
        db.createObjectStore('sessions', { keyPath: 'id' })
        const grants = db.createObjectStore('access_grants', { keyPath: 'id' })
        grants.createIndex('by_session', 'sessionId')
        const submissions = db.createObjectStore('submissions', {
          keyPath: 'id',
        })
        submissions.createIndex('by_submitted_at', 'submittedAtLocal')
        const events = db.createObjectStore('audit_events', { keyPath: 'id' })
        events.createIndex('by_occurred_at', 'occurredAtLocal')
      }

      if (oldVersion < 2 && (newVersion ?? version) >= 2) {
        db.createObjectStore('pulse_responses', { keyPath: 'id' })
        db.createObjectStore('reality_checks', { keyPath: 'id' })
        db.createObjectStore('incident_reports', { keyPath: 'id' })
      }

      if (oldVersion < 3 && (newVersion ?? version) >= 3) {
        db.createObjectStore('capture_artifacts', { keyPath: 'id' })
        db.createObjectStore('capture_blobs', { keyPath: 'key' })
      }

      if (oldVersion < 4 && (newVersion ?? version) >= 4) {
        db.createObjectStore('school_pulse_days', { keyPath: 'id' })
        db.createObjectStore('class_pulse_assignments', { keyPath: 'id' })
        db.createObjectStore('class_pulse_responses', { keyPath: 'id' })
        db.createObjectStore('facility_pulse_assignments', { keyPath: 'id' })
        db.createObjectStore('facility_pulse_responses', { keyPath: 'id' })
        db.createObjectStore('section_coverage_history', { keyPath: 'id' })
      }

      if (oldVersion < 5 && (newVersion ?? version) >= 5 && oldVersion > 0) {
        void transaction
          .objectStore('schools')
          .openCursor()
          .then((cursor) => {
            if (!cursor) return
            return cursor.update({
              ...cursor.value,
              timeZone: 'Asia/Kolkata',
              openingTime: '10:00',
              closingTime: '16:00',
            })
          })
      }
    },
  })
}

export class IndexedDbSchoolTwinRepository implements SchoolTwinRepository {
  private dbPromise: Promise<IDBPDatabase<SchoolTwinDb>> | null = null
  private initializationPromise: Promise<void> | null = null
  private readonly dbName: string
  private readonly now: () => Date
  private readonly hashCode: (value: string) => Promise<string>

  constructor(dependencies: Partial<RepositoryDependencies> = {}) {
    this.dbName = dependencies.dbName ?? DEFAULT_SCHOOLTWIN_DB_NAME
    this.now = dependencies.now ?? (() => new Date())
    this.hashCode = dependencies.hashCode ?? sha256Text
  }

  private db(): Promise<IDBPDatabase<SchoolTwinDb>> {
    this.dbPromise ??= openSchoolTwinDb(this.dbName)
    return this.dbPromise
  }

  async initialize(): Promise<void> {
    this.initializationPromise ??= this.initializeOnce()
    return this.initializationPromise
  }

  private async initializeOnce(): Promise<void> {
    const db = await this.db()
    if ((await db.count('schools')) === 0) {
      await this.resetDemo(this.now())
      return
    }
    const school = (await db.getAll('schools'))[0]
    if (!school)
      throw new Error('The prototype school has not been initialized.')
    const currentDayId = `pulse-day-${schoolDateKey(this.now(), school.timeZone)}`
    if (!(await db.get('school_pulse_days', currentDayId))) {
      await this.backfillDailyCoverage(this.now())
    }
    if (!(await db.get('metadata', 'action-first-seed'))) {
      await this.backfillActionFirstSeed(this.now())
    }
    if (!(await db.get('metadata', 'school-hours-seed'))) {
      await this.backfillSchoolHours(this.now())
    }
  }

  async getSchool(): Promise<School> {
    await this.initialize()
    const school = (await (await this.db()).getAll('schools'))[0]
    if (!school)
      throw new Error('The prototype school has not been initialized.')
    return school
  }

  async getAreas(): Promise<SchoolArea[]> {
    await this.initialize()
    return (await (await this.db()).getAll('areas')).sort((a, b) =>
      a.name.localeCompare(b.name),
    )
  }

  async getSections(): Promise<Section[]> {
    await this.initialize()
    return (await (await this.db()).getAll('sections')).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true }),
    )
  }

  async getSection(id: string): Promise<Section | null> {
    await this.initialize()
    return (await (await this.db()).get('sections', id)) ?? null
  }

  async getTasks(now: Date): Promise<VerificationTask[]> {
    await this.initialize()
    const db = await this.db()
    const currentDayId = `pulse-day-${schoolDateKey(now)}`
    const tasks = (await db.getAll('tasks')).filter(
      (task) => task.collectionDayId === currentDayId,
    )
    const reconciled = tasks.map((task) => reconcileExpiredTask(task, now))
    const changed = reconciled.filter(
      (task, index) => task.status !== tasks[index].status,
    )
    if (changed.length > 0) {
      const tx = db.transaction('tasks', 'readwrite')
      await Promise.all([...changed.map((task) => tx.store.put(task)), tx.done])
    }
    return reconciled.sort(
      (a, b) => Date.parse(a.scheduledStart) - Date.parse(b.scheduledStart),
    )
  }

  async getTask(id: string, now: Date): Promise<VerificationTask | null> {
    await this.initialize()
    const task = await (await this.db()).get('tasks', id)
    if (!task) return null
    const reconciled = reconcileExpiredTask(task, now)
    if (reconciled.status !== task.status) await this.saveTask(reconciled)
    return reconciled
  }

  async saveTask(task: VerificationTask): Promise<void> {
    await this.initialize()
    await (await this.db()).put('tasks', task)
  }

  async getChallenge(taskId: string): Promise<TaskChallenge | null> {
    await this.initialize()
    return (
      (await (await this.db()).get('challenges', `challenge-${taskId}`)) ?? null
    )
  }

  async saveChallenge(challenge: TaskChallenge): Promise<void> {
    await this.initialize()
    const db = await this.db()
    const existing = await this.getChallenge(challenge.taskId)
    if (existing && existing.id !== challenge.id) {
      throw new Error('A challenge has already been issued for this task.')
    }
    await db.put('challenges', existing ?? challenge)
  }

  async getSession(id: string): Promise<KioskSession | null> {
    await this.initialize()
    const db = await this.db()
    const session = await db.get('sessions', id)
    if (!session) return null
    if (
      session.status !== 'completed' &&
      Date.parse(session.expiresAt) < this.now().getTime()
    ) {
      const expired = { ...session, status: 'expired' as const }
      await db.put('sessions', expired)
      return expired
    }
    return session
  }

  async saveSession(session: KioskSession): Promise<void> {
    await this.initialize()
    await (await this.db()).put('sessions', session)
  }

  async redeemAccessGrant(
    sessionId: string,
    code: string,
    now: Date,
  ): Promise<RedeemGrantResult> {
    await this.initialize()
    const db = await this.db()
    const session = await db.get('sessions', sessionId)
    if (!session) return { ok: false, reason: 'wrong_session' }

    const grants = await db.getAllFromIndex(
      'access_grants',
      'by_session',
      sessionId,
    )
    const hash = await this.hashCode(code)
    const grant = grants.find((item) => item.hashedCode === hash)
    if (!grant) return { ok: false, reason: 'invalid' }
    if (grant.status === 'redeemed' || grant.usedAt) {
      return { ok: false, reason: 'used' }
    }
    if (
      grant.status === 'expired' ||
      session.status === 'expired' ||
      now.getTime() > Date.parse(grant.expiresAt)
    ) {
      await db.put('access_grants', { ...grant, status: 'expired' })
      await db.put('sessions', { ...session, status: 'expired' })
      return { ok: false, reason: 'expired' }
    }
    if (
      session.status !== 'issued' ||
      grant.allowedSessionType !== session.type
    ) {
      return { ok: false, reason: 'wrong_session' }
    }

    const redeemed: AccessGrant = {
      ...grant,
      status: 'redeemed',
      usedAt: now.toISOString(),
    }
    const active: KioskSession = {
      ...session,
      status: 'active',
      activatedAtLocal: now.toISOString(),
    }
    const tx = db.transaction(['access_grants', 'sessions'], 'readwrite')
    await Promise.all([
      tx.objectStore('access_grants').put(redeemed),
      tx.objectStore('sessions').put(active),
      tx.done,
    ])
    return {
      ok: true,
      session: toKioskSessionView(active),
      accessGrantId: redeemed.id,
    }
  }

  async getActiveRedeemedGrant(
    sessionId: string,
    now: Date,
  ): Promise<ActiveRedeemedGrantView | null> {
    await this.initialize()
    const db = await this.db()
    const session = await db.get('sessions', sessionId)
    if (
      !session ||
      session.status !== 'active' ||
      now.getTime() > Date.parse(session.expiresAt)
    ) {
      return null
    }
    const grants = await db.getAllFromIndex(
      'access_grants',
      'by_session',
      sessionId,
    )
    const grant = grants.find(
      (item) => item.status === 'redeemed' && Boolean(item.usedAt),
    )
    return grant
      ? { accessGrantId: grant.id, sessionId, status: 'active' }
      : null
  }

  async completeSession(sessionId: string, now: Date): Promise<KioskSession> {
    await this.initialize()
    const db = await this.db()
    const session = await db.get('sessions', sessionId)
    if (!session || session.status !== 'active') {
      throw new Error('Only an active kiosk session can be completed.')
    }
    const completed: KioskSession = {
      ...session,
      status: 'completed',
      completedAtLocal: now.toISOString(),
    }
    await db.put('sessions', completed)
    return completed
  }

  async saveStudentPulseResponse(
    response: StudentPulseResponse,
  ): Promise<void> {
    await this.initialize()
    await (await this.db()).put('pulse_responses', response)
  }

  async getCurrentPulseDay(now: Date): Promise<SchoolPulseDay> {
    await this.initialize()
    const db = await this.db()
    const school = (await db.getAll('schools'))[0]
    if (!school)
      throw new Error('The prototype school has not been initialized.')
    const id = `pulse-day-${schoolDateKey(now, school.timeZone)}`
    const day = await db.get('school_pulse_days', id)
    if (!day) throw new Error('Today’s School Pulse day is missing.')
    return day
  }

  async getClassPulseAssignment(
    id: string,
  ): Promise<ClassPulseAssignment | null> {
    await this.initialize()
    return (await (await this.db()).get('class_pulse_assignments', id)) ?? null
  }

  async saveClassPulseAssignment(
    assignment: ClassPulseAssignment,
  ): Promise<void> {
    await this.initialize()
    await (await this.db()).put('class_pulse_assignments', assignment)
  }

  async saveClassPulseResponse(response: ClassPulseResponse): Promise<void> {
    await this.initialize()
    const db = await this.db()
    const existing = await db.get(
      'class_pulse_responses',
      `response-${response.assignmentId}`,
    )
    if (existing)
      throw new Error('This Class School Pulse has already been submitted.')
    await db.put('class_pulse_responses', response)
  }

  async getFacilityPulseAssignment(
    id: string,
  ): Promise<FacilityPulseAssignment | null> {
    await this.initialize()
    return (
      (await (await this.db()).get('facility_pulse_assignments', id)) ?? null
    )
  }

  async saveFacilityPulseAssignment(
    assignment: FacilityPulseAssignment,
  ): Promise<void> {
    await this.initialize()
    await (await this.db()).put('facility_pulse_assignments', assignment)
  }

  async saveFacilityPulseResponse(
    response: FacilityPulseResponse,
  ): Promise<void> {
    await this.initialize()
    const db = await this.db()
    const existing = await db.get(
      'facility_pulse_responses',
      `response-${response.assignmentId}`,
    )
    if (existing)
      throw new Error('Today’s Facility Pulse has already been submitted.')
    await db.put('facility_pulse_responses', response)
  }

  async getOperatorDailyCoverage(now: Date) {
    await this.initialize()
    const db = await this.db()
    const day = await this.getCurrentPulseDay(now)
    const [sections, storedAssignments, tasks, storedFacilities, sessions] =
      await Promise.all([
        db.getAll('sections'),
        db.getAll('class_pulse_assignments'),
        this.getTasks(now),
        db.getAll('facility_pulse_assignments'),
        db.getAll('sessions'),
      ])
    const assignments = storedAssignments.map((item) =>
      reconcileExpiredTask(item, now),
    )
    const facilities = storedFacilities.map((item) =>
      reconcileExpiredTask(item, now),
    )
    const changedAssignments = assignments.filter(
      (item, index) => item.status !== storedAssignments[index].status,
    )
    const changedFacilities = facilities.filter(
      (item, index) => item.status !== storedFacilities[index].status,
    )
    if (changedAssignments.length || changedFacilities.length) {
      const tx = db.transaction(
        ['class_pulse_assignments', 'facility_pulse_assignments'],
        'readwrite',
      )
      await Promise.all([
        ...changedAssignments.map((item) =>
          tx.objectStore('class_pulse_assignments').put(item),
        ),
        ...changedFacilities.map((item) =>
          tx.objectStore('facility_pulse_assignments').put(item),
        ),
        tx.done,
      ])
    }
    const facilityPulse = facilities.find((item) => item.dayId === day.id)
    if (!facilityPulse)
      throw new Error('Today’s Facility Pulse assignment is missing.')
    const studentSessions = sessions.filter(
      (session) => session.type === 'student_pulse',
    )
    const privateStudentSampling = studentSessions.some(
      (session) => session.status === 'completed',
    )
      ? ('completed' as const)
      : studentSessions.some(
            (session) =>
              session.status === 'issued' || session.status === 'active',
          )
        ? ('active' as const)
        : ('inactive' as const)
    return toOperatorDailyCoverageView({
      dayId: day.id,
      dateKey: day.dateKey,
      now,
      sections: sections.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true }),
      ),
      classPulseAssignments: assignments.filter(
        (item) => item.dayId === day.id,
      ),
      liveEvidenceTasks: tasks,
      facilityPulse,
      privateStudentSampling,
    })
  }

  async getSectionCoverageHistory(
    sectionId: string,
    now: Date,
  ): Promise<SectionCoverageHistoryRecord[]> {
    await this.initialize()
    const db = await this.db()
    const coverage = await this.getOperatorDailyCoverage(now)
    const today = coverage.rows.find((row) => row.sectionId === sectionId)
    if (!today) return []
    return mergeSectionHistory({
      schoolId: (await this.getSchool()).id,
      sectionId,
      prior: await db.getAll('section_coverage_history'),
      today,
      todayDateKey: coverage.dateKey,
    })
  }

  async saveIncidentReport(report: IncidentReport): Promise<void> {
    await this.initialize()
    await (await this.db()).put('incident_reports', report)
  }

  async saveCaptureMetadata(artifact: CaptureArtifact): Promise<void> {
    await this.initialize()
    await (await this.db()).put('capture_artifacts', artifact)
  }

  async getCaptureMetadata(id: string): Promise<CaptureArtifact | null> {
    await this.initialize()
    return (await (await this.db()).get('capture_artifacts', id)) ?? null
  }

  async getCaptureArtifacts(): Promise<CaptureArtifact[]> {
    await this.initialize()
    return (await (await this.db()).getAll('capture_artifacts')).sort(
      (a, b) => Date.parse(b.endedAtLocal) - Date.parse(a.endedAtLocal),
    )
  }

  async saveCaptureBlob(key: string, blob: Blob): Promise<void> {
    await this.initialize()
    await (await this.db()).put('capture_blobs', { key, blob })
  }

  async getCaptureBlob(key: string): Promise<Blob | null> {
    await this.initialize()
    return (await (await this.db()).get('capture_blobs', key))?.blob ?? null
  }

  async getEvidencePlaybackUrl(): Promise<string | null> {
    return null
  }

  async deleteCaptureBlob(key: string): Promise<void> {
    await this.initialize()
    await (await this.db()).delete('capture_blobs', key)
  }

  async saveSubmission(submission: Submission): Promise<void> {
    await this.initialize()
    await (await this.db()).put('submissions', submission)
  }

  async getOperatorSubmissions() {
    await this.initialize()
    const records = await (await this.db()).getAll('submissions')
    return records
      .map(toOperatorSubmissionView)
      .filter((view) => view !== null)
      .sort(
        (a, b) =>
          Date.parse(b.submittedAtLocal) - Date.parse(a.submittedAtLocal),
      )
  }

  async appendAuditEvent(event: AuditEvent): Promise<void> {
    await this.initialize()
    await (await this.db()).put('audit_events', event)
  }

  async getAuditEvents(): Promise<AuditEvent[]> {
    await this.initialize()
    return (await (await this.db()).getAll('audit_events')).sort(
      (a, b) => Date.parse(a.occurredAtLocal) - Date.parse(b.occurredAtLocal),
    )
  }

  async getStorageStatus(): Promise<PrototypeStorageStatus> {
    await this.initialize()
    const record = await (await this.db()).get('metadata', 'prototype-storage')
    if (!record || !('persistenceRequested' in record.value)) {
      throw new Error('Prototype storage status is missing.')
    }
    return record.value
  }

  async saveStorageStatus(status: PrototypeStorageStatus): Promise<void> {
    await this.initialize()
    await (
      await this.db()
    ).put('metadata', {
      key: 'prototype-storage',
      value: status,
    })
  }

  async getUiLocale(): Promise<UiLocale> {
    await this.initialize()
    const record = await (await this.db()).get('metadata', 'ui-locale')
    if (record && 'locale' in record.value) return record.value.locale
    return 'en'
  }

  async saveUiLocale(locale: UiLocale): Promise<void> {
    await this.initialize()
    await (
      await this.db()
    ).put('metadata', {
      key: 'ui-locale',
      value: { locale },
    })
  }

  private async backfillDailyCoverage(now: Date): Promise<void> {
    const db = await this.db()
    const seed = await createDemoSeed(now, this.hashCode)
    const stores = [
      'areas',
      'sections',
      'tasks',
      'sessions',
      'access_grants',
      'submissions',
      'audit_events',
      'school_pulse_days',
      'class_pulse_assignments',
      'class_pulse_responses',
      'facility_pulse_assignments',
      'facility_pulse_responses',
      'section_coverage_history',
    ] as const
    const tx = db.transaction(stores, 'readwrite')
    await Promise.all(
      seed.areas.map((item) => tx.objectStore('areas').put(item)),
    )
    await Promise.all(
      seed.sections.map((item) => tx.objectStore('sections').put(item)),
    )
    await Promise.all(
      seed.tasks.map((item) => tx.objectStore('tasks').put(item)),
    )
    await Promise.all(
      seed.sessions.map((item) => tx.objectStore('sessions').put(item)),
    )
    await Promise.all(
      seed.accessGrants.map((item) =>
        tx.objectStore('access_grants').put(item),
      ),
    )
    await Promise.all(
      seed.submissions.map((item) => tx.objectStore('submissions').put(item)),
    )
    await Promise.all(
      seed.auditEvents.map((item) => tx.objectStore('audit_events').put(item)),
    )
    await Promise.all(
      seed.pulseDays.map((item) =>
        tx.objectStore('school_pulse_days').put(item),
      ),
    )
    await Promise.all(
      seed.classPulseAssignments.map((item) =>
        tx.objectStore('class_pulse_assignments').put(item),
      ),
    )
    await Promise.all(
      seed.classPulseResponses.map((item) =>
        tx.objectStore('class_pulse_responses').put(item),
      ),
    )
    await Promise.all(
      seed.facilityPulseAssignments.map((item) =>
        tx.objectStore('facility_pulse_assignments').put(item),
      ),
    )
    await Promise.all(
      seed.facilityPulseResponses.map((item) =>
        tx.objectStore('facility_pulse_responses').put(item),
      ),
    )
    await Promise.all(
      seed.coverageHistory.map((item) =>
        tx.objectStore('section_coverage_history').put(item),
      ),
    )
    await tx.done
  }

  private async backfillActionFirstSeed(now: Date): Promise<void> {
    const db = await this.db()
    const seed = await createDemoSeed(now, this.hashCode)
    const facility = seed.facilityPulseAssignments[0]
    const facilityResponse = seed.facilityPulseResponses[0]
    const waterTask = seed.tasks.find(
      (item) => item.id === 'task-live-water-daily',
    )!
    const existingFacility = await db.get(
      'facility_pulse_assignments',
      facility.id,
    )
    const waterSubmission = (await db.getAll('submissions')).some(
      (item) => item.taskId === waterTask.id,
    )
    const stores = [
      'metadata',
      'facility_pulse_assignments',
      'facility_pulse_responses',
      'tasks',
      'submissions',
      'audit_events',
    ] as const
    const tx = db.transaction(stores, 'readwrite')
    if (existingFacility?.status !== 'submitted') {
      await tx.objectStore('facility_pulse_assignments').put(facility)
      await tx.objectStore('facility_pulse_responses').put(facilityResponse)
      const submission = seed.submissions.find(
        (item) => item.kind === 'facility_pulse',
      )!
      const event = seed.auditEvents.find(
        (item) => item.type === 'facility_pulse_submitted',
      )!
      await tx.objectStore('submissions').put(submission)
      await tx.objectStore('audit_events').put(event)
    }
    if (!waterSubmission) await tx.objectStore('tasks').put(waterTask)
    await tx
      .objectStore('metadata')
      .put({ key: 'action-first-seed', value: { actionFirstSeedVersion: 1 } })
    await tx.done
  }

  private async backfillSchoolHours(now: Date): Promise<void> {
    const db = await this.db()
    const seed = await createDemoSeed(now, this.hashCode)
    const stores = [
      'metadata',
      'schools',
      'tasks',
      'class_pulse_assignments',
      'facility_pulse_assignments',
      'sessions',
      'access_grants',
    ] as const
    const tx = db.transaction(stores, 'readwrite')
    const schoolStore = tx.objectStore('schools')
    const existingSchool = await schoolStore.get(seed.school.id)
    await schoolStore.put({
      ...(existingSchool ?? seed.school),
      timeZone: seed.school.timeZone,
      openingTime: seed.school.openingTime,
      closingTime: seed.school.closingTime,
    })

    for (const seeded of seed.tasks) {
      const store = tx.objectStore('tasks')
      const existing = await store.get(seeded.id)
      if (!existing) continue
      await store.put({
        ...existing,
        scheduledStart: seeded.scheduledStart,
        scheduledEnd: seeded.scheduledEnd,
        status:
          existing.status === 'submitted' || existing.status === 'in_progress'
            ? existing.status
            : 'scheduled',
      })
    }
    for (const seeded of seed.classPulseAssignments) {
      const store = tx.objectStore('class_pulse_assignments')
      const existing = await store.get(seeded.id)
      if (!existing) continue
      await store.put({
        ...existing,
        scheduledStart: seeded.scheduledStart,
        scheduledEnd: seeded.scheduledEnd,
        status:
          existing.status === 'submitted' || existing.status === 'in_progress'
            ? existing.status
            : 'scheduled',
      })
    }
    for (const seeded of seed.facilityPulseAssignments) {
      const store = tx.objectStore('facility_pulse_assignments')
      const existing = await store.get(seeded.id)
      if (!existing) continue
      await store.put({
        ...existing,
        scheduledStart: seeded.scheduledStart,
        scheduledEnd: seeded.scheduledEnd,
      })
    }
    for (const seeded of seed.sessions) {
      const store = tx.objectStore('sessions')
      const existing = await store.get(seeded.id)
      if (existing)
        await store.put({ ...existing, expiresAt: seeded.expiresAt })
    }
    for (const seeded of seed.accessGrants) {
      const store = tx.objectStore('access_grants')
      const existing = await store.get(seeded.id)
      if (existing)
        await store.put({ ...existing, expiresAt: seeded.expiresAt })
    }
    await tx.objectStore('metadata').put({
      key: 'school-hours-seed',
      value: { schoolHoursSeedVersion: 1 },
    })
    await tx.done
  }

  async resetDemo(now = this.now()): Promise<void> {
    const db = await this.db()
    const localeRecord = await db.get('metadata', 'ui-locale')
    const seed = await createDemoSeed(now, this.hashCode)
    const tx = db.transaction(ALL_STORES, 'readwrite')

    await Promise.all(ALL_STORES.map((store) => tx.objectStore(store).clear()))

    await tx.objectStore('schools').put(seed.school)
    await tx.objectStore('metadata').put({
      key: 'device',
      value: {
        deviceId: seed.device.id,
        schoolId: seed.device.schoolId,
      },
    })
    if (localeRecord) await tx.objectStore('metadata').put(localeRecord)
    await tx.objectStore('metadata').put({
      key: 'action-first-seed',
      value: { actionFirstSeedVersion: 1 },
    })
    await tx.objectStore('metadata').put({
      key: 'school-hours-seed',
      value: { schoolHoursSeedVersion: 1 },
    })
    await tx.objectStore('metadata').put({
      key: seed.storageStatus.id,
      value: seed.storageStatus,
    })
    await Promise.all(
      seed.areas.map((area) => tx.objectStore('areas').put(area)),
    )
    await Promise.all(
      seed.sections.map((section) => tx.objectStore('sections').put(section)),
    )
    await Promise.all(
      seed.pulseDays.map((day) => tx.objectStore('school_pulse_days').put(day)),
    )
    await Promise.all(
      seed.classPulseAssignments.map((assignment) =>
        tx.objectStore('class_pulse_assignments').put(assignment),
      ),
    )
    await Promise.all(
      seed.classPulseResponses.map((response) =>
        tx.objectStore('class_pulse_responses').put(response),
      ),
    )
    await Promise.all(
      seed.facilityPulseAssignments.map((assignment) =>
        tx.objectStore('facility_pulse_assignments').put(assignment),
      ),
    )
    await Promise.all(
      seed.facilityPulseResponses.map((response) =>
        tx.objectStore('facility_pulse_responses').put(response),
      ),
    )
    await Promise.all(
      seed.coverageHistory.map((record) =>
        tx.objectStore('section_coverage_history').put(record),
      ),
    )
    await Promise.all(
      seed.tasks.map((task) => tx.objectStore('tasks').put(task)),
    )
    await Promise.all(
      seed.sessions.map((session) => tx.objectStore('sessions').put(session)),
    )
    await Promise.all(
      seed.accessGrants.map((grant) =>
        tx.objectStore('access_grants').put(grant),
      ),
    )
    await Promise.all(
      seed.submissions.map((submission) =>
        tx.objectStore('submissions').put(submission),
      ),
    )
    await Promise.all(
      seed.auditEvents.map((event) =>
        tx.objectStore('audit_events').put(event),
      ),
    )
    await tx.done
  }

  close(): void {
    if (this.dbPromise) {
      void this.dbPromise.then((db) => db.close())
      this.dbPromise = null
      this.initializationPromise = null
    }
  }
}

export type { SchoolTwinDb, SchoolTwinStoreName }
