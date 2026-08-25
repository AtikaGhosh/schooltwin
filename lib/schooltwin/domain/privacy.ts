import type {
  KioskSession,
  KioskSessionStatus,
  KioskSessionType,
  Submission,
  SubmissionKind,
} from './types'

export interface OperatorSubmissionView {
  id: string
  taskId?: string
  kind: Exclude<SubmissionKind, 'student_pulse' | 'private_report'>
  title: string
  status: 'submitted'
  submittedAtLocal: string
  evidenceId?: string
}

export interface OperatorPulseView {
  taskId: string
  status: 'completed'
}

export interface KioskSessionView {
  id: string
  taskId?: string
  sectionId?: string
  type: KioskSessionType
  status: KioskSessionStatus
  expiresAt: string
}

export function toOperatorSubmissionView(
  submission: Submission,
): OperatorSubmissionView | null {
  if (
    submission.visibility !== 'operator' ||
    submission.kind === 'student_pulse' ||
    submission.kind === 'private_report'
  ) {
    return null
  }

  return {
    id: submission.id,
    taskId: submission.taskId,
    kind:
      (submission.kind as string) === 'class_reality_check'
        ? 'legacy_class_observation'
        : submission.kind,
    title: submission.title,
    status: submission.status,
    submittedAtLocal: submission.submittedAtLocal,
  }
}

export function toOperatorPulseView(
  submission: Submission,
): OperatorPulseView | null {
  if (submission.kind !== 'student_pulse' || !submission.taskId) return null
  return { taskId: submission.taskId, status: 'completed' }
}

export function toKioskSessionView(session: KioskSession): KioskSessionView {
  return {
    id: session.id,
    ...(session.taskId ? { taskId: session.taskId } : {}),
    ...(session.sectionId ? { sectionId: session.sectionId } : {}),
    type: session.type,
    status: session.status,
    expiresAt: session.expiresAt,
  }
}
