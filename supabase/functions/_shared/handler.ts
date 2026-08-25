import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from 'npm:@aws-sdk/client-s3@3'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  assertAdmin,
  authenticatedUser,
  serviceClient,
  userClient,
} from './clients.ts'
import {
  generateHumanCode,
  hmacHex,
  normalizeHumanCode,
  randomToken,
  sha256Hex,
  signedWorkLease,
} from './crypto.ts'
import {
  bodyJson,
  corsHeaders,
  HttpError,
  json,
  mapError,
  requireString,
} from './http.ts'

type FunctionName =
  | 'device-pair'
  | 'device-refresh'
  | 'device-revoke'
  | 'sync-pull'
  | 'sync-push'
  | 'participant-redeem'
  | 'participant-submit'
  | 'capture-begin'
  | 'capture-finalize'
  | 'evidence-download'
  | 'admin-school-save'
  | 'admin-operator-invite'
  | 'admin-device-manage'
  | 'admin-pass-batch-create'
  | 'admin-pass-batch-revoke'
  | 'admin-pass-batch-confirm'
  | 'evidence-fingerprint-worker'
  | 'retention-worker'
  | 'health'

export function createFunctionHandler(name: FunctionName) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers: corsHeaders(request) })
    if (request.method !== 'POST')
      return json(request, { error: 'method_not_allowed' }, 405)
    try {
      const result = await route(name, request)
      return json(request, result)
    } catch (cause) {
      const error = mapError(cause)
      return json(request, { error: error.code }, error.status)
    }
  }
}

async function route(name: FunctionName, request: Request): Promise<unknown> {
  switch (name) {
    case 'device-pair':
      return pairDevice(request)
    case 'device-refresh':
      return refreshDevice(request)
    case 'device-revoke':
      return manageDevice(request, 'revoke')
    case 'sync-pull':
      return syncPull(request)
    case 'sync-push':
      return syncPush(request)
    case 'participant-redeem':
      return redeemParticipant(request)
    case 'participant-submit':
      return submitParticipant(request)
    case 'capture-begin':
      return beginCapture(request)
    case 'capture-finalize':
      return finalizeCapture(request)
    case 'evidence-download':
      return evidenceDownload(request)
    case 'admin-school-save':
      return adminSchoolSave(request)
    case 'admin-operator-invite':
      return adminOperatorInvite(request)
    case 'admin-device-manage':
      return manageDevice(request)
    case 'admin-pass-batch-create':
      return adminPassBatchCreate(request)
    case 'admin-pass-batch-revoke':
      return adminPassBatchRevoke(request)
    case 'admin-pass-batch-confirm':
      return adminPassBatchConfirm(request)
    case 'evidence-fingerprint-worker':
      return fingerprintWorker(request)
    case 'retention-worker':
      return retentionWorker(request)
    case 'health':
      return rpc(serviceClient(), 'rpc_backend_health', {})
  }
}

async function pairDevice(request: Request) {
  const body = await bodyJson(request)
  const client = userClient(request)
  await authenticatedUser(client)
  const leaseToken = randomToken()
  const result = await rpc(client, 'rpc_pair_device', {
    p_school_id: requireString(body, 'schoolId'),
    p_label: requireString(body, 'label'),
    p_pairing_code_hmac: await hmacHex(
      secret('DEVICE_TOKEN_PEPPER'),
      normalizeHumanCode(requireString(body, 'pairingCode')),
    ),
    p_lease_token_hash: await sha256Hex(leaseToken),
  })
  return {
    ...asObject(result),
    schoolId: requireString(body, 'schoolId'),
    leaseToken,
  }
}

async function refreshDevice(request: Request) {
  const body = await bodyJson(request)
  const client = userClient(request)
  await authenticatedUser(client)
  const current = requireString(body, 'leaseToken')
  const next = randomToken()
  const result = await rpc(client, 'rpc_refresh_device_lease', {
    p_device_id: requireString(body, 'deviceId'),
    p_current_token_hash: await sha256Hex(current),
    p_next_token_hash: await sha256Hex(next),
  })
  return { ...asObject(result), leaseToken: next }
}

async function syncPull(request: Request) {
  const body = await bodyJson(request)
  const client = userClient(request)
  await authenticatedUser(client)
  const schoolId = requireString(body, 'schoolId')
  const deviceId = requireString(body, 'deviceId')
  const deviceTokenHash = await sha256Hex(requireString(body, 'leaseToken'))
  await rpc(client, 'rpc_prepare_offline_work', {
    p_school_id: schoolId,
    p_device_id: deviceId,
    p_device_token_hash: deviceTokenHash,
  })
  const pulled = asObject(
    await rpc(client, 'rpc_sync_pull', {
      p_school_id: schoolId,
      p_device_id: deviceId,
      p_device_token_hash: deviceTokenHash,
      p_cursor: typeof body.cursor === 'string' ? body.cursor : null,
    }),
  )
  const tasks = Array.isArray(pulled.tasks)
    ? (pulled.tasks as Array<Record<string, unknown>>)
    : []
  const workLeases: Array<Record<string, unknown>> = []
  for (const task of tasks) {
    if (
      typeof task.id !== 'string' ||
      !['scheduled', 'in_progress'].includes(String(task.status))
    )
      continue
    const token = await signedWorkLease({
      schoolId,
      deviceId,
      taskId: task.id,
      nonce: crypto.randomUUID(),
    })
    const lease = asObject(
      await rpc(client, 'rpc_issue_work_lease', {
        p_school_id: schoolId,
        p_device_id: deviceId,
        p_device_token_hash: deviceTokenHash,
        p_task_id: task.id,
        p_token_hash: await sha256Hex(token),
      }),
    )
    workLeases.push({
      ...lease,
      kind: 'capture',
      subjectId: task.id,
      taskId: task.id,
      token,
    })
  }
  const facilityAssignments = Array.isArray(pulled.facilityAssignments)
    ? (pulled.facilityAssignments as Array<Record<string, unknown>>)
    : []
  for (const assignment of facilityAssignments) {
    if (
      typeof assignment.id !== 'string' ||
      !['scheduled', 'in_progress'].includes(String(assignment.status))
    )
      continue
    const token = await signedWorkLease({
      schoolId,
      deviceId,
      taskId: `facility_check:${assignment.id}`,
      nonce: crypto.randomUUID(),
    })
    const lease = asObject(
      await rpc(client, 'rpc_issue_operator_work_lease', {
        p_school_id: schoolId,
        p_device_id: deviceId,
        p_device_token_hash: deviceTokenHash,
        p_subject_kind: 'facility_check',
        p_subject_id: assignment.id,
        p_token_hash: await sha256Hex(token),
      }),
    )
    workLeases.push({ ...lease, token })
  }
  const reportToken = await signedWorkLease({
    schoolId,
    deviceId,
    taskId: 'operator_report',
    nonce: crypto.randomUUID(),
  })
  const reportLease = asObject(
    await rpc(client, 'rpc_issue_operator_work_lease', {
      p_school_id: schoolId,
      p_device_id: deviceId,
      p_device_token_hash: deviceTokenHash,
      p_subject_kind: 'operator_report',
      p_subject_id: null,
      p_token_hash: await sha256Hex(reportToken),
    }),
  )
  workLeases.push({ ...reportLease, token: reportToken })
  const participantLaunches = await rpc(
    client,
    'rpc_operator_participant_launches',
    { p_school_id: schoolId },
  )
  const operatorHistory = Array.isArray(pulled.operatorHistory)
    ? (pulled.operatorHistory as Array<Record<string, unknown>>).map(
        (item) => ({
          id: item.id,
          kind: item.kind,
          title: item.title,
          submittedAt: item.accepted_at,
          evidenceId: item.evidence_id,
        }),
      )
    : []
  return { ...pulled, workLeases, operatorHistory, participantLaunches }
}

async function syncPush(request: Request) {
  const body = await bodyJson(request)
  const client = userClient(request)
  await authenticatedUser(client)
  const mutations = Array.isArray(body.mutations)
    ? (body.mutations as Array<Record<string, unknown>>)
    : []
  if (mutations.length > 50) throw new HttpError(400, 'too_many_mutations')
  const tokenHash = await sha256Hex(requireString(body, 'leaseToken'))
  const results = []
  for (const mutation of mutations) {
    try {
      const response = await rpc(client, 'rpc_apply_operator_mutation_v2', {
        p_mutation_id: requireString(mutation, 'id'),
        p_school_id: requireString(body, 'schoolId'),
        p_device_id: requireString(body, 'deviceId'),
        p_device_token_hash: tokenHash,
        p_type: databaseMutationType(requireString(mutation, 'type')),
        p_payload: mutation.payload ?? {},
        p_occurred_at_client: requireString(mutation, 'occurredAtClient'),
        p_offline_claimed: mutation.offlineClaimed === true,
        p_work_lease_hash:
          typeof mutation.workLeaseToken === 'string'
            ? await sha256Hex(mutation.workLeaseToken)
            : null,
      })
      results.push({ id: mutation.id, ...asObject(response) })
    } catch (cause) {
      const error = mapError(cause)
      results.push({
        id: mutation.id,
        result: error.status >= 500 ? 'retry' : 'rejected',
        error: error.code,
      })
    }
  }
  return { serverTime: new Date().toISOString(), results }
}

function databaseMutationType(value: string): string {
  if (value === 'operator_report_submit') return 'operator_report'
  if (value === 'facility_check_submit') return 'facility_pulse'
  throw new HttpError(400, 'unsupported_mutation')
}

async function redeemParticipant(request: Request) {
  const body = await bodyJson(request)
  const service = serviceClient()
  const capabilityToken = randomToken()
  const sessionId = requireString(body, 'sessionId')
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const data = asObject(
    await rpc(service, 'rpc_redeem_access_grant_v3', {
      p_session_id: sessionId,
      p_code_hmac: await hmacHex(
        secret('ACCESS_GRANT_PEPPER'),
        normalizeHumanCode(requireString(body, 'code')),
      ),
      p_device_id: requireString(body, 'deviceId'),
      p_ip_hash: await hmacHex(secret('ACCESS_GRANT_PEPPER'), ip),
      p_capability_token_hash: await sha256Hex(capabilityToken),
    }),
  )
  if (data.ok !== true)
    throw new HttpError(
      data.error === 'redemption_locked' ? 429 : 400,
      String(data.error ?? 'invalid_grant'),
    )
  return {
    capabilityToken,
    capabilityId: data.capabilityId,
    session: {
      id: data.sessionId,
      type: data.sessionType,
      expiresAt: data.expiresAt,
    },
  }
}

async function submitParticipant(request: Request) {
  const body = await bodyJson(request)
  const service = serviceClient()
  const result = asObject(
    await rpc(service, 'rpc_submit_participant_response_v2', {
      p_capability_hash: await sha256Hex(
        requireString(body, 'capabilityToken'),
      ),
      p_payload: body.payload ?? {},
    }),
  )
  if (result.ok === false) {
    throw new HttpError(400, String(result.error ?? 'submission_rejected'))
  }
  return result
}

async function beginCapture(request: Request) {
  const body = await bodyJson(request)
  const client = userClient(request)
  await authenticatedUser(client)
  const objectPath = `${requireString(body, 'schoolId')}/${requireString(body, 'taskId')}/${crypto.randomUUID()}.webm`
  const workLeaseToken = randomToken()
  const shared = {
    p_school_id: requireString(body, 'schoolId'),
    p_device_id: requireString(body, 'deviceId'),
    p_device_token_hash: await sha256Hex(requireString(body, 'leaseToken')),
    p_task_id: requireString(body, 'taskId'),
    p_object_path: objectPath,
  }
  const offline = body.offline === true
  const result = asObject(
    await rpc(
      client,
      offline ? 'rpc_begin_offline_capture_v2' : 'rpc_begin_capture',
      offline
        ? {
            ...shared,
            p_capture_lease_hash: await sha256Hex(workLeaseToken),
            p_offline_lease_hash: await sha256Hex(
              requireString(body, 'workLeaseToken'),
            ),
            p_client_started_at: requireString(body, 'startedAtClient'),
          }
        : {
            ...shared,
            p_work_lease_hash: await sha256Hex(workLeaseToken),
            p_offline: false,
          },
    ),
  )
  const { data, error } = await serviceClient()
    .storage.from('school-evidence')
    .createSignedUploadUrl(objectPath, { upsert: false })
  if (error || !data) throw new HttpError(500, 'upload_intent_failed')
  const challenge = asObject(result.challenge)
  return {
    ...result,
    challenge: {
      id: challenge.id,
      taskId: challenge.task_id,
      displayCode: challenge.display_code,
      instructions: Array.isArray(challenge.steps) ? challenge.steps : [],
      issuedAt: challenge.issued_at,
    },
    workLeaseToken,
    uploadToken: data.token,
    uploadPath: objectPath,
  }
}

async function finalizeCapture(request: Request) {
  const body = await bodyJson(request)
  const client = userClient(request)
  await authenticatedUser(client)
  const objectPath = requireString(body, 'objectPath')
  await assertStoredObject(
    objectPath,
    Number(body.byteLength),
    requireString(body, 'mimeType'),
  )
  const finalized = asObject(
    await rpc(client, 'rpc_finalize_capture_v2', {
      p_mutation_id: requireString(body, 'mutationId'),
      p_school_id: requireString(body, 'schoolId'),
      p_device_id: requireString(body, 'deviceId'),
      p_device_token_hash: await sha256Hex(requireString(body, 'leaseToken')),
      p_capture_intent_id: requireString(body, 'captureIntentId'),
      p_byte_length: Number(body.byteLength),
      p_mime_type: requireString(body, 'mimeType'),
      p_client_sha256: requireString(body, 'sha256'),
      p_client_started_at: body.startedAtClient ?? null,
      p_client_ended_at: body.endedAtClient ?? null,
      p_marker_method: requireString(body, 'markerMethod'),
      p_marker_value: body.markerValue ?? null,
      p_expected_marker_matched: body.expectedMarkerMatched === true,
    }),
  )
  if (typeof finalized.evidenceId === 'string') {
    defer(processEvidenceFingerprint(finalized.evidenceId))
  }
  return finalized
}

async function evidenceDownload(request: Request) {
  const body = await bodyJson(request)
  const client = userClient(request)
  await authenticatedUser(client)
  const objectPath = await rpc(client, 'rpc_authorize_evidence_download', {
    p_evidence_id: requireString(body, 'evidenceId'),
  })
  if (typeof objectPath !== 'string')
    throw new HttpError(404, 'evidence_unavailable')
  const signed = await serviceClient()
    .storage.from('school-evidence')
    .createSignedUrl(objectPath, 60)
  if (signed.error || !signed.data)
    throw new HttpError(500, 'playback_link_failed')
  return { signedUrl: signed.data.signedUrl, expiresInSeconds: 60 }
}

async function adminSchoolSave(request: Request) {
  const body = await bodyJson(request)
  const client = userClient(request)
  await assertAdmin(request, client)
  const schoolId =
    typeof body.schoolId === 'string'
      ? body.schoolId
      : String(
          await rpc(client, 'rpc_admin_save_school', {
            p_school: body.school ?? body,
          }),
        )
  const configuration = body.configuration
  if (
    configuration &&
    typeof configuration === 'object' &&
    !Array.isArray(configuration)
  ) {
    return rpc(client, 'rpc_admin_save_school_configuration', {
      p_school_id: schoolId,
      p_config: configuration,
    })
  }
  return { schoolId }
}

async function adminOperatorInvite(request: Request) {
  const body = await bodyJson(request)
  const client = userClient(request)
  await assertAdmin(request, client)
  const email = requireString(body, 'email')
  const role = requireString(body, 'role')
  if (!['school_operator', 'field_coordinator'].includes(role))
    throw new HttpError(400, 'invalid_role')
  const invited = await serviceClient().auth.admin.inviteUserByEmail(email, {
    data: { display_name: requireString(body, 'displayName') },
  })
  if (invited.error || !invited.data.user)
    throw invited.error ?? new Error('invite_failed')
  await rpc(client, 'rpc_admin_register_profile', {
    p_user_id: invited.data.user.id,
    p_display_name: requireString(body, 'displayName'),
    p_role: role,
    p_school_id: requireString(body, 'schoolId'),
  })
  return { userId: invited.data.user.id, invited: true }
}

async function manageDevice(request: Request, forcedAction?: string) {
  const body = await bodyJson(request)
  const client = userClient(request)
  await assertAdmin(request, client)
  const action = forcedAction ?? requireString(body, 'action')
  if (action === 'create_pairing_code') {
    const code = generateHumanCode(8)
    const result = await rpc(client, 'rpc_admin_create_pairing_code', {
      p_school_id: requireString(body, 'schoolId'),
      p_code_hmac: await hmacHex(
        secret('DEVICE_TOKEN_PEPPER'),
        normalizeHumanCode(code),
      ),
    })
    return { ...asObject(result), pairingCode: code }
  }
  if (action === 'revoke') {
    await rpc(client, 'rpc_admin_revoke_device', {
      p_device_id: requireString(body, 'deviceId'),
      p_reason: requireString(body, 'reason'),
    })
    return { revoked: true }
  }
  throw new HttpError(400, 'unsupported_device_action')
}

async function adminPassBatchCreate(request: Request) {
  const body = await bodyJson(request)
  const client = userClient(request)
  await assertAdmin(request, client)
  let sessionIds = Array.isArray(body.sessionIds)
    ? body.sessionIds.filter((id): id is string => typeof id === 'string')
    : []
  if (sessionIds.length === 0 && typeof body.sessionType === 'string') {
    const created = await rpc(client, 'rpc_admin_create_participant_sessions', {
      p_school_id: requireString(body, 'schoolId'),
      p_school_day_id: requireString(body, 'schoolDayId'),
      p_type: body.sessionType,
      p_count: Number(body.count ?? 1),
    })
    sessionIds = Array.isArray(created)
      ? created.filter((id): id is string => typeof id === 'string')
      : []
  }
  if (sessionIds.length === 0 || sessionIds.length > 100)
    throw new HttpError(400, 'invalid_session_batch')
  const printItems = await Promise.all(
    sessionIds.map(async (sessionId) => {
      const code = generateHumanCode(12)
      return {
        sessionId,
        code,
        codeHmac: await hmacHex(
          secret('ACCESS_GRANT_PEPPER'),
          normalizeHumanCode(code),
        ),
      }
    }),
  )
  const result = await rpc(client, 'rpc_admin_issue_grant_batch', {
    p_school_id: requireString(body, 'schoolId'),
    p_school_day_id: requireString(body, 'schoolDayId'),
    p_grants: printItems.map(({ sessionId, codeHmac }) => ({
      sessionId,
      codeHmac,
    })),
  })
  return {
    ...asObject(result),
    printItems: printItems.map(({ sessionId, code }) => ({ sessionId, code })),
    shownOnce: true,
  }
}

async function adminPassBatchRevoke(request: Request) {
  const body = await bodyJson(request)
  const client = userClient(request)
  await assertAdmin(request, client)
  await rpc(client, 'rpc_admin_revoke_grant_batch', {
    p_batch_id: requireString(body, 'batchId'),
  })
  return { revoked: true }
}

async function adminPassBatchConfirm(request: Request) {
  const body = await bodyJson(request)
  const client = userClient(request)
  await assertAdmin(request, client)
  await rpc(client, 'rpc_admin_confirm_batch_printed', {
    p_batch_id: requireString(body, 'batchId'),
  })
  return { confirmedPrinted: true }
}

async function fingerprintWorker(request: Request) {
  assertCron(request)
  const body = await bodyJson(request)
  return processEvidenceFingerprint(requireString(body, 'evidenceId'))
}

async function processEvidenceFingerprint(evidenceId: string) {
  const service = serviceClient()
  const claimed = (await rpc(service, 'rpc_claim_evidence_fingerprint', {
    p_evidence_id: evidenceId,
  })) as Array<{
    object_path: string
    client_sha256: string
    backup_delete_after: string
  }>
  const selected = claimed[0]
  if (!selected) throw new HttpError(404, 'evidence_unavailable')
  const downloaded = await service.storage
    .from('school-evidence')
    .download(selected.object_path)
  if (downloaded.error || !downloaded.data)
    throw new HttpError(500, 'evidence_download_failed')
  const bytes = await downloaded.data.arrayBuffer()
  const serverSha = await sha256Hex(bytes)
  await rpc(service, 'rpc_set_evidence_fingerprint', {
    p_evidence_id: evidenceId,
    p_server_sha256: serverSha,
    p_matched: serverSha === selected.client_sha256,
  })
  try {
    await mirrorObject(
      selected.object_path,
      new Uint8Array(bytes),
      selected.backup_delete_after,
    )
    await rpc(service, 'rpc_set_evidence_backup', {
      p_evidence_id: evidenceId,
      p_status: 'mirrored',
    })
  } catch {
    await rpc(service, 'rpc_set_evidence_backup', {
      p_evidence_id: evidenceId,
      p_status: 'failed',
    })
  }
  return {
    evidenceId,
    fingerprintStatus:
      serverSha === selected.client_sha256 ? 'matched' : 'failed',
  }
}

function defer(task: Promise<unknown>): void {
  const runtime = (
    globalThis as unknown as {
      EdgeRuntime?: { waitUntil(value: Promise<unknown>): void }
    }
  ).EdgeRuntime
  if (runtime) runtime.waitUntil(task)
  else void task.catch(() => undefined)
}

async function retentionWorker(request: Request) {
  assertCron(request)
  const service = serviceClient()
  const expired = (await rpc(
    service,
    'rpc_claim_expired_evidence',
    {},
  )) as Array<{ evidence_id: string; object_path: string }>
  for (const item of expired) {
    const primary = await service.storage
      .from('school-evidence')
      .remove([item.object_path])
    let mirrorError: string | null = null
    if (!primary.error) {
      try {
        await deleteMirror(item.object_path)
      } catch (cause) {
        mirrorError =
          cause instanceof Error ? cause.message : 'mirror_delete_failed'
      }
    }
    await rpc(service, 'rpc_complete_evidence_deletion', {
      p_evidence_id: item.evidence_id,
      p_succeeded: !primary.error && !mirrorError,
      p_error: primary.error?.message ?? mirrorError,
    })
  }
  const orphans = (await rpc(
    service,
    'rpc_claim_orphan_uploads',
    {},
  )) as Array<{
    intent_id: string
    object_path: string
  }>
  for (const orphan of orphans) {
    const removed = await service.storage
      .from('school-evidence')
      .remove([orphan.object_path])
    await rpc(service, 'rpc_complete_orphan_cleanup', {
      p_intent_id: orphan.intent_id,
      p_succeeded: !removed.error,
      p_error: removed.error?.message ?? null,
    })
  }
  const records = await rpc(service, 'rpc_apply_retention', {})
  return {
    evidenceDeleted: expired.length,
    orphansDeleted: orphans.length,
    records,
  }
}

async function rpc(
  client: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { data, error } = await client.rpc(name, args)
  if (error) throw new Error(error.message)
  return data
}

async function assertStoredObject(
  path: string,
  expectedBytes: number,
  expectedMime: string,
) {
  const [fileName, ...folderParts] = path.split('/').reverse()
  const folder = folderParts.reverse().join('/')
  const { data, error } = await serviceClient()
    .storage.from('school-evidence')
    .list(folder, { search: fileName, limit: 2 })
  if (error || !data) throw new HttpError(400, 'uploaded_object_missing')
  const object = data.find((item) => item.name === fileName)
  if (!object) throw new HttpError(400, 'uploaded_object_missing')
  const metadata = object.metadata as Record<string, unknown> | null
  if (Number(metadata?.size) !== expectedBytes)
    throw new HttpError(400, 'uploaded_size_mismatch')
  const mime = String(metadata?.mimetype ?? metadata?.contentType ?? '')
  if (mime && mime !== expectedMime)
    throw new HttpError(400, 'uploaded_type_mismatch')
}

function assertCron(request: Request) {
  if (
    request.headers.get('x-schooltwin-cron-secret') !==
    secret('INTERNAL_CRON_SECRET')
  )
    throw new HttpError(401, 'invalid_internal_secret')
}

function secret(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new HttpError(500, `missing_${name.toLowerCase()}`)
  return value
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function backupClient() {
  return new S3Client({
    region: Deno.env.get('BACKUP_S3_REGION') ?? 'ap-south-1',
    endpoint: secret('BACKUP_S3_ENDPOINT'),
    forcePathStyle: true,
    credentials: {
      accessKeyId: secret('BACKUP_S3_ACCESS_KEY_ID'),
      secretAccessKey: secret('BACKUP_S3_SECRET_ACCESS_KEY'),
    },
  })
}

async function mirrorObject(
  key: string,
  body: Uint8Array,
  deleteAfter: string,
) {
  await backupClient().send(
    new PutObjectCommand({
      Bucket: secret('BACKUP_S3_BUCKET'),
      Key: key,
      Body: body,
      Metadata: { delete_after: deleteAfter },
    }),
  )
}

async function deleteMirror(key: string) {
  if (!Deno.env.get('BACKUP_S3_ENDPOINT')) return
  await backupClient().send(
    new DeleteObjectCommand({ Bucket: secret('BACKUP_S3_BUCKET'), Key: key }),
  )
}
