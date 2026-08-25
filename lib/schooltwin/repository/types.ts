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
  KioskSessionView,
  OperatorSubmissionView,
} from '../domain/privacy'
import type { OperatorDailyCoverageView } from '../domain/daily-coverage'
import type { UiLocale } from '../i18n'

export type RedeemGrantFailure =
  'invalid' | 'expired' | 'used' | 'wrong_session'

export type RedeemGrantResult =
  | { ok: true; session: KioskSessionView; accessGrantId: string }
  | { ok: false; reason: RedeemGrantFailure }

export interface ActiveRedeemedGrantView {
  accessGrantId: string
  sessionId: string
  status: 'active'
}

export interface SchoolTwinRepository {
  initialize(): Promise<void>
  getSchool(): Promise<School>
  getAreas(): Promise<SchoolArea[]>
  getSections(): Promise<Section[]>
  getSection(id: string): Promise<Section | null>
  getTasks(now: Date): Promise<VerificationTask[]>
  getTask(id: string, now: Date): Promise<VerificationTask | null>
  saveTask(task: VerificationTask): Promise<void>
  getChallenge(taskId: string): Promise<TaskChallenge | null>
  saveChallenge(challenge: TaskChallenge): Promise<void>
  getSession(id: string): Promise<KioskSession | null>
  saveSession(session: KioskSession): Promise<void>
  redeemAccessGrant(
    sessionId: string,
    code: string,
    now: Date,
  ): Promise<RedeemGrantResult>
  getActiveRedeemedGrant(
    sessionId: string,
    now: Date,
  ): Promise<ActiveRedeemedGrantView | null>
  completeSession(sessionId: string, now: Date): Promise<KioskSession>
  saveStudentPulseResponse(response: StudentPulseResponse): Promise<void>
  getCurrentPulseDay(now: Date): Promise<SchoolPulseDay>
  getClassPulseAssignment(id: string): Promise<ClassPulseAssignment | null>
  saveClassPulseAssignment(assignment: ClassPulseAssignment): Promise<void>
  saveClassPulseResponse(response: ClassPulseResponse): Promise<void>
  getFacilityPulseAssignment(
    id: string,
  ): Promise<FacilityPulseAssignment | null>
  saveFacilityPulseAssignment(
    assignment: FacilityPulseAssignment,
  ): Promise<void>
  saveFacilityPulseResponse(response: FacilityPulseResponse): Promise<void>
  getOperatorDailyCoverage(now: Date): Promise<OperatorDailyCoverageView>
  getSectionCoverageHistory(
    sectionId: string,
    now: Date,
  ): Promise<SectionCoverageHistoryRecord[]>
  saveIncidentReport(report: IncidentReport): Promise<void>
  saveCaptureMetadata(artifact: CaptureArtifact): Promise<void>
  getCaptureMetadata(id: string): Promise<CaptureArtifact | null>
  getCaptureArtifacts(): Promise<CaptureArtifact[]>
  saveCaptureBlob(key: string, blob: Blob): Promise<void>
  getCaptureBlob(key: string): Promise<Blob | null>
  getEvidencePlaybackUrl(evidenceId: string): Promise<string | null>
  deleteCaptureBlob(key: string): Promise<void>
  saveSubmission(submission: Submission): Promise<void>
  getOperatorSubmissions(): Promise<OperatorSubmissionView[]>
  appendAuditEvent(event: AuditEvent): Promise<void>
  getAuditEvents(): Promise<AuditEvent[]>
  getStorageStatus(): Promise<PrototypeStorageStatus>
  saveStorageStatus(status: PrototypeStorageStatus): Promise<void>
  getUiLocale(): Promise<UiLocale>
  saveUiLocale(locale: UiLocale): Promise<void>
  resetDemo(now?: Date): Promise<void>
  close(): void
}

export interface RepositoryDependencies {
  dbName?: string
  now: () => Date
  hashCode: (value: string) => Promise<string>
}

export interface MetadataRecord {
  key: string
  value:
    | PrototypeStorageStatus
    | { deviceId: string; schoolId: string }
    | { locale: UiLocale }
    | { actionFirstSeedVersion: 1 }
    | { schoolHoursSeedVersion: 1 }
}

export interface CaptureBlobRecord {
  key: string
  blob: Blob
}

export interface RepositoryRecords {
  accessGrant: AccessGrant
  auditEvent: AuditEvent
}
