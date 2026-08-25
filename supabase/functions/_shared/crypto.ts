const encoder = new TextEncoder()
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export function normalizeHumanCode(value: string): string {
  return value.toUpperCase().replace(/[^0-9A-Z]/g, '')
}

export async function hmacHex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value))
  return toHex(new Uint8Array(signature))
}

export async function sha256Hex(value: string | ArrayBuffer): Promise<string> {
  const data = typeof value === 'string' ? encoder.encode(value) : value
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', data)))
}

export function randomToken(bytes = 32): string {
  const value = crypto.getRandomValues(new Uint8Array(bytes))
  return btoa(String.fromCharCode(...value))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}

export async function signedWorkLease(
  payload: Record<string, unknown>,
): Promise<string> {
  const encoded = bytesToBase64Url(encoder.encode(JSON.stringify(payload)))
  const signature = await hmacHex(requiredSecret('WORK_LEASE_SECRET'), encoded)
  return `${encoded}.${signature}`
}

export function generateHumanCode(length = 12): string {
  const random = crypto.getRandomValues(new Uint8Array(length))
  const raw = Array.from(
    random,
    (value) => CROCKFORD[value % CROCKFORD.length],
  ).join('')
  return raw.match(/.{1,4}/g)?.join('-') ?? raw
}

function toHex(value: Uint8Array): string {
  return Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  )
}

function requiredSecret(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`missing_${name.toLowerCase()}`)
  return value
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}
