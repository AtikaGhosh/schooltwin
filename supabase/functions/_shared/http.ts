export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message = code,
  ) {
    super(message)
  }
}

export function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('origin') ?? ''
  const allowed = (
    Deno.env.get('ALLOWED_ORIGINS') ??
    'http://127.0.0.1:3000,http://localhost:3000'
  )
    .split(',')
    .map((value) => value.trim())
  return {
    'access-control-allow-origin': allowed.includes(origin)
      ? origin
      : allowed[0],
    'access-control-allow-headers':
      'authorization, apikey, content-type, x-client-info, x-device-token, x-schooltwin-cron-secret',
    'access-control-allow-methods': 'POST, OPTIONS',
    'cache-control': 'no-store',
    vary: 'Origin',
    'x-schooltwin-region': Deno.env.get('SB_REGION') ?? 'unknown',
  }
}

export function json(request: Request, body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders(request) })
}

export async function bodyJson<T extends Record<string, unknown>>(
  request: Request,
): Promise<T> {
  const maximumBytes = 256 * 1024
  const declaredLength = Number(request.headers.get('content-length') ?? 0)
  if (declaredLength > maximumBytes)
    throw new HttpError(413, 'request_too_large')
  try {
    const text = await request.text()
    if (new TextEncoder().encode(text).byteLength > maximumBytes) {
      throw new HttpError(413, 'request_too_large')
    }
    return JSON.parse(text) as T
  } catch (cause) {
    if (cause instanceof HttpError) throw cause
    throw new HttpError(400, 'invalid_json')
  }
}

export function requireString(
  body: Record<string, unknown>,
  key: string,
): string {
  const value = body[key]
  if (typeof value !== 'string' || value.length === 0)
    throw new HttpError(400, `missing_${key}`)
  return value
}

export function mapError(error: unknown): HttpError {
  if (error instanceof HttpError) return error
  const message = error instanceof Error ? error.message : String(error)
  const safeCode = message.match(
    /(not_authorized|invalid_[a-z_]+|[a-z_]+_expired|[a-z_]+_unavailable|already_submitted|redemption_locked|sensitive_content_prohibited|grant_used_or_revoked)/,
  )?.[1]
  return new HttpError(
    safeCode === 'not_authorized' ? 403 : 400,
    safeCode ?? 'backend_request_failed',
  )
}
