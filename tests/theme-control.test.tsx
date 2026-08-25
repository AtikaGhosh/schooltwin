import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ThemeProvider } from '@/components/providers/theme-provider'
import { ThemeControl } from '@/components/theme-control'
import { translate, type UiLocale } from '@/lib/schooltwin/i18n'

let locale: UiLocale = 'en'

vi.mock('@/components/providers/schooltwin-provider', () => ({
  useSchoolTwin: () => ({
    t: (key: Parameters<typeof translate>[1]) => translate(locale, key),
  }),
}))

describe('theme menu', () => {
  beforeEach(() => {
    locale = 'en'
    window.localStorage.clear()
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        media: '(prefers-color-scheme: dark)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    )
  })

  it('supports keyboard navigation and reports the active preference', async () => {
    render(
      <ThemeProvider>
        <ThemeControl />
      </ThemeProvider>,
    )
    fireEvent.click(screen.getByLabelText('Change appearance'))
    const menu = screen.getByRole('menu', { name: 'Appearance' })
    const system = screen.getByRole('menuitemradio', { name: /System/ })
    await waitFor(() => expect(system).toHaveAttribute('aria-checked', 'true'))
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(screen.getByRole('menuitemradio', { name: /Light/ })).toHaveFocus()
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(screen.getByRole('menuitemradio', { name: /Dark/ })).toHaveFocus()
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Dark/ }))
    expect(document.documentElement).toHaveClass('dark')
  })

  it('uses centralized Odia appearance labels', () => {
    locale = 'or'
    render(
      <ThemeProvider>
        <ThemeControl />
      </ThemeProvider>,
    )
    fireEvent.click(screen.getByLabelText('ଦେଖାଯିବା ଶୈଳୀ ବଦଳାନ୍ତୁ'))
    expect(
      screen.getByRole('menuitemradio', { name: /ଗାଢ଼/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('menuitemradio', { name: /ଡିଭାଇସ୍ ଅନୁସାରେ/ }),
    ).toBeInTheDocument()
  })
})
