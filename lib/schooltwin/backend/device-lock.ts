'use client'

const FAILED_ATTEMPTS_KEY = 'schooltwin:unlock:failures'
const LOCKED_UNTIL_KEY = 'schooltwin:unlock:locked-until'
const PIN_HASH_KEY = 'schooltwin:unlock:pin-hash'
const PIN_SALT_KEY = 'schooltwin:unlock:pin-salt'
const MAX_ATTEMPTS = 5
const LOCK_MS = 15 * 60 * 1000

export async function configureLocalPin(pin: string): Promise<void> {
  assertPin(pin)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  localStorage.setItem(PIN_SALT_KEY, bytesToHex(salt))
  localStorage.setItem(PIN_HASH_KEY, await pinHash(pin, salt))
  clearPinFailures()
}

export async function verifyLocalPin(
  pin: string,
  now = Date.now(),
): Promise<boolean> {
  const lockedUntil = Number(localStorage.getItem(LOCKED_UNTIL_KEY) ?? 0)
  if (lockedUntil > now) throw new Error('device_unlock_temporarily_locked')

  const storedHash = localStorage.getItem(PIN_HASH_KEY)
  const saltHex = localStorage.getItem(PIN_SALT_KEY)
  if (!storedHash || !saltHex) throw new Error('device_pin_not_configured')

  const matches = constantTimeEqual(
    storedHash,
    await pinHash(pin, hexToBytes(saltHex)),
  )
  if (matches) {
    clearPinFailures()
    return true
  }

  const failures = Number(localStorage.getItem(FAILED_ATTEMPTS_KEY) ?? 0) + 1
  if (failures >= MAX_ATTEMPTS) {
    localStorage.setItem(LOCKED_UNTIL_KEY, String(now + LOCK_MS))
    localStorage.setItem(FAILED_ATTEMPTS_KEY, '0')
  } else {
    localStorage.setItem(FAILED_ATTEMPTS_KEY, String(failures))
  }
  return false
}

export function localPinLockRemaining(now = Date.now()): number {
  return Math.max(0, Number(localStorage.getItem(LOCKED_UNTIL_KEY) ?? 0) - now)
}

function clearPinFailures(): void {
  localStorage.removeItem(FAILED_ATTEMPTS_KEY)
  localStorage.removeItem(LOCKED_UNTIL_KEY)
}

function assertPin(pin: string): void {
  if (!/^\d{6}$/.test(pin)) throw new Error('device_pin_must_have_six_digits')
}

async function pinHash(pin: string, salt: Uint8Array): Promise<string> {
  const pinBytes = new TextEncoder().encode(pin)
  const input = new Uint8Array(salt.length + pinBytes.length)
  input.set(salt)
  input.set(pinBytes, salt.length)
  return bytesToHex(
    new Uint8Array(await crypto.subtle.digest('SHA-256', input)),
  )
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(value: string): Uint8Array {
  if (!/^[0-9a-f]{32}$/i.test(value)) throw new Error('invalid_device_pin_salt')
  return Uint8Array.from(value.match(/.{2}/g) ?? [], (part) =>
    Number.parseInt(part, 16),
  )
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return difference === 0
}
