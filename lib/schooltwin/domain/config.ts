export const SCHOOLTWIN_CONFIG = {
  taskCompletionGraceMs: 2 * 60 * 1000,
  minCaptureDurationSeconds: 10,
  maxCaptureDurationSeconds: 60,
  maxCaptureBytes: 30 * 1024 * 1024,
  maxLocalEvidenceBytes: 150 * 1024 * 1024,
  allowDemoMarkerFallback: true,
} as const
