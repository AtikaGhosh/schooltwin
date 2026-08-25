'use client'

import {
  schoolDateKey,
  toOperatorDailyCoverageView,
} from '../domain/daily-coverage'
import type {
  AuditEvent,
  CaptureArtifact,
  ClassPulseAssignment,
  ClassPulseResponse,
  FacilityPulseAssignment,
  FacilityPulseResponse,
  IncidentReport,
  KioskSession,
  PrototypeStorageStatus,
  School,
  SchoolArea,
  SchoolPulseDay,
  Section,
  SectionCoverageHistoryRecord,
  StudentPulseResponse,
  TaskChallenge,
  VerificationTask,
} from '../domain/types'
import type { UiLocale } from '../i18n'
import { ProductionCache } from '../backend/production-cache'
import { ServerRejectedError, WaitingToSendError } from '../backend/errors'
import { ProductionSchoolTwinService } from '../backend/production-service'
import type { SyncPullResult } from '../backend/contracts'
import type {
  ActiveRedeemedGrantView,
  RedeemGrantResult,
  SchoolTwinRepository,
} from './types'
import type { OperatorSubmissionView } from '../domain/privacy'
import type { OperatorDailyCoverageView } from '../domain/daily-coverage'

export class ProductionSchoolTwinRepository implements SchoolTwinRepository {
  private readonly cache = new ProductionCache()
  private readonly service = new ProductionSchoolTwinService(this.cache)
  private snapshot: SyncPullResult | null = null
  private activeSessionId: string | null = null
  private readonly drafts = new Map<string, Blob>()

  async initialize(): Promise<void> {
    try {
      this.snapshot = await this.service.pull()
      await this.service.push()
      await this.service.flushQueuedCaptures()
    } catch (cause) {
      this.snapshot = await this.cache.getSnapshot()
      if (!this.snapshot) throw cause
      const device = await this.cache.getDevice()
      if (!device || new Date(device.leaseExpiresAt) <= new Date()) {
        throw new Error('online_device_authorization_required')
      }
    }
  }

  async synchronize(): Promise<void> {
    this.snapshot = await this.service.pull()
    await this.service.push()
    await this.service.flushQueuedCaptures()
  }

  async getSchool(): Promise<School> {
    const school = this.requireSnapshot().school
    return {
      id: school.id,
      schoolTwinId: school.school_twin_id,
      name: school.name,
      district: school.district,
      state: school.state,
      studentCount: this.sections().reduce(
        (sum, section) => sum + section.expectedStrength,
        0,
      ),
      teacherCount: 0,
      sectionCount: this.sections().length,
      timeZone: school.time_zone,
      openingTime: school.opening_time.slice(0, 5),
      closingTime: school.closing_time.slice(0, 5),
      pairedAtLocal: this.requireSnapshot().serverTime,
    }
  }

  async getAreas(): Promise<SchoolArea[]> {
    return this.areas()
  }
  async getSections(): Promise<Section[]> {
    return this.sections()
  }
  async getSection(id: string): Promise<Section | null> {
    return this.sections().find((item) => item.id === id) ?? null
  }
  async getTasks(): Promise<VerificationTask[]> {
    return this.tasks()
  }
  async getTask(id: string): Promise<VerificationTask | null> {
    return this.tasks().find((item) => item.id === id) ?? null
  }
  async saveTask(): Promise<void> {
    /* Server transitions are made only by accepted transactions. */
  }

  async getChallenge(taskId: string): Promise<TaskChallenge | null> {
    const raw = this.requireSnapshot().challenges.find(
      (item) =>
        value(
          item as unknown as Record<string, unknown>,
          'task_id',
          'taskId',
        ) === taskId,
    )
    return raw ? mapChallenge(raw as unknown as Record<string, unknown>) : null
  }
  async saveChallenge(): Promise<void> {
    /* Server issues production challenges. */
  }

  async getSession(id: string): Promise<KioskSession | null> {
    const assignment = this.classAssignments().find(
      (item) => item.sessionId === id,
    )
    if (!assignment) {
      const launches = this.requireSnapshot().participantLaunches
      if (launches.studentPulseSessionId === id) {
        return {
          id,
          schoolId: this.requireSnapshot().school.id,
          type: 'student_pulse',
          status: this.activeSessionId === id ? 'active' : 'issued',
          issuedAtLocal: this.requireSnapshot().serverTime,
          expiresAt: this.requireSnapshot().deviceLeaseExpiresAt,
        }
      }
      if (launches.privateReportSessionId === id) {
        return {
          id,
          schoolId: this.requireSnapshot().school.id,
          type: 'private_report',
          status: this.activeSessionId === id ? 'active' : 'issued',
          issuedAtLocal: this.requireSnapshot().serverTime,
          expiresAt: this.requireSnapshot().deviceLeaseExpiresAt,
        }
      }
      return null
    }
    return {
      id,
      schoolId: assignment.schoolId,
      type: 'class_pulse',
      status:
        assignment.status === 'submitted'
          ? 'completed'
          : this.activeSessionId === id
            ? 'active'
            : 'issued',
      assignmentId: assignment.id,
      sectionId: assignment.sectionId,
      issuedAtLocal: assignment.createdAt,
      expiresAt: assignment.scheduledEnd,
    }
  }
  async saveSession(): Promise<void> {
    /* Session state is server controlled. */
  }

  async redeemAccessGrant(
    sessionId: string,
    code: string,
  ): Promise<RedeemGrantResult> {
    try {
      const result = await this.service.redeemParticipant(sessionId, code)
      this.activeSessionId = sessionId
      const session = await this.getSession(sessionId)
      if (!session) return { ok: false, reason: 'wrong_session' }
      return {
        ok: true,
        accessGrantId: result.capabilityId,
        session: {
          id: session.id,
          type: session.type,
          status: 'active',
          sectionId: session.sectionId,
          expiresAt: session.expiresAt,
        },
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : ''
      return {
        ok: false,
        reason: message.includes('expired')
          ? 'expired'
          : message.includes('used')
            ? 'used'
            : 'invalid',
      }
    }
  }

  async getActiveRedeemedGrant(
    sessionId: string,
  ): Promise<ActiveRedeemedGrantView | null> {
    if (sessionStorage.getItem(`schooltwin:participant:${sessionId}`)) {
      return {
        accessGrantId:
          sessionStorage.getItem(`schooltwin:participant:${sessionId}:id`) ??
          sessionId,
        sessionId,
        status: 'active',
      }
    }
    return null
  }

  async completeSession(sessionId: string): Promise<KioskSession> {
    const session = await this.getSession(sessionId)
    if (!session) throw new Error('session_unavailable')
    return { ...session, status: 'completed' } as KioskSession
  }

  async saveStudentPulseResponse(
    response: StudentPulseResponse,
  ): Promise<void> {
    await this.service.submitParticipant(response.sessionId, {
      answers: response.answers,
    })
  }

  async getCurrentPulseDay(now: Date): Promise<SchoolPulseDay> {
    const assignment = this.classAssignments()[0]
    const school = await this.getSchool()
    return {
      id: assignment?.dayId ?? 'current',
      schoolId: school.id,
      dateKey: schoolDateKey(now, school.timeZone),
      timeZone: school.timeZone,
      createdAtLocal: this.requireSnapshot().serverTime,
    }
  }
  async getClassPulseAssignment(
    id: string,
  ): Promise<ClassPulseAssignment | null> {
    return this.classAssignments().find((item) => item.id === id) ?? null
  }
  async saveClassPulseAssignment(): Promise<void> {
    /* Server controlled. */
  }
  async saveClassPulseResponse(response: ClassPulseResponse): Promise<void> {
    await this.service.submitParticipant(
      response.sessionId,
      response as unknown as Record<string, unknown>,
    )
  }
  async getFacilityPulseAssignment(
    id: string,
  ): Promise<FacilityPulseAssignment | null> {
    return this.facilityAssignments().find((item) => item.id === id) ?? null
  }
  async saveFacilityPulseAssignment(): Promise<void> {
    /* Server controlled. */
  }
  async saveFacilityPulseResponse(
    response: FacilityPulseResponse,
  ): Promise<void> {
    await this.queueAndSend('facility_check_submit', {
      assignmentId: response.assignmentId,
      values: response,
    })
  }

  async getOperatorDailyCoverage(
    now: Date,
  ): Promise<OperatorDailyCoverageView> {
    const pulseDay = await this.getCurrentPulseDay(now)
    const facility = this.facilityAssignments()[0]
    if (!facility) throw new Error('facility_assignment_unavailable')
    return toOperatorDailyCoverageView({
      dayId: pulseDay.id,
      dateKey: pulseDay.dateKey,
      now,
      sections: this.sections(),
      classPulseAssignments: this.classAssignments(),
      liveEvidenceTasks: this.tasks(),
      facilityPulse: facility,
      privateStudentSampling:
        this.requireSnapshot().participantLaunches.studentPrivateState,
    })
  }

  async getSectionCoverageHistory(
    sectionId: string,
    now: Date,
  ): Promise<SectionCoverageHistoryRecord[]> {
    const row = (await this.getOperatorDailyCoverage(now)).rows.find(
      (item) => item.sectionId === sectionId,
    )
    return row
      ? [
          {
            id: `${sectionId}-today`,
            dayId: (await this.getCurrentPulseDay(now)).id,
            schoolId: (await this.getSchool()).id,
            sectionId,
            dateKey: schoolDateKey(now, (await this.getSchool()).timeZone),
            classPulseStatus: historyState(row.classPulse.status),
            liveEvidenceStatus: historyState(row.liveEvidence.status),
          },
        ]
      : []
  }

  async saveIncidentReport(report: IncidentReport): Promise<void> {
    if (report.mode === 'private_student') {
      if (!this.activeSessionId)
        throw new Error('participant_capability_missing')
      await this.service.submitParticipant(this.activeSessionId, {
        category: report.category,
        description: report.description,
      })
      return
    }
    await this.queueAndSend('operator_report_submit', {
      category: report.category,
      description: report.description,
    })
  }

  async saveCaptureMetadata(): Promise<void> {
    /* Final metadata is written by capture-finalize. */
  }
  async getCaptureMetadata(): Promise<CaptureArtifact | null> {
    return null
  }
  async getCaptureArtifacts(): Promise<CaptureArtifact[]> {
    return []
  }
  async saveCaptureBlob(key: string, blob: Blob): Promise<void> {
    this.drafts.set(key, blob)
  }
  async getCaptureBlob(key: string): Promise<Blob | null> {
    return this.drafts.get(key) ?? null
  }
  async getEvidencePlaybackUrl(evidenceId: string): Promise<string | null> {
    return this.service.evidencePlaybackUrl(evidenceId)
  }
  async deleteCaptureBlob(key: string): Promise<void> {
    this.drafts.delete(key)
  }
  async saveSubmission(): Promise<void> {
    /* Server creates accepted submissions. */
  }
  async getOperatorSubmissions(): Promise<OperatorSubmissionView[]> {
    return this.requireSnapshot().operatorHistory.map((item) => ({
      id: item.id,
      taskId: undefined,
      kind:
        item.kind === 'class_check'
          ? 'class_pulse'
          : item.kind === 'facility_check'
            ? 'facility_pulse'
            : item.kind,
      title: item.title,
      status: 'submitted',
      submittedAtLocal: item.submittedAt,
      evidenceId: item.evidenceId ?? undefined,
    }))
  }
  async appendAuditEvent(): Promise<void> {
    /* Production events are written by server transactions. */
  }
  async getAuditEvents(): Promise<AuditEvent[]> {
    return []
  }
  async getStorageStatus(): Promise<PrototypeStorageStatus> {
    return {
      id: 'prototype-storage',
      persistenceRequested: false,
      persistenceGranted: null,
    }
  }
  async saveStorageStatus(): Promise<void> {
    /* Production storage status is not prototype evidence state. */
  }
  async getUiLocale(): Promise<UiLocale> {
    return localStorage.getItem('schooltwin:locale') === 'or' ? 'or' : 'en'
  }
  async saveUiLocale(locale: UiLocale): Promise<void> {
    localStorage.setItem('schooltwin:locale', locale)
  }
  async resetDemo(): Promise<void> {
    throw new Error('demo_reset_unavailable_in_production')
  }
  close(): void {
    /* idb manages its own shared connection. */
  }

  private requireSnapshot(): SyncPullResult {
    if (!this.snapshot) throw new Error('production_workspace_unavailable')
    return this.snapshot
  }
  private areas(): SchoolArea[] {
    return this.requireSnapshot().areas.map(mapArea)
  }
  private sections(): Section[] {
    return this.requireSnapshot().sections.map(mapSection)
  }
  private classAssignments(): ClassPulseAssignment[] {
    return this.requireSnapshot().classAssignments.map(mapClassAssignment)
  }
  private facilityAssignments(): FacilityPulseAssignment[] {
    return this.requireSnapshot().facilityAssignments.map(mapFacilityAssignment)
  }
  private tasks(): VerificationTask[] {
    return this.requireSnapshot().tasks.map((item) =>
      mapTask(item as unknown as Record<string, unknown>),
    )
  }
  private async queueAndSend(
    type: 'facility_check_submit' | 'operator_report_submit',
    payload: Record<string, unknown>,
  ) {
    const mutationId = crypto.randomUUID()
    const offlineClaimed = !navigator.onLine
    const subjectId =
      type === 'facility_check_submit' &&
      typeof payload.assignmentId === 'string'
        ? payload.assignmentId
        : null
    const lease = offlineClaimed
      ? this.requireSnapshot().workLeases.find(
          (item) =>
            item.kind ===
              (type === 'facility_check_submit'
                ? 'facility_check'
                : 'operator_report') && item.subjectId === subjectId,
        )
      : undefined
    if (offlineClaimed && !lease) {
      throw new ServerRejectedError('valid_work_lease_required')
    }
    await this.service.queueMutation({
      id: mutationId,
      type,
      occurredAtClient: new Date().toISOString(),
      payload,
      offlineClaimed,
      workLeaseToken: lease?.token,
    })
    if (!navigator.onLine) throw new WaitingToSendError()
    const pushed = await this.service.push()
    const result = pushed.results.find((item) => item.id === mutationId)
    if (!result || result.result === 'retry') throw new WaitingToSendError()
    if (result.result === 'rejected') {
      throw new ServerRejectedError(result.error)
    }
  }
}

function value(
  record: Record<string, unknown>,
  snake: string,
  camel: string,
): string {
  const result = record[snake] ?? record[camel]
  return typeof result === 'string' ? result : ''
}
function optional(
  record: Record<string, unknown>,
  snake: string,
  camel: string,
): string | undefined {
  return value(record, snake, camel) || undefined
}
function mapArea(raw: Record<string, unknown>): SchoolArea {
  return {
    id: value(raw, 'id', 'id'),
    schoolId: value(raw, 'school_id', 'schoolId'),
    parentAreaId: optional(raw, 'parent_area_id', 'parentAreaId'),
    name: value(raw, 'name', 'name'),
    kind: value(raw, 'kind', 'kind') as SchoolArea['kind'],
    description: value(raw, 'description', 'description'),
    markerValue: optional(raw, 'marker_value', 'markerValue'),
  }
}
function mapSection(raw: Record<string, unknown>): Section {
  return {
    id: value(raw, 'id', 'id'),
    schoolId: value(raw, 'school_id', 'schoolId'),
    areaId: value(raw, 'area_id', 'areaId'),
    name: value(raw, 'name', 'name'),
    expectedStrength: Number(
      raw.expected_strength ?? raw.expectedStrength ?? 0,
    ),
  }
}
function mapTask(raw: Record<string, unknown>): VerificationTask {
  return {
    id: value(raw, 'id', 'id'),
    schoolId: value(raw, 'school_id', 'schoolId'),
    areaId: optional(raw, 'area_id', 'areaId'),
    sectionId: optional(raw, 'section_id', 'sectionId'),
    type: 'live_evidence',
    collectionDayId: value(raw, 'school_day_id', 'schoolDayId'),
    liveEvidenceScope: value(raw, 'scope', 'scope') as 'class' | 'facility',
    title: value(raw, 'title', 'title'),
    instructions: value(raw, 'instructions', 'instructions'),
    scheduledStart: value(raw, 'scheduled_start', 'opensAt'),
    scheduledEnd: value(raw, 'scheduled_end', 'closesAt'),
    startedAtLocal: optional(raw, 'started_at', 'startedAt'),
    completedAtLocal: optional(raw, 'completed_at', 'submittedAt'),
    status: value(raw, 'status', 'status') as VerificationTask['status'],
    participantType: 'school_operator',
    challengeRequired: true,
    createdAt:
      value(raw, 'created_at', 'createdAt') || new Date(0).toISOString(),
  }
}
function mapClassAssignment(
  raw: Record<string, unknown>,
): ClassPulseAssignment {
  return {
    id: value(raw, 'id', 'id'),
    dayId: value(raw, 'school_day_id', 'schoolDayId'),
    schoolId: value(raw, 'school_id', 'schoolId'),
    sectionId: value(raw, 'section_id', 'sectionId'),
    sessionId: value(raw, 'session_id', 'sessionId'),
    scheduledStart: value(raw, 'scheduled_start', 'opensAt'),
    scheduledEnd: value(raw, 'scheduled_end', 'closesAt'),
    startedAtLocal: optional(raw, 'started_at', 'startedAt'),
    completedAtLocal: optional(raw, 'completed_at', 'submittedAt'),
    status: value(raw, 'status', 'status') as ClassPulseAssignment['status'],
    contextualQuestion: (raw.contextual_question ??
      raw.contextualQuestion ?? {
        id: 'context',
        prompt: 'Did the first planned lesson begin?',
        allowedAnswers: ['yes', 'no', 'not_sure'],
      }) as ClassPulseAssignment['contextualQuestion'],
    createdAt:
      value(raw, 'created_at', 'createdAt') || new Date(0).toISOString(),
  }
}
function mapFacilityAssignment(
  raw: Record<string, unknown>,
): FacilityPulseAssignment {
  return {
    id: value(raw, 'id', 'id'),
    dayId: value(raw, 'school_day_id', 'schoolDayId'),
    schoolId: value(raw, 'school_id', 'schoolId'),
    scheduledStart: value(raw, 'scheduled_start', 'opensAt'),
    scheduledEnd: value(raw, 'scheduled_end', 'closesAt'),
    startedAtLocal: optional(raw, 'started_at', 'startedAt'),
    completedAtLocal: optional(raw, 'completed_at', 'submittedAt'),
    status: value(raw, 'status', 'status') as FacilityPulseAssignment['status'],
    createdAt:
      value(raw, 'created_at', 'createdAt') || new Date(0).toISOString(),
  }
}
function mapChallenge(raw: Record<string, unknown>): TaskChallenge {
  return {
    id: value(raw, 'id', 'id'),
    taskId: value(raw, 'task_id', 'taskId'),
    displayCode: value(raw, 'display_code', 'displayCode'),
    title: 'Live Evidence',
    steps: (raw.steps ?? []) as string[],
    issuedAtLocal: value(raw, 'issued_at', 'issuedAt'),
    prototypeIssued: false,
  }
}
function historyState(status: string): 'submitted' | 'missed' | 'pending' {
  return status === 'submitted'
    ? 'submitted'
    : status === 'missed' || status === 'failed'
      ? 'missed'
      : 'pending'
}
