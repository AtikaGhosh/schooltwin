import { describe, expect, it } from 'vitest'

import {
  toKioskSessionView,
  toOperatorSubmissionView,
} from '@/lib/schooltwin/domain/privacy'
import type { KioskSession, Submission } from '@/lib/schooltwin/domain/types'

describe('privacy projections', () => {
  it('omits private reports and individual Pulse submissions from operator history', () => {
    const privateSubmission: Submission = {
      id: 'private-1',
      schoolId: 'school-1',
      sourceRecordId: 'report-1',
      kind: 'private_report',
      title: 'Private report',
      status: 'submitted',
      visibility: 'protected',
      submittedAtLocal: '2026-08-22T10:00:00Z',
    }

    expect(toOperatorSubmissionView(privateSubmission)).toBeNull()
    expect(
      toOperatorSubmissionView({
        ...privateSubmission,
        id: 'pulse-1',
        kind: 'student_pulse',
      }),
    ).toBeNull()
  })

  it('returns only permitted operator submission fields', () => {
    const result = toOperatorSubmissionView({
      id: 'submission-1',
      schoolId: 'school-1',
      sourceRecordId: 'capture-1',
      kind: 'live_evidence',
      title: 'Class evidence',
      status: 'submitted',
      visibility: 'operator',
      submittedAtLocal: '2026-08-22T10:00:00Z',
    })

    expect(result).toEqual({
      id: 'submission-1',
      kind: 'live_evidence',
      title: 'Class evidence',
      status: 'submitted',
      submittedAtLocal: '2026-08-22T10:00:00Z',
    })
  })

  it('does not include credential data in kiosk session projections', () => {
    const session: KioskSession = {
      id: 'session-1',
      schoolId: 'school-1',
      type: 'student_pulse',
      status: 'issued',
      issuedAtLocal: '2026-08-22T10:00:00Z',
      expiresAt: '2026-08-22T11:00:00Z',
    }

    expect(toKioskSessionView(session)).toEqual({
      id: 'session-1',
      type: 'student_pulse',
      status: 'issued',
      expiresAt: '2026-08-22T11:00:00Z',
    })
  })
})
