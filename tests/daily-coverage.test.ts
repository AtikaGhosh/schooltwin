import { describe, expect, it } from 'vitest'

import { createDemoSeed } from '@/lib/schooltwin/domain/seed'
import { deriveTaskStatus } from '@/lib/schooltwin/domain/task-state'
import { validateClassPulseResponse } from '@/lib/schooltwin/domain/daily-coverage'
import {
  schoolDayWindow,
  toOperatorDailyCoverageView,
} from '@/lib/schooltwin/domain/daily-coverage'
import { toTodayWorkView } from '@/lib/schooltwin/domain/today-work'

const now = new Date('2026-08-22T10:00:00.000Z')

describe('daily coverage domain', () => {
  it('derives every routine assignment from the configured school hours', async () => {
    const seed = await createDemoSeed(now, async (value) => `hash:${value}`)
    const window = schoolDayWindow(seed.school, '2026-08-22')
    expect(seed.school).toMatchObject({
      timeZone: 'Asia/Kolkata',
      openingTime: '10:00',
      closingTime: '16:00',
    })
    const routineWork = [
      ...seed.tasks,
      ...seed.classPulseAssignments,
      ...seed.facilityPulseAssignments,
    ]
    expect(routineWork).toHaveLength(39)
    expect(
      routineWork.every(
        (item) =>
          item.scheduledStart === window.opensAt.toISOString() &&
          item.scheduledEnd === window.closesAt.toISOString(),
      ),
    ).toBe(true)
    expect(deriveTaskStatus(seed.tasks[14], now)).toBe('available')
  })

  it('assigns one contextual question per section', async () => {
    const seed = await createDemoSeed(now, async (value) => `hash:${value}`)
    expect(seed.classPulseAssignments).toHaveLength(18)
    expect(
      seed.classPulseAssignments.every(
        (assignment) => assignment.contextualQuestion.prompt.length > 0,
      ),
    ).toBe(true)
  })

  it('creates unique hashed credentials and internally linked completion records', async () => {
    const seed = await createDemoSeed(now, async (value) => `hash:${value}`)
    const classGrants = seed.accessGrants.filter(
      (grant) => grant.allowedSessionType === 'class_pulse',
    )
    expect(classGrants).toHaveLength(18)
    expect(new Set(classGrants.map((grant) => grant.hashedCode)).size).toBe(18)
    expect(
      classGrants.every((grant) => grant.hashedCode.startsWith('hash:')),
    ).toBe(true)

    for (const assignment of seed.classPulseAssignments.filter(
      (item) => item.status === 'submitted',
    )) {
      const response = seed.classPulseResponses.find(
        (item) => item.assignmentId === assignment.id,
      )
      expect(response).toBeDefined()
      expect(
        seed.submissions.some(
          (item) =>
            item.kind === 'class_pulse' && item.sourceRecordId === response?.id,
        ),
      ).toBe(true)
      expect(
        seed.auditEvents.some(
          (item) =>
            item.type === 'class_pulse_submitted' &&
            item.targetId === assignment.id,
        ),
      ).toBe(true)
    }

    for (const task of seed.tasks.filter(
      (item) => item.status === 'submitted',
    )) {
      expect(
        seed.submissions.some(
          (item) => item.kind === 'live_evidence' && item.taskId === task.id,
        ),
      ).toBe(true)
      expect(
        seed.auditEvents.some(
          (item) =>
            item.type === 'capture_submitted' && item.targetId === task.id,
        ),
      ).toBe(true)
    }
    expect(seed.facilityPulseAssignments).toHaveLength(1)
    expect(deriveTaskStatus(seed.facilityPulseAssignments[0], now)).toBe(
      'submitted',
    )
    expect(seed.facilityPulseResponses).toHaveLength(1)
    expect(
      seed.submissions.some((item) => item.kind === 'facility_pulse'),
    ).toBe(true)
  })

  it('bounds approximate attendance by expected strength', async () => {
    const seed = await createDemoSeed(now, async (value) => `hash:${value}`)
    const response = {
      ...seed.classPulseResponses[0],
      approximateStudentsPresent: 999,
    }
    expect(validateClassPulseResponse(response, seed.sections[0])).toContain(
      'students_range',
    )
  })

  it('rejects invalid Class Pulse enum values at runtime', async () => {
    const seed = await createDemoSeed(now, async (value) => `hash:${value}`)
    const response = {
      ...seed.classPulseResponses[0],
      scheduledClassesHeld: 'invalid',
    } as unknown as (typeof seed.classPulseResponses)[number]
    expect(validateClassPulseResponse(response, seed.sections[0])).toContain(
      'invalid_answer',
    )
  })

  it('derives the exact action-first daily work totals and Class 8A next', async () => {
    const seed = await createDemoSeed(now, async (value) => `hash:${value}`)
    const day = seed.pulseDays.find((item) => item.dateKey === '2026-08-22')!
    const coverage = toOperatorDailyCoverageView({
      dayId: day.id,
      dateKey: day.dateKey,
      now,
      sections: seed.sections,
      classPulseAssignments: seed.classPulseAssignments,
      liveEvidenceTasks: seed.tasks,
      facilityPulse: seed.facilityPulseAssignments[0],
      privateStudentSampling: 'active',
    })
    const work = toTodayWorkView({ coverage, tasks: seed.tasks, now })
    expect({
      total: work.total,
      completed: work.completed,
      doNow: work.doNow.length,
      notOpenYet: work.notOpenYet.length,
      notDone: work.notDone.length,
      remaining: work.remaining,
      stillToDo: work.stillToDo,
    }).toEqual({
      total: 39,
      completed: 28,
      doNow: 11,
      notOpenYet: 0,
      notDone: 0,
      remaining: 11,
      stillToDo: 11,
    })
    expect(work.next).toMatchObject({
      kind: 'class_video',
      sectionName: 'Class 8A',
    })
  })

  it('presents unopened work before opening and not done after closing', async () => {
    const seed = await createDemoSeed(now, async (value) => `hash:${value}`)
    const buildWork = (at: Date) => {
      const day = seed.pulseDays.find((item) => item.dateKey === '2026-08-22')!
      const coverage = toOperatorDailyCoverageView({
        dayId: day.id,
        dateKey: day.dateKey,
        now: at,
        sections: seed.sections,
        classPulseAssignments: seed.classPulseAssignments,
        liveEvidenceTasks: seed.tasks,
        facilityPulse: seed.facilityPulseAssignments[0],
        privateStudentSampling: 'active',
      })
      return toTodayWorkView({ coverage, tasks: seed.tasks, now: at })
    }
    const beforeOpen = buildWork(new Date('2026-08-22T04:00:00.000Z'))
    expect(beforeOpen.notOpenYet).toHaveLength(11)
    expect(beforeOpen.doNow).toHaveLength(0)
    const afterClose = buildWork(new Date('2026-08-22T10:31:00.000Z'))
    expect(afterClose.notDone).toHaveLength(11)
    expect(afterClose.notOpenYet).toHaveLength(0)
  })
})
