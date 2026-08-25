import { describe, expect, it } from 'vitest'

import {
  deriveTaskStatus,
  InvalidTaskTransitionError,
  reconcileExpiredTask,
  transitionTask,
} from '@/lib/schooltwin/domain/task-state'
import type { VerificationTask } from '@/lib/schooltwin/domain/types'

const baseTask: VerificationTask = {
  id: 'task-1',
  schoolId: 'school-1',
  type: 'live_evidence',
  title: 'Class evidence',
  instructions: 'Record the class.',
  scheduledStart: '2026-08-22T10:00:00.000Z',
  scheduledEnd: '2026-08-22T10:10:00.000Z',
  status: 'scheduled',
  participantType: 'school_operator',
  challengeRequired: true,
  createdAt: '2026-08-22T09:00:00.000Z',
}

describe('task state machine', () => {
  it('derives availability instead of persisting it', () => {
    expect(deriveTaskStatus(baseTask, new Date('2026-08-22T09:59:00Z'))).toBe(
      'scheduled',
    )
    expect(deriveTaskStatus(baseTask, new Date('2026-08-22T10:05:00Z'))).toBe(
      'available',
    )
    expect(deriveTaskStatus(baseTask, new Date('2026-08-22T10:11:00Z'))).toBe(
      'missed',
    )
    expect(baseTask.status).toBe('scheduled')
  })

  it('allows start inside the window and submit inside the grace period', () => {
    const started = transitionTask(
      baseTask,
      'in_progress',
      new Date('2026-08-22T10:09:00Z'),
    )
    const submitted = transitionTask(
      started,
      'submitted',
      new Date('2026-08-22T10:11:30Z'),
      120_000,
    )

    expect(submitted.status).toBe('submitted')
  })

  it('rejects illegal transitions and completion after grace', () => {
    expect(() =>
      transitionTask(baseTask, 'submitted', new Date('2026-08-22T10:05:00Z')),
    ).toThrow(InvalidTaskTransitionError)

    const started = transitionTask(
      baseTask,
      'in_progress',
      new Date('2026-08-22T10:05:00Z'),
    )
    expect(() =>
      transitionTask(
        started,
        'submitted',
        new Date('2026-08-22T10:12:01Z'),
        120_000,
      ),
    ).toThrow('grace period has expired')
  })

  it('reconciles expired scheduled and in-progress tasks', () => {
    expect(
      reconcileExpiredTask(baseTask, new Date('2026-08-22T10:11:00Z')).status,
    ).toBe('missed')

    const started = transitionTask(
      baseTask,
      'in_progress',
      new Date('2026-08-22T10:05:00Z'),
    )
    expect(
      reconcileExpiredTask(started, new Date('2026-08-22T10:12:01Z'), 120_000)
        .status,
    ).toBe('failed')
  })
})
