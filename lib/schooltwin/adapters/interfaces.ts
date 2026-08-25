import type {
  CaptureArtifact,
  MarkerMethod,
  TaskChallenge,
  VerificationTask,
} from '../domain/types'

export interface Clock {
  now(): Date
}

export interface IdGenerator {
  create(prefix: string): string
}

export interface EntropySource {
  bytes(length: number): Uint8Array
}

export interface ChallengeGenerator {
  generate(task: VerificationTask, now: Date): TaskChallenge
}

export interface TaskIssuer {
  issue(now: Date): Promise<VerificationTask[]>
}

export interface BlobHasher {
  sha256(blob: Blob): Promise<string>
}

export interface StorageQuotaSnapshot {
  quotaBytes: number | null
  usageBytes: number | null
  availableBytes: number | null
  persistenceGranted: boolean | null
}

export interface StorageQuotaService {
  estimate(): Promise<StorageQuotaSnapshot>
  requestPersistence(): Promise<boolean | null>
}

export interface CaptureCapabilities {
  secureContext: boolean
  camera: boolean
  mediaRecorder: boolean
  supportedMimeType: string | null
}

export interface CaptureRecording {
  blob: Blob
  startedAtLocal: string
  endedAtLocal: string
  durationMs: number
  mimeType: string
}

export interface CaptureService {
  capabilities(): CaptureCapabilities
  requestCamera(): Promise<MediaStream>
  start(stream: MediaStream): Promise<void>
  stop(): Promise<CaptureRecording>
  dispose(): void
}

export interface MarkerScanResult {
  method: MarkerMethod
  value?: string
  expectedMarkerMatched: boolean
}

export interface MarkerScanner {
  scan(stream: MediaStream, expectedValue: string): Promise<MarkerScanResult>
}

export interface CaptureSubmissionInput {
  artifact: CaptureArtifact
  blob: Blob
}
