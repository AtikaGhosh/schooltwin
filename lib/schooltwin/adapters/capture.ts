import { BrowserQRCodeReader } from '@zxing/browser'

import type {
  CaptureCapabilities,
  CaptureRecording,
  CaptureService,
  MarkerScanner,
  MarkerScanResult,
} from './interfaces'

interface DetectedBarcode {
  rawValue: string
}

interface BarcodeDetectorInstance {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>
}

type BarcodeDetectorConstructor = new (options: {
  formats: string[]
}) => BarcodeDetectorInstance

const MIME_CANDIDATES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
]

export class BrowserCaptureService implements CaptureService {
  private recorder: MediaRecorder | null = null
  private stream: MediaStream | null = null
  private chunks: BlobPart[] = []
  private startedAt: Date | null = null

  capabilities(): CaptureCapabilities {
    const mediaRecorder = typeof MediaRecorder !== 'undefined'
    return {
      secureContext: globalThis.isSecureContext === true,
      camera: Boolean(navigator.mediaDevices?.getUserMedia),
      mediaRecorder,
      supportedMimeType: mediaRecorder ? selectSupportedMimeType() : null,
    }
  }

  async requestCamera(): Promise<MediaStream> {
    const capabilities = this.capabilities()
    if (!capabilities.secureContext) throw new Error('insecure_context')
    if (!capabilities.camera) throw new Error('no_camera')
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      // Live Evidence only requires video. Asking for microphone permission as
      // well makes the whole request fail when audio is blocked, even if the
      // camera itself is allowed.
      audio: false,
    })
    return this.stream
  }

  async start(stream: MediaStream): Promise<void> {
    const mimeType = selectSupportedMimeType()
    if (!mimeType) throw new Error('unsupported_browser')
    this.stream = stream
    this.chunks = []
    this.recorder = new MediaRecorder(stream, { mimeType })
    this.recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) this.chunks.push(event.data)
    })
    this.startedAt = new Date()
    this.recorder.start(500)
  }

  async stop(): Promise<CaptureRecording> {
    const recorder = this.recorder
    const startedAt = this.startedAt
    if (!recorder || !startedAt || recorder.state === 'inactive')
      throw new Error('recording_failure')

    return new Promise((resolve, reject) => {
      recorder.addEventListener(
        'error',
        () => reject(new Error('recording_failure')),
        { once: true },
      )
      recorder.addEventListener(
        'stop',
        () => {
          const endedAt = new Date()
          const mimeType = recorder.mimeType || 'video/webm'
          resolve({
            blob: new Blob(this.chunks, { type: mimeType }),
            startedAtLocal: startedAt.toISOString(),
            endedAtLocal: endedAt.toISOString(),
            durationMs: endedAt.getTime() - startedAt.getTime(),
            mimeType,
          })
        },
        { once: true },
      )
      recorder.stop()
    })
  }

  dispose(): void {
    if (this.recorder?.state === 'recording') this.recorder.stop()
    this.stream?.getTracks().forEach((track) => track.stop())
    this.recorder = null
    this.stream = null
  }
}

export class BrowserMarkerScanner implements MarkerScanner {
  async scan(
    stream: MediaStream,
    expectedValue: string,
  ): Promise<MarkerScanResult> {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.srcObject = stream
    await video.play()

    const BarcodeDetectorApi = (
      globalThis as typeof globalThis & {
        BarcodeDetector?: BarcodeDetectorConstructor
      }
    ).BarcodeDetector
    if (BarcodeDetectorApi) {
      try {
        const detector = new BarcodeDetectorApi({ formats: ['qr_code'] })
        const deadline = Date.now() + 3_000
        while (Date.now() < deadline) {
          const [result] = await detector.detect(video)
          if (result) {
            video.pause()
            video.srcObject = null
            return {
              method: 'barcode_detector',
              value: result.rawValue,
              expectedMarkerMatched: result.rawValue === expectedValue,
            }
          }
          await new Promise((resolve) => setTimeout(resolve, 150))
        }
      } catch {
        // Continue to the ZXing adapter when BarcodeDetector is unavailable at runtime.
      }
    }

    const reader = new BrowserQRCodeReader(undefined, {
      delayBetweenScanAttempts: 120,
    })
    try {
      const result = await Promise.race([
        reader.decodeOnceFromVideoElement(video),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('marker_unavailable')), 8_000),
        ),
      ])
      const value = result.getText()
      return {
        method: 'zxing',
        value,
        expectedMarkerMatched: value === expectedValue,
      }
    } finally {
      video.pause()
      video.srcObject = null
    }
  }
}

export function selectSupportedMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null
  return (
    MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ?? null
  )
}
