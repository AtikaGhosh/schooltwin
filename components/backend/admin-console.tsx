'use client'

import { useState, type FormEvent } from 'react'

import { invokeMumbai } from '@/lib/schooltwin/backend/browser-client'

type AdminAction =
  | 'admin-school-save'
  | 'admin-operator-invite'
  | 'admin-device-manage'
  | 'admin-pass-batch-create'
  | 'admin-pass-batch-revoke'
  | 'admin-pass-batch-confirm'

export function AdminConsole() {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <AdminForm
        title="School setup"
        action="admin-school-save"
        fields={[
          ['name', 'School name'],
          ['schoolTwinId', 'SchoolTwin ID'],
          ['district', 'District'],
          ['state', 'State'],
          ['timeZone', 'Time zone'],
          ['openingTime', 'Opening time'],
          ['closingTime', 'Closing time'],
        ]}
      />
      <AdminForm
        title="Invite operator"
        action="admin-operator-invite"
        fields={[
          ['schoolId', 'School ID'],
          ['email', 'Email'],
          ['displayName', 'Name'],
          ['role', 'Role'],
        ]}
      />
      <AdminForm
        title="Save full school configuration"
        action="admin-school-save"
        fixed={{ configurationJson: 'true' }}
        fields={[
          ['schoolId', 'School ID'],
          [
            'configuration',
            'JSON: 18 sections, areas, two facility rules, calendar',
          ],
        ]}
      />
      <AdminForm
        title="Create pairing code"
        action="admin-device-manage"
        fixed={{ action: 'create_pairing_code' }}
        fields={[['schoolId', 'School ID']]}
      />
      <AdminForm
        title="Revoke device"
        action="admin-device-manage"
        fixed={{ action: 'revoke' }}
        fields={[
          ['deviceId', 'Device ID'],
          ['reason', 'Reason'],
        ]}
      />
      <AdminForm
        title="Create participant pass batch"
        action="admin-pass-batch-create"
        fields={[
          ['schoolId', 'School ID'],
          ['schoolDayId', 'School day ID'],
          ['sessionType', 'student_pulse or private_report'],
          ['count', 'Number of sealed passes'],
        ]}
      />
      <AdminForm
        title="Revoke pass batch"
        action="admin-pass-batch-revoke"
        fields={[['batchId', 'Batch ID']]}
      />
      <AdminForm
        title="Confirm pass batch printed"
        action="admin-pass-batch-confirm"
        fields={[['batchId', 'Batch ID']]}
      />
    </div>
  )
}

function AdminForm({
  title,
  action,
  fields,
  fixed,
}: {
  title: string
  action: AdminAction
  fields: string[][]
  fixed?: Record<string, string>
}) {
  const [result, setResult] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setResult(null)
    const entries = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    )
    const body: Record<string, unknown> = { ...fixed, ...entries }
    if (typeof body.sessionIds === 'string') {
      body.sessionIds = body.sessionIds
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    }
    if (fixed?.configurationJson === 'true') {
      try {
        body.configuration = JSON.parse(
          String(entries.configuration),
        ) as Record<string, unknown>
      } catch {
        setResult('Configuration must be valid JSON.')
        setBusy(false)
        return
      }
      delete body.configurationJson
    } else if (action === 'admin-school-save') body.school = { ...entries }
    try {
      const response = await invokeMumbai<Record<string, unknown>>(action, body)
      setResult(JSON.stringify(response, null, 2))
    } catch (cause) {
      setResult(cause instanceof Error ? cause.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="elevated-surface rounded-xl p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <form onSubmit={(event) => void submit(event)} className="mt-5 space-y-4">
        {fields.map(([name, label]) => (
          <label key={name} className="block text-sm font-medium">
            {label}
            <input
              required
              name={name}
              className="border-input bg-background mt-2 min-h-11 w-full rounded-lg border px-3"
            />
          </label>
        ))}
        <button
          disabled={busy}
          className="primary-action min-h-11 rounded-lg px-4 text-sm font-semibold"
        >
          {busy ? 'Saving…' : title}
        </button>
      </form>
      {result ? (
        <pre className="bg-muted mt-4 max-h-56 overflow-auto rounded-lg p-3 text-xs whitespace-pre-wrap">
          {result}
        </pre>
      ) : null}
    </section>
  )
}
