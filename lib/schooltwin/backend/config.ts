export type SchoolTwinMode = 'demo' | 'production'

export const PRODUCTION_CACHE_DB_NAME = 'schooltwin-production-cache'
export const PROTOTYPE_DB_NAME = 'schooltwin-prototype'
export const MUMBAI_FUNCTION_REGION = 'ap-south-1' as const

export function getSchoolTwinMode(): SchoolTwinMode {
  return process.env.NEXT_PUBLIC_SCHOOLTWIN_MODE === 'production'
    ? 'production'
    : 'demo'
}

export function isProductionMode(): boolean {
  return getSchoolTwinMode() === 'production'
}

export interface PublicSupabaseConfig {
  url: string
  publishableKey: string
}

export function getPublicSupabaseConfig(): PublicSupabaseConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !publishableKey) {
    throw new Error('production_backend_not_configured')
  }

  return { url, publishableKey }
}
