import {
  createClient,
  type SupabaseClient,
  type User,
} from '@supabase/supabase-js'
import { HttpError } from './http.ts'

function env(name: string, fallback?: string): string {
  const value =
    Deno.env.get(name) ?? (fallback ? Deno.env.get(fallback) : undefined)
  if (!value) throw new HttpError(500, `missing_${name.toLowerCase()}`)
  return value
}

export function serviceClient(): SupabaseClient {
  return createClient(
    env('SUPABASE_URL'),
    env('SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  )
}

export function userClient(request: Request): SupabaseClient {
  const authorization = request.headers.get('authorization')
  if (!authorization) throw new HttpError(401, 'authentication_required')
  return createClient(
    env('SUPABASE_URL'),
    env('SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY'),
    {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  )
}

export async function authenticatedUser(client: SupabaseClient): Promise<User> {
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) throw new HttpError(401, 'authentication_required')
  return data.user
}

export async function assertAdmin(
  request: Request,
  client: SupabaseClient,
): Promise<User> {
  const user = await authenticatedUser(client)
  const token =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  const payload = decodeJwt(token)
  if (payload.aal !== 'aal2') throw new HttpError(403, 'mfa_required')
  const { data, error } = await client
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()
  if (
    error ||
    !data ||
    !['platform_admin', 'field_coordinator'].includes(data.role)
  )
    throw new HttpError(403, 'not_authorized')
  return user
}

function decodeJwt(token: string): Record<string, unknown> {
  try {
    const part = token.split('.')[1]
    return JSON.parse(
      atob(part.replaceAll('-', '+').replaceAll('_', '/')),
    ) as Record<string, unknown>
  } catch {
    throw new HttpError(401, 'invalid_session')
  }
}
