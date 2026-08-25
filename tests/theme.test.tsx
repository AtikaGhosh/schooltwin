import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ThemeProvider, useTheme } from '@/components/providers/theme-provider'
import {
  applyTheme,
  resolveTheme,
  THEME_STORAGE_KEY,
} from '@/lib/schooltwin/theme'

let systemDark = false
const listeners = new Set<(event: MediaQueryListEvent) => void>()

function ThemeHarness() {
  const { preference, resolvedTheme, setPreference } = useTheme()
  return (
    <div>
      <output>{`${preference}:${resolvedTheme}`}</output>
      <button onClick={() => setPreference('light')}>Light</button>
      <button onClick={() => setPreference('dark')}>Dark</button>
      <button onClick={() => setPreference('system')}>System</button>
    </div>
  )
}

describe('theme preference', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.classList.remove('light', 'dark')
    systemDark = false
    listeners.clear()
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: systemDark,
        media: '(prefers-color-scheme: dark)',
        onchange: null,
        addEventListener: (_type: string, listener: EventListener) =>
          listeners.add(listener as (event: MediaQueryListEvent) => void),
        removeEventListener: (_type: string, listener: EventListener) =>
          listeners.delete(listener as (event: MediaQueryListEvent) => void),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    )
  })

  it('defaults to system and resolves the device appearance', async () => {
    render(
      <ThemeProvider>
        <ThemeHarness />
      </ThemeProvider>,
    )
    await waitFor(() => expect(screen.getByText('system:light')).toBeVisible())
    expect(document.documentElement).toHaveClass('light')
    expect(resolveTheme('system', true)).toBe('dark')
  })

  it('selects and persists each explicit preference', async () => {
    render(
      <ThemeProvider>
        <ThemeHarness />
      </ThemeProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Dark' }))
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(document.documentElement).toHaveClass('dark')
    fireEvent.click(screen.getByRole('button', { name: 'Light' }))
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    expect(document.documentElement).toHaveClass('light')
    fireEvent.click(screen.getByRole('button', { name: 'System' }))
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('system')
  })

  it('restores a persisted preference on mount', async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    render(
      <ThemeProvider>
        <ThemeHarness />
      </ThemeProvider>,
    )
    await waitFor(() => expect(screen.getByText('dark:dark')).toBeVisible())
  })

  it('updates system appearance without replacing the system preference', async () => {
    render(
      <ThemeProvider>
        <ThemeHarness />
      </ThemeProvider>,
    )
    await waitFor(() => expect(screen.getByText('system:light')).toBeVisible())
    systemDark = true
    listeners.forEach((listener) =>
      listener({ matches: true } as MediaQueryListEvent),
    )
    await waitFor(() => expect(screen.getByText('system:dark')).toBeVisible())
    expect(document.documentElement.dataset.themePreference).toBe('system')
  })

  it('applies a resolved appearance and exposes it to assistive tests', () => {
    expect(applyTheme('dark', false)).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.dataset.themePreference).toBe('dark')
  })
})
