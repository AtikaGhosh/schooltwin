import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DemoCodeTools } from '@/components/schooltwin/demo-code-tools'
import type { OperatorDailyCoverageView } from '@/lib/schooltwin/domain/daily-coverage'
import { DEMO_CLASS_PULSE_CODES } from '@/lib/schooltwin/domain/seed'
import { translate } from '@/lib/schooltwin/i18n'

const sectionNames = [
  '1A',
  '1B',
  '2A',
  '2B',
  '3A',
  '3B',
  '4A',
  '4B',
  '5A',
  '5B',
  '6A',
  '6B',
  '7A',
  '7B',
  '8A',
  '8B',
  '9A',
  '9B',
]

const coverage: OperatorDailyCoverageView = {
  dayId: 'pulse-day-2026-08-25',
  dateKey: '2026-08-25',
  totalSections: 18,
  classPulseSubmitted: 14,
  liveEvidenceSubmitted: 12,
  rows: sectionNames.map((name, index) => ({
    sectionId: `section-${name.toLowerCase()}`,
    sectionName: `Class ${name}`,
    classPulse: {
      assignmentId: `assignment-${name.toLowerCase()}`,
      sessionId: `session-${name.toLowerCase()}`,
      status: index < 14 ? 'submitted' : 'available',
      scheduledStart: '2026-08-25T04:30:00.000Z',
      scheduledEnd: '2026-08-25T10:30:00.000Z',
    },
    liveEvidence: {
      status: index < 12 ? 'submitted' : 'available',
      taskId: `task-${name.toLowerCase()}`,
    },
  })),
  facilityPulse: {
    assignmentId: 'facility-assignment',
    status: 'submitted',
    scheduledStart: '2026-08-25T04:30:00.000Z',
    scheduledEnd: '2026-08-25T10:30:00.000Z',
  },
  privateStudentSampling: 'active',
}

const writeText = vi.fn().mockResolvedValue(undefined)
const resetDemo = vi.fn().mockResolvedValue(undefined)
const refresh = vi.fn()

vi.mock('@/components/providers/schooltwin-provider', () => ({
  useSchoolTwin: () => ({
    repository: {
      getOperatorDailyCoverage: vi.fn().mockResolvedValue(coverage),
      getSession: vi.fn().mockResolvedValue({
        id: 'session-student-pulse-demo',
        schoolId: 'school-sundarpur',
        type: 'student_pulse',
        status: 'issued',
        issuedAtLocal: '2026-08-25T04:30:00.000Z',
        expiresAt: '2026-08-25T10:35:00.000Z',
      }),
      resetDemo,
    },
    clock: { now: () => new Date('2026-08-25T06:00:00.000Z') },
    revision: 0,
    refresh,
    t: (key: Parameters<typeof translate>[1]) => translate('en', key),
  }),
}))

describe('demo code tools', () => {
  it('shows all section codes and the separate private student code', async () => {
    render(<DemoCodeTools />)

    expect(
      await screen.findByRole('heading', { name: 'Demo check codes' }),
    ).toBeInTheDocument()
    expect(screen.getByText('P7K-4M9')).toBeInTheDocument()
    expect(screen.getByText(DEMO_CLASS_PULSE_CODES['1A'])).toBeInTheDocument()
    expect(screen.getByText(DEMO_CLASS_PULSE_CODES['8A'])).toBeInTheDocument()
    expect(screen.getByText(DEMO_CLASS_PULSE_CODES['9B'])).toBeInTheDocument()
    const openLinks = screen.getAllByRole('link', { name: 'Open check' })
    expect(openLinks).toHaveLength(19)
    expect(openLinks[0]).toHaveAttribute(
      'href',
      '/pulse/session-student-pulse-demo',
    )
  })

  it('copies a code without weakening its one-use status', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    render(<DemoCodeTools />)

    const copyButtons = await screen.findAllByRole('button', {
      name: 'Copy code',
    })
    fireEvent.click(copyButtons[0])

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('P7K-4M9'))
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
    expect(screen.getAllByText('Used')).toHaveLength(14)
    expect(screen.getAllByText('Available')).toHaveLength(5)
  })
})
