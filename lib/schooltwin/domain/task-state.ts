import { SCHOOLTWIN_CONFIG } from './config'
import type { DerivedTaskStatus, PersistedTaskStatus } from './types'

export interface TimeBoundCollection {
  scheduledStart: string
  scheduledEnd: string
  startedAtLocal?: string
  completedAtLocal?: string
  status: PersistedTaskStatus
}

export class InvalidTaskTransitionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidTaskTransitionError'
  }
}

function timestamp(value: string): number {
  const result = Date.parse(value)
  if (Number.isNaN(result)) {
    throw new Error(`Invalid task timestamp: ${value}`)
  }
  return result
}

export function deriveTaskStatus(
  task: TimeBoundCollection,
  now: Date,
): DerivedTaskStatus {
  if (task.status !== 'scheduled') return task.status

  const current = now.getTime()
  const start = timestamp(task.scheduledStart)
  const end = timestamp(task.scheduledEnd)

  if (current < start) return 'scheduled'
  if (current <= end) return 'available'
  return 'missed'
}

export function taskCompletionDeadline(
  task: TimeBoundCollection,
  graceMs = SCHOOLTWIN_CONFIG.taskCompletionGraceMs,
): Date {
  return new Date(timestamp(task.scheduledEnd) + graceMs)
}

export function transitionTask<T extends TimeBoundCollection>(
  task: T,
  target: PersistedTaskStatus,
  now: Date,
  graceMs = SCHOOLTWIN_CONFIG.taskCompletionGraceMs,
): T {
  const derived = deriveTaskStatus(task, now)

  if (task.status === 'scheduled' && target === 'in_progress') {
    if (derived !== 'available') {
      throw new InvalidTaskTransitionError(
        'A task can start only inside its availability window.',
      )
    }
    return {
      ...task,
      status: 'in_progress',
      startedAtLocal: now.toISOString(),
    }
  }

  if (task.status === 'scheduled' && target === 'missed') {
    if (derived !== 'missed') {
      throw new InvalidTaskTransitionError(
        'A task becomes missed only after its window has passed.',
      )
    }
    return { ...task, status: 'missed' }
  }

  if (task.status === 'in_progress' && target === 'submitted') {
    if (now.getTime() > taskCompletionDeadline(task, graceMs).getTime()) {
      throw new InvalidTaskTransitionError(
        'The task completion grace period has expired.',
      )
    }
    return {
      ...task,
      status: 'submitted',
      completedAtLocal: now.toISOString(),
    }
  }

  if (task.status === 'in_progress' && target === 'failed') {
    return {
      ...task,
      status: 'failed',
      completedAtLocal: now.toISOString(),
    }
  }

  throw new InvalidTaskTransitionError(
    `Illegal task transition from ${task.status} to ${target}.`,
  )
}

export function reconcileExpiredTask<T extends TimeBoundCollection>(
  task: T,
  now: Date,
  graceMs = SCHOOLTWIN_CONFIG.taskCompletionGraceMs,
): T {
  if (task.status === 'scheduled' && deriveTaskStatus(task, now) === 'missed') {
    return { ...task, status: 'missed' }
  }

  if (
    task.status === 'in_progress' &&
    now.getTime() > taskCompletionDeadline(task, graceMs).getTime()
  ) {
    return {
      ...task,
      status: 'failed',
      completedAtLocal: now.toISOString(),
    }
  }

  return task
}
