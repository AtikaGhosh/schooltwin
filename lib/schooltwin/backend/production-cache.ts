'use client'

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

import type { UiLocale } from '../i18n'
import { PRODUCTION_CACHE_DB_NAME } from './config'
import type {
  ClientMutation,
  DeviceIdentity,
  SyncPullResult,
} from './contracts'

interface ProductionMetadata {
  key: 'device' | 'cursor' | 'locale' | 'appearance'
  value: DeviceIdentity | string | { locale: UiLocale }
}

interface QueuedMutation extends ClientMutation {
  state: 'saved' | 'sending' | 'needs_attention'
  lastError?: string
}

export interface RecoveryEvidence {
  key: string
  taskId: string
  blob: Blob
  sha256: string
  startedAtClient: string
  endedAtClient: string
  markerMethod: string
  markerValue?: string
  expectedMarkerMatched: boolean
  mutationId: string
  state: 'waiting' | 'sending' | 'sent' | 'needs_attention'
  lastError?: string
  uploadedAt?: string
  deleteAfter?: string
}

interface ProductionCacheDb extends DBSchema {
  metadata: { key: string; value: ProductionMetadata }
  snapshot: { key: string; value: { key: 'latest'; value: SyncPullResult } }
  outbox: {
    key: string
    value: QueuedMutation
    indexes: { by_state: string }
  }
  recovery_evidence: {
    key: string
    value: RecoveryEvidence
    indexes: { by_task: string }
  }
}

export class ProductionCache {
  private db: Promise<IDBPDatabase<ProductionCacheDb>> | null = null

  private connection(): Promise<IDBPDatabase<ProductionCacheDb>> {
    if (!this.db) {
      this.db = openDB<ProductionCacheDb>(PRODUCTION_CACHE_DB_NAME, 1, {
        upgrade(database) {
          database.createObjectStore('metadata', { keyPath: 'key' })
          database.createObjectStore('snapshot', { keyPath: 'key' })
          const outbox = database.createObjectStore('outbox', { keyPath: 'id' })
          outbox.createIndex('by_state', 'state')
          const evidence = database.createObjectStore('recovery_evidence', {
            keyPath: 'key',
          })
          evidence.createIndex('by_task', 'taskId')
        },
      })
    }
    return this.db
  }

  async getDevice(): Promise<DeviceIdentity | null> {
    const record = await (await this.connection()).get('metadata', 'device')
    return record?.key === 'device' ? (record.value as DeviceIdentity) : null
  }

  async saveDevice(device: DeviceIdentity): Promise<void> {
    await (
      await this.connection()
    ).put('metadata', {
      key: 'device',
      value: device,
    })
  }

  async clearDevice(): Promise<void> {
    await (await this.connection()).delete('metadata', 'device')
  }

  async getSnapshot(): Promise<SyncPullResult | null> {
    return (
      (await (await this.connection()).get('snapshot', 'latest'))?.value ?? null
    )
  }

  async saveSnapshot(value: SyncPullResult): Promise<void> {
    await (await this.connection()).put('snapshot', { key: 'latest', value })
  }

  async enqueue(mutation: ClientMutation): Promise<void> {
    await (
      await this.connection()
    ).add('outbox', {
      ...mutation,
      state: 'saved',
    })
  }

  async pendingMutations(): Promise<QueuedMutation[]> {
    const records = await (await this.connection()).getAll('outbox')
    return records.filter((record) => record.state !== 'needs_attention')
  }

  async markSending(ids: string[]): Promise<void> {
    const database = await this.connection()
    const transaction = database.transaction('outbox', 'readwrite')
    for (const id of ids) {
      const record = await transaction.store.get(id)
      if (record) await transaction.store.put({ ...record, state: 'sending' })
    }
    await transaction.done
  }

  async resolveMutation(
    id: string,
    result: 'accepted' | 'duplicate' | 'rejected' | 'retry',
    error?: string,
  ): Promise<void> {
    const database = await this.connection()
    if (result === 'accepted' || result === 'duplicate') {
      await database.delete('outbox', id)
      return
    }
    const record = await database.get('outbox', id)
    if (record) {
      await database.put('outbox', {
        ...record,
        state: result === 'retry' ? 'saved' : 'needs_attention',
        lastError: error,
      })
    }
  }

  async saveRecoveryEvidence(record: RecoveryEvidence): Promise<void> {
    await (await this.connection()).put('recovery_evidence', record)
  }

  async deleteRecoveryEvidence(key: string): Promise<void> {
    await (await this.connection()).delete('recovery_evidence', key)
  }

  async recoveryEvidence(): Promise<RecoveryEvidence[]> {
    return (await this.connection()).getAll('recovery_evidence')
  }

  async clearOperationalData(): Promise<void> {
    const database = await this.connection()
    const transaction = database.transaction(
      ['snapshot', 'outbox', 'recovery_evidence'],
      'readwrite',
    )
    await Promise.all([
      transaction.objectStore('snapshot').clear(),
      transaction.objectStore('outbox').clear(),
      transaction.objectStore('recovery_evidence').clear(),
    ])
    await transaction.done
  }
}
