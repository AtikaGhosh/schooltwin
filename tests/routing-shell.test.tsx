import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { KioskShell } from '@/components/kiosk-shell'
import { OperatorShell } from '@/components/operator-shell'
import { translate } from '@/lib/schooltwin/i18n'

let pathname = '/home'

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}))

vi.mock('@/components/providers/schooltwin-provider', () => ({
  useSchoolTwin: () => ({
    ready: true,
    error: null,
    locale: 'en',
    setLocale: vi.fn(),
    t: (key: Parameters<typeof translate>[1]) => translate('en', key),
  }),
}))

vi.mock('@/components/providers/theme-provider', () => ({
  useTheme: () => ({
    preference: 'system',
    resolvedTheme: 'light',
    setPreference: vi.fn(),
  }),
}))

describe('routed application shells', () => {
  beforeEach(() => {
    pathname = '/home'
  })

  it('renders accessible action-first operator navigation', () => {
    render(
      <OperatorShell>
        <h1>Home content</h1>
      </OperatorShell>,
    )

    expect(screen.queryByText('School Collection App')).not.toBeInTheDocument()
    expect(
      screen.getAllByText('Sundarpur Government High School').length,
    ).toBeGreaterThan(0)
    expect(
      screen.getByRole('navigation', { name: 'Primary' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Home' })[0]).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getAllByRole('link', { name: 'Home' })[0]).toHaveClass(
      'nav-interactive',
    )
    expect(
      screen.getByRole('heading', { name: 'Home content' }),
    ).toBeInTheDocument()
  })

  it('isolates participant sessions from operator navigation', () => {
    pathname = '/pulse/session-student-pulse-demo'
    render(
      <KioskShell>
        <h1>Private session</h1>
      </KioskShell>,
    )

    expect(screen.getByText('Private participant screen')).toBeInTheDocument()
    expect(
      screen.getByText('Private session').closest('.kiosk-environment'),
    ).toBeInTheDocument()
    expect(screen.getByText('Private')).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Today’s Work' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'History' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Our School' }),
    ).not.toBeInTheDocument()
  })
})
