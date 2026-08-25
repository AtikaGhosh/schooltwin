import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  AnswerButtons,
  GuidedWizard,
} from '@/components/schooltwin/guided-wizard'
import { translate } from '@/lib/schooltwin/i18n'

vi.mock('@/components/providers/schooltwin-provider', () => ({
  useSchoolTwin: () => ({
    t: (
      key: Parameters<typeof translate>[1],
      values?: Record<string, string | number>,
    ) => translate('en', key, values),
  }),
}))

describe('GuidedWizard', () => {
  it('enforces progress, validation, 48px actions, back navigation, and heading focus', () => {
    const complete = vi.fn()
    render(
      <GuidedWizard
        steps={[
          {
            id: 'one',
            question: 'First question',
            valid: false,
            content: (
              <AnswerButtons
                value=""
                options={[['yes', 'Yes']]}
                onChange={() => undefined}
              />
            ),
          },
          {
            id: 'two',
            question: 'Second question',
            valid: true,
            content: <p>Ready</p>,
          },
        ]}
        onComplete={complete}
      />,
    )
    expect(screen.getByText('1 of 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next' })).toHaveClass(
      'primary-action',
    )
    expect(screen.getByRole('button', { name: 'Yes' })).toHaveClass('min-h-16')
    expect(screen.getByRole('button', { name: 'Yes' })).toHaveClass(
      'choice-control',
    )
    expect(
      screen.getByRole('heading', { name: 'First question' }).parentElement,
    ).toHaveClass('wizard-stage')
  })

  it('moves focus after navigation and completes only on the last valid step', () => {
    const complete = vi.fn()
    render(
      <GuidedWizard
        steps={[
          {
            id: 'one',
            question: 'First question',
            valid: true,
            content: <p>Ready</p>,
          },
          {
            id: 'two',
            question: 'Second question',
            valid: true,
            content: <p>Ready</p>,
          },
        ]}
        onComplete={complete}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(
      screen.getByRole('heading', { name: 'Second question' }),
    ).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Back' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
    expect(complete).toHaveBeenCalledOnce()
  })
})
