import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('Mumbai and resumable-upload contracts', () => {
  const browserClient = readFileSync(
    join(process.cwd(), 'lib/schooltwin/backend/browser-client.ts'),
    'utf8',
  )
  const productionService = readFileSync(
    join(process.cwd(), 'lib/schooltwin/backend/production-service.ts'),
    'utf8',
  )

  it('pins browser Edge Function calls to ap-south-1', () => {
    expect(browserClient).toContain('FunctionRegion.ApSouth1')
  })

  it('uses TUS with signed upload tokens, retry, and no overwrite', () => {
    expect(productionService).toContain('/storage/v1/upload/resumable')
    expect(productionService).toContain("'x-signature': intent.uploadToken")
    expect(productionService).toContain("'x-upsert': 'false'")
    expect(productionService).toContain('findPreviousUploads')
  })

  it('never calls an offline participant fallback', () => {
    expect(productionService).not.toContain('localPass')
    expect(productionService).toContain("'participant-redeem'")
  })
})
