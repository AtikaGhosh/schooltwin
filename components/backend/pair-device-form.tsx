'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

import { configureLocalPin } from '@/lib/schooltwin/backend/device-lock'
import { ProductionSchoolTwinService } from '@/lib/schooltwin/backend/production-service'

const service = new ProductionSchoolTwinService()

export function PairDeviceForm() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError(null)
    try {
      await service.pairDevice(
        String(form.get('schoolId')),
        String(form.get('label')),
        String(form.get('pairingCode')),
      )
      await configureLocalPin(String(form.get('pin')))
      await service.pull()
      router.replace('/home')
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Device pairing failed.',
      )
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-5">
      <PairField label="School ID" name="schoolId" />
      <PairField
        label="Device name"
        name="label"
        placeholder="Office tablet 1"
      />
      <PairField label="10-minute pairing code" name="pairingCode" />
      <PairField
        label="New six-digit unlock PIN"
        name="pin"
        inputMode="numeric"
        pattern="[0-9]{6}"
      />
      <p className="text-muted-foreground text-xs leading-5">
        This PIN only prevents casual access to this screen. It is not proof
        that the device is secure.
      </p>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <button
        disabled={busy}
        className="primary-action min-h-12 w-full rounded-lg px-5 font-semibold"
      >
        {busy ? 'Pairing…' : 'Pair this device'}
      </button>
    </form>
  )
}

function PairField(props: {
  label: string
  name: string
  placeholder?: string
  inputMode?: 'numeric'
  pattern?: string
}) {
  return (
    <label className="block text-sm font-medium">
      {props.label}
      <input
        required
        name={props.name}
        placeholder={props.placeholder}
        inputMode={props.inputMode}
        pattern={props.pattern}
        className="border-input bg-background mt-2 min-h-12 w-full rounded-lg border px-3"
      />
    </label>
  )
}
