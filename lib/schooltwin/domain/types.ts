export type Id = string
export type IsoDateTime = string

export interface School {
  id: Id
  schoolTwinId: string
  name: string
  district: string
  state: string
  studentCount: number
  teacherCount: number
  sectionCount: number
  timeZone: string
  openingTime: string
  closingTime: string
  pairedAtLocal: IsoDateTime
}

export type SchoolAreaKind = 'building' | 'classroom' | 'facility' | 'outdoor'

export interface SchoolArea {
  id: Id
  schoolId: Id
  parentAreaId?: Id
  name: string
  kind: SchoolAreaKind
  description: string
  markerValue?: string
}

export interface Section {
  id: Id
  schoolId: Id
  areaId: Id
  name: string
  expectedStrength: number
}

export interface SchoolDevice {
  id: Id
  schoolId: Id
  label: string
  pairedAtLocal: IsoDateTime
  prototypePairing: true
}

export type VerificationTaskType = 'live_evidence' | 'student_pulse'

export type TaskParticipantType =
  'school_operator' | 'class_monitor' | 'student'

export type PersistedTaskStatus =
  'scheduled' | 'in_progress' | 'submitted' | 'missed' | 'failed'

export type DerivedTaskStatus = PersistedTaskStatus | 'available'

export interface VerificationTask {
  id: Id
  schoolId: Id
  areaId?: Id
  sectionId?: Id
  type: VerificationTaskType
  collectionDayId?: Id
  liveEvidenceScope?: 'class' | 'facility'
  title: string
  instructions: string
  scheduledStart: IsoDateTime
  scheduledEnd: IsoDateTime
  startedAtLocal?: IsoDateTime
  completedAtLocal?: IsoDateTime
  status: PersistedTaskStatus
  participantType: TaskParticipantType
  challengeRequired: boolean
  createdAt: IsoDateTime
}

export interface TaskChallenge {
  id: Id
  taskId: Id
  displayCode: string
  title: string
  steps: string[]
  issuedAtLocal: IsoDateTime
  prototypeIssued: boolean
}

export type KioskSessionType =
  'class_pulse' | 'student_pulse' | 'private_report'

export type KioskSessionStatus = 'issued' | 'active' | 'completed' | 'expired'

interface ParticipantSessionBase {
  id: Id
  schoolId: Id
  taskId?: Id
  type: KioskSessionType
  status: KioskSessionStatus
  issuedAtLocal: IsoDateTime
  activatedAtLocal?: IsoDateTime
  completedAtLocal?: IsoDateTime
  expiresAt: IsoDateTime
}

export interface ClassPulseSession extends ParticipantSessionBase {
  type: 'class_pulse'
  assignmentId: Id
  sectionId: Id
}

export interface StudentPulseSession extends ParticipantSessionBase {
  type: 'student_pulse'
  sectionId?: Id
}

export interface PrivateReportSession extends ParticipantSessionBase {
  type: 'private_report'
  sectionId?: Id
}

export type KioskSession =
  ClassPulseSession | StudentPulseSession | PrivateReportSession

export type AccessGrantStatus = 'issued' | 'redeemed' | 'expired'

export interface AccessGrant {
  id: Id
  sessionId: Id
  hashedCode: string
  allowedSessionType: KioskSessionType
  sectionId?: Id
  expiresAt: IsoDateTime
  usedAt?: IsoDateTime
  status: AccessGrantStatus
}

export type ObservationAnswer =
  'yes' | 'no' | 'did_not_check' | 'not_sure' | 'not_applicable'

export interface ObservationQuestion {
  id: Id
  prompt: string
  allowedAnswers: ObservationAnswer[]
}

export interface ObservationAnswerRecord {
  questionId: Id
  answer: ObservationAnswer
}

export interface StudentPulseResponse {
  id: Id
  schoolId: Id
  taskId?: Id
  sessionId: Id
  accessGrantId: Id
  answers: ObservationAnswerRecord[]
  submittedAtLocal: IsoDateTime
}

export interface LegacyClassRealityCheck {
  id: Id
  schoolId: Id
  taskId: Id
  sessionId: Id
  sectionId: Id
  accessGrantId: Id
  answers: ObservationAnswerRecord[]
  submittedAtLocal: IsoDateTime
}

export interface SchoolPulseDay {
  id: Id
  schoolId: Id
  dateKey: string
  timeZone: string
  createdAtLocal: IsoDateTime
}

export interface ContextualPulseQuestion {
  id: Id
  prompt: string
  allowedAnswers: ObservationAnswer[]
}

export interface ClassPulseAssignment {
  id: Id
  dayId: Id
  schoolId: Id
  sectionId: Id
  sessionId: Id
  scheduledStart: IsoDateTime
  scheduledEnd: IsoDateTime
  startedAtLocal?: IsoDateTime
  completedAtLocal?: IsoDateTime
  status: PersistedTaskStatus
  contextualQuestion: ContextualPulseQuestion
  createdAt: IsoDateTime
}

export type ScheduledClassesHeld = 'all' | 'partial' | 'none'
export type EquipmentAvailability = 'all' | 'some' | 'none'
export type AvailabilityAnswer = 'yes' | 'no' | 'did_not_check'
export type MealStatus = 'served' | 'not_served' | 'not_yet'
export type UnusualCondition =
  | 'no_issue'
  | 'teacher_absent'
  | 'water_issue'
  | 'meal_issue'
  | 'infrastructure_issue'
  | 'other'

export interface ClassPulseResponse {
  id: Id
  dayId: Id
  assignmentId: Id
  sessionId: Id
  schoolId: Id
  sectionId: Id
  accessGrantId: Id
  approximateStudentsPresent: number
  firstPeriodTeacherPresent: 'yes' | 'no'
  scheduledClassesHeld: ScheduledClassesHeld
  electricityAvailable: 'yes' | 'no'
  fansAndLightsWorking: EquipmentAvailability
  classroomUsable: 'yes' | 'no'
  drinkingWaterAvailable: AvailabilityAnswer
  toiletsAccessible: AvailabilityAnswer
  mealStatus: MealStatus
  unusualCondition: UnusualCondition
  contextualAnswers: ObservationAnswerRecord[]
  submittedAtLocal: IsoDateTime
}

export interface FacilityPulseAssignment {
  id: Id
  dayId: Id
  schoolId: Id
  scheduledStart: IsoDateTime
  scheduledEnd: IsoDateTime
  startedAtLocal?: IsoDateTime
  completedAtLocal?: IsoDateTime
  status: PersistedTaskStatus
  createdAt: IsoDateTime
}

export type FacilityCondition = 'usable' | 'partially_usable' | 'unusable'
export type OperationalCondition = 'operational' | 'issue'

export interface FacilityPulseResponse {
  id: Id
  dayId: Id
  assignmentId: Id
  schoolId: Id
  attributedTo: 'school_operator'
  drinkingWater: 'available' | 'unavailable'
  boysToilet: FacilityCondition
  girlsToilet: FacilityCondition
  kitchen: OperationalCondition
  electricity: 'available' | 'unavailable'
  library: OperationalCondition
  playground: OperationalCondition
  submittedAtLocal: IsoDateTime
}

export interface SectionCoverageHistoryRecord {
  id: Id
  dayId: Id
  schoolId: Id
  sectionId: Id
  dateKey: string
  classPulseStatus: 'submitted' | 'missed' | 'pending'
  liveEvidenceStatus: 'submitted' | 'missed' | 'pending'
}

export type IncidentReportMode = 'school_operator' | 'private_student'

export type IncidentCategory =
  | 'water'
  | 'sanitation'
  | 'meals'
  | 'teacher_availability'
  | 'electricity'
  | 'classroom'
  | 'infrastructure'
  | 'other'

export interface IncidentReport {
  id: Id
  schoolId: Id
  mode: IncidentReportMode
  category: IncidentCategory
  description: string
  areaId?: Id
  submittedAtLocal: IsoDateTime
}

export type MarkerMethod =
  'barcode_detector' | 'zxing' | 'demo_confirmation' | 'not_observed'

export interface CaptureArtifact {
  id: Id
  schoolId: Id
  taskId: Id
  challengeId: Id
  areaId?: Id
  sectionId?: Id
  startedAtLocal: IsoDateTime
  endedAtLocal: IsoDateTime
  durationMs: number
  markerMethod: MarkerMethod
  markerValue?: string
  expectedMarkerMatched: boolean
  sha256: string
  mimeType: string
  byteLength: number
  blobKey: string
}

export type SubmissionKind =
  | 'live_evidence'
  | 'class_pulse'
  | 'legacy_class_observation'
  | 'facility_pulse'
  | 'student_pulse'
  | 'operator_report'
  | 'private_report'

export type SubmissionVisibility = 'operator' | 'protected'

export interface Submission {
  id: Id
  schoolId: Id
  taskId?: Id
  sourceRecordId: Id
  kind: SubmissionKind
  title: string
  status: 'submitted'
  visibility: SubmissionVisibility
  submittedAtLocal: IsoDateTime
}

export type AuditEventType =
  | 'task_available'
  | 'task_started'
  | 'challenge_issued'
  | 'capture_started'
  | 'capture_completed'
  | 'capture_submitted'
  | 'monitor_session_started'
  | 'monitor_check_submitted'
  | 'class_pulse_session_started'
  | 'class_pulse_submitted'
  | 'facility_pulse_submitted'
  | 'pulse_session_started'
  | 'pulse_submitted'
  | 'report_submitted'
  | 'demo_reset'

export interface AuditEvent {
  id: Id
  schoolId: Id
  type: AuditEventType
  targetId?: Id
  occurredAtLocal: IsoDateTime
  detail: string
}

export interface PrototypeStorageStatus {
  id: 'prototype-storage'
  persistenceRequested: boolean
  persistenceGranted: boolean | null
  lastCheckedAtLocal?: IsoDateTime
}
