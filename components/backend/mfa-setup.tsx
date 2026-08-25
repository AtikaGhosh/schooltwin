'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

import { getSupabaseBrowserClient } from '@/lib/schooltwin/backend/browser-client'

interface Enrollment {
  factorId: string
  qrCode: string
  secret: string
}

export function MfaSetup() {
  const router = useRouter()
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const client = getSupabaseBrowserClient()
    client.auth.mfa.listFactors().then(async ({ data }) => {
      const existing = data?.totp.find((factor) => factor.status === 'verified')
      if (existing) {
        const challenged = await client.auth.mfa.challenge({
          factorId: existing.id,
        })
        if (active && challenged.data) {
          setEnrollment({
            factorId: existing.id,
            qrCode: '',
            secret: challenged.data.id,
          })
        }
        return
      }
      const result = await client.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'DrishtiShala admin',
      })
      if (!active) return
      if (result.error) setError(result.error.message)
      else if (result.data) {
        setEnrollment({
          factorId: result.data.id,
          qrCode: result.data.totp.qr_code,
          secret: result.data.totp.secret,
        })
      }
    })
    return () => {
      active = false
    }
  }, [])

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!enrollment) return
    setError(null)
    const code = String(new FormData(event.currentTarget).get('code'))
    const client = getSupabaseBrowserClient()
    const factors = await client.auth.mfa.listFactors()
    const verified = factors.data?.totp.find(
      (factor) =>
        factor.id === enrollment.factorId && factor.status === 'verified',
    )
    let challengeId: string
    if (verified) {
      const challenge = await client.auth.mfa.challenge({
        factorId: enrollment.factorId,
      })
      if (challenge.error || !challenge.data)
        return setError(challenge.error?.message ?? 'Verification failed')
      challengeId = challenge.data.id
    } else {
      const challenge = await client.auth.mfa.challenge({
        factorId: enrollment.factorId,
      })
      if (challenge.error || !challenge.data)
        return setError(challenge.error?.message ?? 'Verification failed')
      challengeId = challenge.data.id
    }
    const result = await client.auth.mfa.verify({
      factorId: enrollment.factorId,
      challengeId,
      code,
    })
    if (result.error) setError(result.error.message)
    else {
      router.replace('/admin')
      router.refresh()
    }
  }

  if (error && !enrollment)
    return (
      <p role="alert" className="text-destructive text-sm">
        {error}
      </p>
    )
  if (!enrollment)
    return (
      <p role="status" className="text-sm">
        Preparing authenticator setup…
      </p>
    )

  return (
    <div className="mt-6">
      {enrollment.qrCode ? (
        <div className="space-y-3">
          {/* Supabase returns this QR as a data URL generated for this enrolment. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={enrollment.qrCode}
            alt="Authenticator setup QR code"
            className="size-48 rounded-lg bg-white p-2"
          />
          <details className="text-sm">
            <summary>Cannot scan?</summary>
            <code className="mt-2 block break-all">{enrollment.secret}</code>
          </details>
        </div>
      ) : null}
      <form onSubmit={(event) => void verify(event)} className="mt-5 space-y-4">
        <label className="block text-sm font-medium">
          Six-digit authenticator code
          <input
            name="code"
            required
            inputMode="numeric"
            pattern="[0-9]{6}"
            autoComplete="one-time-code"
            className="border-input bg-background mt-2 min-h-12 w-full rounded-lg border px-3"
          />
        </label>
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
        <button className="primary-action min-h-12 rounded-lg px-5 font-semibold">
          Verify and continue
        </button>
      </form>
    </div>
  )
}
