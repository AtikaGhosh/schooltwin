export type Role =
  | "student"
  | "teacher"
  | "headmaster"
  | "authority"
  | "inspector"

export type OperationalStatus = "stable" | "watch" | "attention" | "escalated"

export type Confidence = "high" | "medium" | "low" | "unknown"

export type RealityGap =
  | "none"
  | "minor"
  | "significant"
  | "persistent"
  | "verify"

export type SignalSource =
  | "headmaster"
  | "teacher"
  | "student-pulse"
  | "student-report"
  | "parent"
  | "inspector"
  | "system"
  | "record"

export type IssueStatus =
  | "detected"
  | "under-review"
  | "action-required"
  | "assigned"
  | "in-progress"
  | "resolution-claimed"
  | "verification"
  | "resolved"
  | "escalated"

export type Severity = "low" | "medium" | "high" | "critical"

export interface School {
  id: string
  name: string
  udise: string
  block: string
  cluster: string
  district: string
  students: number
  teachers: number
  status: OperationalStatus
  attendanceReported: number
  attendanceObserved: number
  openIssues: number
  escalations: number
  lastSignalDaysAgo: number
}

export interface Signal {
  id: string
  schoolId: string
  claimId: string
  source: SignalSource
  actorLabel: string
  value: string
  timestamp: string // ISO
  note?: string
  evidence?: string
  privacyProtected?: boolean
}

export interface Claim {
  id: string
  schoolId: string
  domain: string
  subject: string
  predicate: string
  timeScope: string
  reportedState: string
  observedState: string
  verifiedState: string
  confidence: Confidence
  realityGap: RealityGap
  lastUpdated: string
  recommendation?: string
}

export interface Issue {
  id: string
  schoolId: string
  title: string
  domain: string
  severity: Severity
  confidence: Confidence
  studentImpact: number
  firstDetected: string
  status: IssueStatus
  responsibleLevel: string
  owner: string
  dependency?: string
  deadline?: string
  escalationLevel: number
  description: string
}

export interface TimelineEvent {
  id: string
  date: string
  source: SignalSource
  text: string
  kind: "report" | "evidence" | "action" | "escalation" | "resolution"
}

export interface WeeklyReviewItem {
  label: string
  detail: string
}

export interface WeeklyReview {
  schoolId: string
  weekLabel: string
  status: OperationalStatus
  headline: string
  improved: WeeklyReviewItem[]
  deteriorated: WeeklyReviewItem[]
  observations: string[]
  actionsDue: { title: string; owner: string; due: string; status: string }[]
  escalations: string[]
  confidenceNotes: string[]
}

export interface MemoryEvent {
  year: string
  text: string
}

export interface PulseQuestion {
  id: string
  text: string
  claimId: string
}

export interface AttendanceRecord {
  date: string
  status: "present" | "absent"
  disputed?: boolean
}

export interface TrendPoint {
  label: string
  reported: number
  observed: number
}
