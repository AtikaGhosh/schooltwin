import { createHmac } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const required = [
  'RESTORE_SUPABASE_URL',
  'RESTORE_SUPABASE_SECRET_KEY',
  'INTERNAL_CRON_SECRET',
  'RESTORE_REPORT_SECRET',
  'RESTORE_RECOVERY_POINT',
]
for (const name of required)
  if (!process.env[name]) throw new Error(`Missing ${name}`)
if (process.env.RESTORE_NETWORK_ISOLATED !== 'true')
  throw new Error('Restore target must be network-isolated')

const revocations = process.env.RESTORE_REVOCATIONS_FILE
  ? JSON.parse(await readFile(process.env.RESTORE_REVOCATIONS_FILE, 'utf8'))
  : {}
const base = process.env.RESTORE_SUPABASE_URL.replace(/\/$/, '')
const key = process.env.RESTORE_SUPABASE_SECRET_KEY
const headers = {
  apikey: key,
  authorization: `Bearer ${key}`,
  'content-type': 'application/json',
}
const prepared = await rpc('rpc_restore_prepare', {
  p_recovery_point: process.env.RESTORE_RECOVERY_POINT,
  p_revoked_user_ids: revocations.userIds ?? [],
  p_revoked_device_ids: revocations.deviceIds ?? [],
  p_revoked_batch_ids: revocations.batchIds ?? [],
})
const retention = await request(`${base}/functions/v1/retention-worker`, {
  headers: {
    ...headers,
    'x-schooltwin-cron-secret': process.env.INTERNAL_CRON_SECRET,
  },
  body: '{}',
})
const report = {
  recoveryPoint: process.env.RESTORE_RECOVERY_POINT,
  prepared,
  retention,
  checkedAt: new Date().toISOString(),
}
const signature = createHmac('sha256', process.env.RESTORE_REPORT_SECRET)
  .update(JSON.stringify(report))
  .digest('hex')
const finalized = await rpc('rpc_restore_finalize', {
  p_run_id: prepared.runId,
  p_report_hmac: signature,
})
process.stdout.write(
  `${JSON.stringify({ ...report, finalized, signature }, null, 2)}\n`,
)

async function rpc(name, body) {
  return request(`${base}/rest/v1/rpc/${name}`, {
    headers,
    body: JSON.stringify(body),
  })
}
async function request(url, options) {
  const response = await fetch(url, { method: 'POST', ...options })
  const body = await response.json().catch(() => ({}))
  if (!response.ok)
    throw new Error(
      `${response.status}: ${body.message ?? body.error ?? 'request failed'}`,
    )
  return body
}
