import 'server-only'

import { redirect } from 'next/navigation'

import { getSupabaseServerClient } from './server-client'

export type AccountRole =
  'platform_admin' | 'field_coordinator' | 'school_operator'

export interface AccountView {
  id: string
  email: string
  displayName: string
  role: AccountRole
  mfaLevel: string | null
}

export async function getAccount(): Promise<AccountView | null> {
  const supabase = await getSupabaseServerClient()
  const [{ data: claims }, { data: assurance }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ])
  const claimPayload = claims?.claims
  const id = claimPayload?.sub
  if (typeof id !== 'string') return null
  const email =
    typeof claimPayload?.email === 'string' ? claimPayload.email : ''

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('display_name,role')
    .eq('user_id', id)
    .single()
  if (error || !profile) return null

  return {
    id,
    email,
    displayName: String(profile.display_name),
    role: profile.role as AccountRole,
    mfaLevel: assurance?.currentLevel ?? null,
  }
}

export async function requireAccount(): Promise<AccountView> {
  const account = await getAccount()
  if (!account) redirect('/login')
  return account
}

export async function requireAdminAccount(): Promise<AccountView> {
  const account = await requireAccount()
  if (!['platform_admin', 'field_coordinator'].includes(account.role)) {
    redirect('/home')
  }
  if (account.mfaLevel !== 'aal2') redirect('/mfa')
  return account
}
