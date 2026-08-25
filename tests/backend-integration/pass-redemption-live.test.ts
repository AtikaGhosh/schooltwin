import { describe, expect, it } from 'vitest'

const live = {
  url: process.env.SCHOOLTWIN_LIVE_SUPABASE_URL,
  key: process.env.SCHOOLTWIN_LIVE_SUPABASE_PUBLISHABLE_KEY,
  sessionId: process.env.SCHOOLTWIN_LIVE_REDEMPTION_SESSION_ID,
  deviceId: process.env.SCHOOLTWIN_LIVE_REDEMPTION_DEVICE_ID,
  code: process.env.SCHOOLTWIN_LIVE_REDEMPTION_CODE,
}
const enabled = Object.values(live).every(Boolean)

describe.skipIf(!enabled)('live participant redemption concurrency', () => {
  it('accepts exactly one of 20 simultaneous redemptions', async () => {
    const responses = await Promise.all(
      Array.from({ length: 20 }, () =>
        fetch(`${live.url}/functions/v1/participant-redeem`, {
          method: 'POST',
          headers: {
            apikey: live.key!,
            'content-type': 'application/json',
            'x-schooltwin-client': 'concurrency-test',
          },
          body: JSON.stringify({
            sessionId: live.sessionId,
            deviceId: live.deviceId,
            code: live.code,
          }),
        }),
      ),
    )

    expect(responses.filter((response) => response.ok)).toHaveLength(1)
    expect(responses.filter((response) => !response.ok)).toHaveLength(19)
  })
})
