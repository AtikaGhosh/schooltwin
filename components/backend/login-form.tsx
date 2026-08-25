'use client'

import { useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { ProductionSchoolTwinService } from '@/lib/schooltwin/backend/production-service'

const service = new ProductionSchoolTwinService()

export function LoginForm() {
  const router = useRouter()
  const search = useSearchParams()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError(null)
    try {
      await service.signIn(
        String(form.get('email')),
        String(form.get('password')),
      )
      router.replace(search.get('next') ?? '/home')
      router.refresh()
    } catch {
      setError('The email or password was not accepted.')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-5">
      <Field label="Email" name="email" type="email" autoComplete="email" />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
      />
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <button
        disabled={busy}
        className="primary-action min-h-12 w-full rounded-lg px-5 text-sm font-semibold disabled:opacity-60"
      >
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}

function Field({
  label,
  name,
  type,
  autoComplete,
}: {
  label: string
  name: string
  type: string
  autoComplete: string
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        required
        name={name}
        type={type}
        autoComplete={autoComplete}
        className="border-input bg-background focus:ring-primary mt-2 min-h-12 w-full rounded-lg border px-3 outline-none focus:ring-2"
      />
    </label>
  )
}
