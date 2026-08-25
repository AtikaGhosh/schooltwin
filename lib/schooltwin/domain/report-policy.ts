export const SENSITIVE_REPORT_CATEGORY =
  'sensitive_or_immediate_safety' as const

export function requiresProtectedReporting(category: string): boolean {
  return category === SENSITIVE_REPORT_CATEGORY
}
