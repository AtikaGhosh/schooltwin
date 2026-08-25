export type ServerTaskStatus =
  'scheduled' | 'in_progress' | 'submitted' | 'missed' | 'failed'

export interface AssignmentView {
  id: string
  kind: 'class_check' | 'facility_check'
  schoolDayId: string
  sectionId: string | null
  status: ServerTaskStatus
  opensAt: string
  closesAt: string
  startedAt: string | null
  submittedAt: string | null
}

export interface TaskView {
  id: string
  kind: 'class_video' | 'facility_video'
  schoolDayId: string
  sectionId: string | null
  facilityId: string | null
  title: string
  status: ServerTaskStatus
  opensAt: string
  closesAt: string
  startedAt: string | null
  submittedAt: string | null
}

export interface ChallengeView {
  id: string
  taskId: string
  displayCode: string
  instructions: string[]
  issuedAt: string
}

export interface SignedWorkLease {
  kind: 'capture' | 'facility_check' | 'operator_report'
  subjectId: string | null
  taskId?: string
  token: string
  expiresAt: string
  uploadDeadline?: string
}

export interface OperatorHistoryView {
  id: string
  kind: 'class_check' | 'facility_check' | 'live_evidence' | 'operator_report'
  title: string
  submittedAt: string
  evidenceId: string | null
}

export interface SyncPullResult {
  serverTime: string
  schoolConfigVersion: number
  deviceLeaseExpiresAt: string
  school: {
    id: string
    school_twin_id: string
    name: string
    district: string
    state: string
    time_zone: string
    opening_time: string
    closing_time: string
  }
  areas: Array<Record<string, unknown>>
  sections: Array<Record<string, unknown>>
  classAssignments: Array<Record<string, unknown>>
  facilityAssignments: Array<Record<string, unknown>>
  tasks: TaskView[]
  challenges: ChallengeView[]
  workLeases: SignedWorkLease[]
  operatorHistory: OperatorHistoryView[]
  revokedIds: string[]
  nextCursor: string
  participantLaunches: {
    studentPulseSessionId: string | null
    privateReportSessionId: string | null
    studentPrivateState: 'inactive' | 'active' | 'completed'
  }
}

export type OperatorMutationType =
  'facility_check_submit' | 'operator_report_submit'

export interface ClientMutation {
  id: string
  type: OperatorMutationType
  occurredAtClient: string
  payload: Record<string, unknown>
  offlineClaimed?: boolean
  workLeaseToken?: string
}

export type MutationResultState =
  'accepted' | 'duplicate' | 'rejected' | 'retry'

export interface MutationResult {
  id: string
  result: MutationResultState
  error?: string
  receiptId?: string
}

export interface SyncPushResult {
  serverTime: string
  results: MutationResult[]
}

export interface DeviceIdentity {
  schoolId: string
  deviceId: string
  leaseToken: string
  leaseExpiresAt: string
}

export interface CaptureIntentResult {
  captureIntentId: string
  challenge: ChallengeView
  objectPath: string
  uploadPath: string
  uploadToken: string
  workLeaseToken: string
}

export interface ParticipantRedemption {
  capabilityToken: string
  capabilityId: string
  session: {
    id: string
    type: 'class_pulse' | 'student_pulse' | 'private_report'
    expiresAt: string
  }
}

export interface PassPrintItem {
  sessionId: string
  code: string
}

export interface PassBatchResult {
  batchId: string
  printItems: PassPrintItem[]
  shownOnce: true
}

export interface BackendErrorBody {
  error: string
}
