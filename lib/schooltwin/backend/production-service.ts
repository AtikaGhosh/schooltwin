'use client'

import type { User } from '@supabase/supabase-js'
import { Upload } from 'tus-js-client'

import { getSupabaseBrowserClient, invokeMumbai } from './browser-client'
import { getPublicSupabaseConfig } from './config'
import type {
  CaptureIntentResult,
  ClientMutation,
  DeviceIdentity,
  ParticipantRedemption,
  PassBatchResult,
  SyncPullResult,
  SyncPushResult,
} from './contracts'
import { ProductionCache, type RecoveryEvidence } from './production-cache'

export class ProductionSchoolTwinService {
  constructor(private readonly cache = new ProductionCache()) {}

  async signIn(email: string, password: string): Promise<User> {
    const { data, error } =
      await getSupabaseBrowserClient().auth.signInWithPassword({
        email,
        password,
      })
    if (error || !data.user) throw new Error(error?.message ?? 'sign_in_failed')
    return data.user
  }

  async signOut(): Promise<void> {
    const { error } = await getSupabaseBrowserClient().auth.signOut()
    if (error) throw error
    await this.cache.clearOperationalData()
    await this.cache.clearDevice()
  }

  async pairDevice(
    schoolId: string,
    label: string,
    pairingCode: string,
  ): Promise<DeviceIdentity> {
    const result = await invokeMumbai<DeviceIdentity>('device-pair', {
      schoolId,
      label,
      pairingCode,
    })
    await this.cache.saveDevice(result)
    return result
  }

  async refreshDevice(): Promise<DeviceIdentity> {
    const device = await this.requireDevice()
    const result = await invokeMumbai<DeviceIdentity>('device-refresh', {
      deviceId: device.deviceId,
      leaseToken: device.leaseToken,
    })
    const updated = { ...device, ...result }
    await this.cache.saveDevice(updated)
    return updated
  }

  async pull(): Promise<SyncPullResult> {
    const device = await this.requireDevice()
    const existing = await this.cache.getSnapshot()
    const result = await invokeMumbai<SyncPullResult>('sync-pull', {
      schoolId: device.schoolId,
      deviceId: device.deviceId,
      leaseToken: device.leaseToken,
      cursor: existing?.nextCursor ?? null,
    })
    await this.cache.saveSnapshot(result)
    return result
  }

  async queueMutation(mutation: ClientMutation): Promise<void> {
    await this.cache.enqueue(mutation)
  }

  async push(): Promise<SyncPushResult> {
    const device = await this.requireDevice()
    const mutations = await this.cache.pendingMutations()
    if (mutations.length === 0) {
      return { serverTime: new Date().toISOString(), results: [] }
    }
    await this.cache.markSending(mutations.map((mutation) => mutation.id))
    try {
      const result = await invokeMumbai<SyncPushResult>('sync-push', {
        schoolId: device.schoolId,
        deviceId: device.deviceId,
        leaseToken: device.leaseToken,
        mutations: mutations.map((mutation) => ({
          id: mutation.id,
          type: mutation.type,
          occurredAtClient: mutation.occurredAtClient,
          payload: mutation.payload,
          offlineClaimed: mutation.offlineClaimed === true,
          workLeaseToken: mutation.workLeaseToken,
        })),
      })
      for (const item of result.results) {
        await this.cache.resolveMutation(item.id, item.result, item.error)
      }
      return result
    } catch (cause) {
      for (const mutation of mutations) {
        await this.cache.resolveMutation(mutation.id, 'retry')
      }
      throw cause
    }
  }

  async redeemParticipant(
    sessionId: string,
    code: string,
  ): Promise<ParticipantRedemption> {
    const device = await this.requireDevice()
    const result = await invokeMumbai<ParticipantRedemption>(
      'participant-redeem',
      {
        sessionId,
        code,
        deviceId: device.deviceId,
      },
    )
    sessionStorage.setItem(capabilityKey(sessionId), result.capabilityToken)
    sessionStorage.setItem(
      `${capabilityKey(sessionId)}:id`,
      result.capabilityId,
    )
    return result
  }

  async submitParticipant(
    sessionId: string,
    payload: Record<string, unknown>,
  ): Promise<{ status: 'accepted'; sessionId: string }> {
    const capabilityToken = sessionStorage.getItem(capabilityKey(sessionId))
    if (!capabilityToken) throw new Error('participant_capability_missing')
    const result = await invokeMumbai<{
      status: 'accepted'
      sessionId: string
    }>('participant-submit', {
      capabilityToken,
      payload,
    })
    sessionStorage.removeItem(capabilityKey(sessionId))
    sessionStorage.removeItem(`${capabilityKey(sessionId)}:id`)
    return result
  }

  async beginCapture(
    taskId: string,
    offline = false,
    startedAtClient?: string,
  ): Promise<CaptureIntentResult> {
    const device = await this.requireDevice()
    const snapshot = await this.cache.getSnapshot()
    const workLeaseToken = offline
      ? snapshot?.workLeases.find(
          (lease) => lease.kind === 'capture' && lease.subjectId === taskId,
        )?.token
      : undefined
    if (offline && !workLeaseToken) throw new Error('valid_work_lease_required')
    return invokeMumbai<CaptureIntentResult>('capture-begin', {
      schoolId: device.schoolId,
      deviceId: device.deviceId,
      leaseToken: device.leaseToken,
      taskId,
      offline,
      workLeaseToken,
      startedAtClient,
    })
  }

  async uploadAndFinalizeCapture(input: {
    intent: CaptureIntentResult
    blob: Blob
    mutationId: string
    sha256: string
    startedAtClient: string
    endedAtClient: string
    markerMethod: string
    markerValue?: string
    expectedMarkerMatched: boolean
    onProgress?: (uploaded: number, total: number) => void
  }): Promise<{ result: 'accepted' | 'duplicate'; evidenceId: string }> {
    await uploadTus(input.intent, input.blob, input.onProgress)
    const device = await this.requireDevice()
    return invokeMumbai('capture-finalize', {
      mutationId: input.mutationId,
      schoolId: device.schoolId,
      deviceId: device.deviceId,
      leaseToken: device.leaseToken,
      captureIntentId: input.intent.captureIntentId,
      objectPath: input.intent.objectPath,
      byteLength: input.blob.size,
      mimeType: input.blob.type,
      sha256: input.sha256,
      startedAtClient: input.startedAtClient,
      endedAtClient: input.endedAtClient,
      markerMethod: input.markerMethod,
      markerValue: input.markerValue,
      expectedMarkerMatched: input.expectedMarkerMatched,
    })
  }

  async createPassBatch(
    schoolId: string,
    schoolDayId: string,
    sessionIds: string[],
  ): Promise<PassBatchResult> {
    return invokeMumbai<PassBatchResult>('admin-pass-batch-create', {
      schoolId,
      schoolDayId,
      sessionIds,
    })
  }

  async evidencePlaybackUrl(evidenceId: string): Promise<string> {
    const result = await invokeMumbai<{ signedUrl: string }>(
      'evidence-download',
      { evidenceId },
    )
    return result.signedUrl
  }

  async queueCapture(record: Omit<RecoveryEvidence, 'state'>): Promise<void> {
    await this.cache.saveRecoveryEvidence({ ...record, state: 'waiting' })
  }

  async flushQueuedCaptures(): Promise<void> {
    if (!navigator.onLine) return
    const records = await this.cache.recoveryEvidence()
    for (const record of records.filter(
      (item) => item.state === 'waiting' || item.state === 'sending',
    )) {
      await this.cache.saveRecoveryEvidence({ ...record, state: 'sending' })
      try {
        const intent = await this.beginCapture(
          record.taskId,
          true,
          record.startedAtClient,
        )
        await this.uploadAndFinalizeCapture({
          intent,
          blob: record.blob,
          mutationId: record.mutationId,
          sha256: record.sha256,
          startedAtClient: record.startedAtClient,
          endedAtClient: record.endedAtClient,
          markerMethod: record.markerMethod,
          markerValue: record.markerValue,
          expectedMarkerMatched: record.expectedMarkerMatched,
        })
        const uploadedAt = new Date().toISOString()
        await this.cache.saveRecoveryEvidence({
          ...record,
          state: 'sent',
          uploadedAt,
          deleteAfter: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        })
      } catch (cause) {
        await this.cache.saveRecoveryEvidence({
          ...record,
          state: 'needs_attention',
          lastError: cause instanceof Error ? cause.message : 'upload_failed',
        })
      }
    }
    await this.pruneRecoveryCopies()
  }

  async pruneRecoveryCopies(now = new Date()): Promise<void> {
    for (const record of await this.cache.recoveryEvidence()) {
      if (record.deleteAfter && new Date(record.deleteAfter) <= now) {
        await this.cache.deleteRecoveryEvidence(record.key)
      }
    }
  }

  private async requireDevice(): Promise<DeviceIdentity> {
    const device = await this.cache.getDevice()
    if (!device) throw new Error('device_pairing_required')
    return device
  }
}

async function uploadTus(
  intent: CaptureIntentResult,
  blob: Blob,
  onProgress?: (uploaded: number, total: number) => void,
): Promise<void> {
  const { url } = getPublicSupabaseConfig()
  const endpoint = `${url.replace('.supabase.co', '.storage.supabase.co')}/storage/v1/upload/resumable`
  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(blob, {
      endpoint,
      retryDelays: [0, 1_000, 3_000, 5_000, 10_000],
      headers: {
        'x-signature': intent.uploadToken,
        'x-upsert': 'false',
      },
      metadata: {
        bucketName: 'school-evidence',
        objectName: intent.uploadPath,
        contentType: blob.type,
        cacheControl: '3600',
      },
      uploadSize: blob.size,
      removeFingerprintOnSuccess: true,
      onProgress,
      onError: reject,
      onSuccess: () => resolve(),
    })
    void upload.findPreviousUploads().then((previous) => {
      if (previous[0]) upload.resumeFromPreviousUpload(previous[0])
      upload.start()
    }, reject)
  })
}

function capabilityKey(sessionId: string): string {
  return `schooltwin:participant:${sessionId}`
}
