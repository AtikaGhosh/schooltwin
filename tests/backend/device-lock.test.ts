import { beforeEach, describe, expect, it } from 'vitest'

import {
  configureLocalPin,
  localPinLockRemaining,
  verifyLocalPin,
} from '@/lib/schooltwin/backend/device-lock'

describe('local device unlock', () => {
  beforeEach(() => localStorage.clear())

  it('stores only a salted digest and accepts the configured six-digit PIN', async () => {
    await configureLocalPin('123456')
    expect(JSON.stringify(localStorage)).not.toContain('123456')
    await expect(verifyLocalPin('123456', 1_000)).resolves.toBe(true)
  })

  it('locks for fifteen minutes after five failed attempts', async () => {
    await configureLocalPin('123456')
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await verifyLocalPin('000000', 1_000)
    }
    expect(localPinLockRemaining(1_000)).toBe(15 * 60 * 1_000)
    await expect(verifyLocalPin('123456', 1_001)).rejects.toThrow(
      'device_unlock_temporarily_locked',
    )
  })

  it('rejects non-six-digit configuration', async () => {
    await expect(configureLocalPin('12345')).rejects.toThrow(
      'device_pin_must_have_six_digits',
    )
  })
})
