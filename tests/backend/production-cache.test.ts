import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it } from 'vitest'

import {
  PRODUCTION_CACHE_DB_NAME,
  PROTOTYPE_DB_NAME,
} from '@/lib/schooltwin/backend/config'
import { ProductionCache } from '@/lib/schooltwin/backend/production-cache'

describe('production cache isolation', () => {
  const cache = new ProductionCache()
  beforeEach(async () => {
    await cache.clearOperationalData()
    await cache.clearDevice()
  })

  it('uses a database that cannot collide with fictional demo data', () => {
    expect(PRODUCTION_CACHE_DB_NAME).toBe('schooltwin-production-cache')
    expect(PROTOTYPE_DB_NAME).toBe('schooltwin-prototype')
    expect(PRODUCTION_CACHE_DB_NAME).not.toBe(PROTOTYPE_DB_NAME)
  })

  it('stores paired-device credentials and idempotent outbox mutations', async () => {
    await cache.saveDevice({
      schoolId: 'school-1',
      deviceId: 'device-1',
      leaseToken: 'secret-token',
      leaseExpiresAt: '2026-08-26T00:00:00.000Z',
    })
    await cache.enqueue({
      id: '11111111-1111-4111-8111-111111111111',
      type: 'operator_report_submit',
      occurredAtClient: '2026-08-25T10:00:00.000Z',
      payload: { category: 'water', description: 'Tap is not working' },
    })

    expect(await cache.getDevice()).toMatchObject({ deviceId: 'device-1' })
    expect(await cache.pendingMutations()).toHaveLength(1)
    await cache.resolveMutation(
      '11111111-1111-4111-8111-111111111111',
      'accepted',
    )
    expect(await cache.pendingMutations()).toHaveLength(0)
  })

  it('keeps a sent upload recovery copy with its seven-day deletion date', async () => {
    await cache.saveRecoveryEvidence({
      key: 'capture-1',
      taskId: 'task-1',
      blob: new Blob(['video'], { type: 'video/webm' }),
      sha256: 'a'.repeat(64),
      startedAtClient: '2026-08-25T10:00:00.000Z',
      endedAtClient: '2026-08-25T10:00:10.000Z',
      markerMethod: 'barcode_detector',
      expectedMarkerMatched: true,
      mutationId: '22222222-2222-4222-8222-222222222222',
      state: 'sent',
      uploadedAt: '2026-08-25T10:01:00.000Z',
      deleteAfter: '2026-09-01T10:01:00.000Z',
    })
    expect(await cache.recoveryEvidence()).toEqual([
      expect.objectContaining({ state: 'sent', taskId: 'task-1' }),
    ])
  })
})
