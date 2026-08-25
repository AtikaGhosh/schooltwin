export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'schooltwin-theme-preference'

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  return preference === 'system'
    ? systemPrefersDark
      ? 'dark'
      : 'light'
    : preference
}

export function applyTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  const resolved = resolveTheme(preference, systemPrefersDark)
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.classList.toggle('light', resolved === 'light')
  root.dataset.themePreference = preference
  root.dataset.theme = resolved
  return resolved
}

export const THEME_BOOTSTRAP_SCRIPT = `(()=>{try{const k='${THEME_STORAGE_KEY}',v=localStorage.getItem(k),p=v==='light'||v==='dark'||v==='system'?v:'system',d=p==='dark'||p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches,e=document.documentElement;e.classList.remove('light','dark');e.classList.add(d?'dark':'light');e.dataset.themePreference=p;e.dataset.theme=d?'dark':'light'}catch{document.documentElement.classList.add('light')}})()`
