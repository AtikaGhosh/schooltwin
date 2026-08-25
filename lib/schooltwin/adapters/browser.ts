import type {
  BlobHasher,
  Clock,
  EntropySource,
  IdGenerator,
  StorageQuotaService,
  StorageQuotaSnapshot,
} from './interfaces'

export class SystemClock implements Clock {
  now(): Date {
    return new Date()
  }
}

export class CryptoIdGenerator implements IdGenerator {
  create(prefix: string): string {
    return `${prefix}-${crypto.randomUUID()}`
  }
}

export class WebCryptoEntropySource implements EntropySource {
  bytes(length: number): Uint8Array {
    const output = new Uint8Array(length)
    crypto.getRandomValues(output)
    return output
  }
}

export class WebCryptoBlobHasher implements BlobHasher {
  async sha256(blob: Blob): Promise<string> {
    const digest = await crypto.subtle.digest(
      'SHA-256',
      await blob.arrayBuffer(),
    )
    return toHex(new Uint8Array(digest))
  }
}

export async function sha256Text(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value.trim().toUpperCase())
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return toHex(new Uint8Array(digest))
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  )
}

export class BrowserStorageQuotaService implements StorageQuotaService {
  async estimate(): Promise<StorageQuotaSnapshot> {
    if (!navigator.storage?.estimate) {
      return {
        quotaBytes: null,
        usageBytes: null,
        availableBytes: null,
        persistenceGranted: null,
      }
    }

    const estimate = await navigator.storage.estimate()
    const quotaBytes = estimate.quota ?? null
    const usageBytes = estimate.usage ?? null
    const persistenceGranted = navigator.storage.persisted
      ? await navigator.storage.persisted()
      : null

    return {
      quotaBytes,
      usageBytes,
      availableBytes:
        quotaBytes === null || usageBytes === null
          ? null
          : Math.max(0, quotaBytes - usageBytes),
      persistenceGranted,
    }
  }

  async requestPersistence(): Promise<boolean | null> {
    if (!navigator.storage?.persist) return null
    return navigator.storage.persist()
  }
}
