import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  BrowserCaptureService,
  selectSupportedMimeType,
} from '@/lib/schooltwin/adapters/capture'

describe('capture capability detection', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('selects the first supported recording codec', () => {
    vi.stubGlobal('MediaRecorder', {
      isTypeSupported: (value: string) => value.includes('vp8'),
    })
    expect(selectSupportedMimeType()).toBe('video/webm;codecs=vp8')
  })

  it('reports unavailable APIs without claiming compatibility', () => {
    vi.stubGlobal('MediaRecorder', undefined)
    const service = new BrowserCaptureService()
    expect(service.capabilities().mediaRecorder).toBe(false)
    expect(service.capabilities().supportedMimeType).toBeNull()
  })

  it('requests video without requiring microphone permission', async () => {
    const stream = {} as MediaStream
    const getUserMedia = vi.fn().mockResolvedValue(stream)
    vi.stubGlobal('isSecureContext', true)
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia },
    })

    const service = new BrowserCaptureService()
    await expect(service.requestCamera()).resolves.toBe(stream)
    expect(getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    })
  })
})
