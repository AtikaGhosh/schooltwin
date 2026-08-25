'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  CircleStop,
  Fingerprint,
  QrCode,
  RotateCcw,
} from 'lucide-react'

import {
  Card,
  ErrorState,
  LoadingState,
  PageHeader,
  PrototypeNotice,
} from '@/components/primitives'
import { useSchoolTwin } from '@/components/providers/schooltwin-provider'
import {
  BrowserCaptureService,
  BrowserMarkerScanner,
} from '@/lib/schooltwin/adapters/capture'
import { LocalChallengeGenerator } from '@/lib/schooltwin/adapters/challenge'
import {
  BrowserStorageQuotaService,
  CryptoIdGenerator,
  WebCryptoBlobHasher,
  WebCryptoEntropySource,
} from '@/lib/schooltwin/adapters/browser'
import type {
  CaptureRecording,
  MarkerScanResult,
} from '@/lib/schooltwin/adapters/interfaces'
import { SCHOOLTWIN_CONFIG } from '@/lib/schooltwin/domain/config'
import {
  deriveTaskStatus,
  transitionTask,
} from '@/lib/schooltwin/domain/task-state'
import type {
  CaptureArtifact,
  TaskChallenge,
  VerificationTask,
} from '@/lib/schooltwin/domain/types'
import { getSchoolTwinMode } from '@/lib/schooltwin/backend/config'
import type { CaptureIntentResult } from '@/lib/schooltwin/backend/contracts'
import { ProductionSchoolTwinService } from '@/lib/schooltwin/backend/production-service'

type CaptureStep =
  | 'loading'
  | 'compatibility'
  | 'preview'
  | 'recording'
  | 'review'
  | 'submitted'
  | 'queued'
  | 'error'

type CaptureFailureCode =
  | 'permission_denied'
  | 'camera_busy'
  | 'no_camera'
  | 'insecure_context'
  | 'other'

const captureService = new BrowserCaptureService()
const markerScanner = new BrowserMarkerScanner()
const quotaService = new BrowserStorageQuotaService()
const hasher = new WebCryptoBlobHasher()
const ids = new CryptoIdGenerator()
const challengeGenerator = new LocalChallengeGenerator(
  new WebCryptoEntropySource(),
)
const productionService = new ProductionSchoolTwinService()

export function CaptureView({ taskId }: { taskId: string }) {
  const { repository, clock, refresh, locale, t } = useSchoolTwin()
  const [task, setTask] = useState<VerificationTask | null>(null)
  const [challenge, setChallenge] = useState<TaskChallenge | null>(null)
  const [step, setStep] = useState<CaptureStep>('loading')
  const [message, setMessage] = useState('')
  const [failureCode, setFailureCode] = useState<CaptureFailureCode | null>(
    null,
  )
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [marker, setMarker] = useState<MarkerScanResult | null>(null)
  const [recording, setRecording] = useState<CaptureRecording | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [fingerprint, setFingerprint] = useState<string | null>(null)
  const [productionIntent, setProductionIntent] =
    useState<CaptureIntentResult | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const videoUrlRef = useRef<string | null>(null)

  const capabilities = useMemo(() => captureService.capabilities(), [])
  const draftBlobKey = `draft-${taskId}`
  const finalArtifactId = `capture-${taskId}`

  useEffect(() => {
    let active = true
    Promise.all([
      repository.getTask(taskId, clock.now()),
      repository.getChallenge(taskId),
      repository.getCaptureMetadata(finalArtifactId),
    ])
      .then(async ([loadedTask, storedChallenge, artifact]) => {
        if (!active) return
        setTask(loadedTask)
        setChallenge(storedChallenge)
        if (artifact) {
          const blob = await repository.getCaptureBlob(artifact.blobKey)
          if (!active) return
          if (blob) setVideoUrl(URL.createObjectURL(blob))
          setFingerprint(artifact.sha256)
          setStep('submitted')
          return
        }
        setStep('compatibility')
      })
      .catch((error: unknown) => {
        if (active) {
          setMessage(
            error instanceof Error
              ? error.message
              : 'The capture task could not be loaded.',
          )
          setStep('error')
        }
      })
    return () => {
      active = false
    }
  }, [clock, finalArtifactId, repository, taskId])

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream
  }, [stream, step])

  useEffect(() => {
    if (step !== 'recording') return
    const start = Date.now()
    const interval = window.setInterval(
      () => setElapsed(Math.floor((Date.now() - start) / 1000)),
      250,
    )
    const maximum = window.setTimeout(
      () => void stopRecording(),
      SCHOOLTWIN_CONFIG.maxCaptureDurationSeconds * 1_000,
    )
    return () => {
      window.clearInterval(interval)
      window.clearTimeout(maximum)
    }
    // stopRecording intentionally reads the current capture service singleton.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  useEffect(() => {
    videoUrlRef.current = videoUrl
  }, [videoUrl])

  useEffect(
    () => () => {
      captureService.dispose()
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current)
    },
    [],
  )

  const enterPreview = useCallback(async () => {
    if (!task) return
    captureService.dispose()
    setStream(null)
    setFailureCode(null)
    setMessage('')
    const status = deriveTaskStatus(task, clock.now())
    if (status !== 'available' && status !== 'in_progress') {
      setMessage('This task is not inside an allowed collection window.')
      setStep('error')
      return
    }
    try {
      const production = getSchoolTwinMode() === 'production'
      const intent =
        production && navigator.onLine
          ? await productionService.beginCapture(task.id)
          : null
      if (production && !intent && !challenge) {
        throw new Error(
          'A connection is needed before this video can start because its challenge is not on this device.',
        )
      }
      if (intent) setProductionIntent(intent)
      const issued = intent
        ? {
            id: intent.challenge.id,
            taskId: intent.challenge.taskId,
            displayCode: intent.challenge.displayCode,
            title: task.title,
            steps: intent.challenge.instructions,
            issuedAtLocal: intent.challenge.issuedAt,
            prototypeIssued: false,
          }
        : (challenge ?? challengeGenerator.generate(task, clock.now()))
      if (!challenge && !production) {
        await repository.saveChallenge(issued)
        await repository.appendAuditEvent({
          id: ids.create('audit'),
          schoolId: task.schoolId,
          type: 'challenge_issued',
          targetId: task.id,
          occurredAtLocal: clock.now().toISOString(),
          detail: 'A local prototype challenge was issued once for this task.',
        })
      }
      setChallenge(issued)
      const activeTask =
        task.status === 'scheduled'
          ? transitionTask(task, 'in_progress', clock.now())
          : task
      if (activeTask !== task) {
        await repository.saveTask(activeTask)
        await repository.appendAuditEvent({
          id: ids.create('audit'),
          schoolId: task.schoolId,
          type: 'task_started',
          targetId: task.id,
          occurredAtLocal: clock.now().toISOString(),
          detail: `${task.title} started inside its local task window.`,
        })
        setTask(activeTask)
      }
      const camera = await captureService.requestCamera()
      setStream(camera)
      setStep('preview')
    } catch (error: unknown) {
      setFailureCode(captureFailureCode(error))
      setMessage(captureErrorMessage(error))
      setStep('error')
    }
  }, [challenge, clock, repository, task])

  async function scanMarker() {
    if (!stream || !task) return
    const expected = task.areaId
      ? (await repository.getAreas()).find((area) => area.id === task.areaId)
          ?.markerValue
      : undefined
    if (!expected) {
      setMessage('This task does not have an expected operational marker.')
      return
    }
    setMessage('Scanning the expected marker…')
    try {
      const result = await markerScanner.scan(stream, expected)
      setMarker(result)
      setMessage(
        result.expectedMarkerMatched
          ? 'Expected classroom marker observed.'
          : 'A different marker was observed. Try again.',
      )
    } catch {
      setMessage(
        'Automatic scanning is unavailable. Use the clearly labelled demo confirmation if permitted.',
      )
    }
  }

  async function startRecording() {
    if (!stream || !marker?.expectedMarkerMatched) return
    try {
      setElapsed(0)
      await captureService.start(stream)
      setStep('recording')
      if (task)
        await repository.appendAuditEvent({
          id: ids.create('audit'),
          schoolId: task.schoolId,
          type: 'capture_started',
          targetId: task.id,
          occurredAtLocal: clock.now().toISOString(),
          detail: 'Continuous in-app recording started.',
        })
    } catch (error: unknown) {
      setMessage(captureErrorMessage(error))
      setStep('error')
    }
  }

  async function stopRecording() {
    try {
      const result = await captureService.stop()
      if (
        result.durationMs <
        SCHOOLTWIN_CONFIG.minCaptureDurationSeconds * 1_000
      ) {
        setMessage(
          `Record for at least ${SCHOOLTWIN_CONFIG.minCaptureDurationSeconds} seconds.`,
        )
        setStep('preview')
        return
      }
      if (result.blob.size > SCHOOLTWIN_CONFIG.maxCaptureBytes) {
        setMessage(
          'This recording exceeds the local prototype capture-size limit. Retake a shorter recording.',
        )
        setStep('preview')
        return
      }
      await repository.saveCaptureBlob(draftBlobKey, result.blob)
      if (task) {
        await repository.appendAuditEvent({
          id: ids.create('audit'),
          schoolId: task.schoolId,
          type: 'capture_completed',
          targetId: task.id,
          occurredAtLocal: result.endedAtLocal,
          detail: 'Continuous in-app recording completed.',
        })
      }
      setRecording(result)
      setVideoUrl(URL.createObjectURL(result.blob))
      setStep('review')
    } catch (error: unknown) {
      setMessage(captureErrorMessage(error))
      setStep('error')
    }
  }

  async function retake() {
    await repository.deleteCaptureBlob(draftBlobKey)
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    setVideoUrl(null)
    setRecording(null)
    setMarker(null)
    setMessage('The superseded local recording was removed.')
    setStep('preview')
  }

  async function submit() {
    if (!task || !challenge || !recording || !marker) return
    try {
      const now = clock.now()
      const quota = await quotaService.estimate()
      if (
        quota.availableBytes !== null &&
        quota.availableBytes < recording.blob.size
      )
        throw new Error('storage_failure')
      const existingBytes = (await repository.getCaptureArtifacts()).reduce(
        (total, artifact) => total + artifact.byteLength,
        0,
      )
      if (
        existingBytes + recording.blob.size >
        SCHOOLTWIN_CONFIG.maxLocalEvidenceBytes
      )
        throw new Error('storage_failure')
      const sha256 = await hasher.sha256(recording.blob)
      if (getSchoolTwinMode() === 'production') {
        const mutationId = crypto.randomUUID()
        if (!navigator.onLine) {
          await productionService.queueCapture({
            key: `recovery-${task.id}`,
            taskId: task.id,
            blob: recording.blob,
            sha256,
            startedAtClient: recording.startedAtLocal,
            endedAtClient: recording.endedAtLocal,
            markerMethod: marker.method,
            markerValue: marker.value,
            expectedMarkerMatched: marker.expectedMarkerMatched,
            mutationId,
          })
          await repository.deleteCaptureBlob(draftBlobKey)
          setFingerprint(sha256)
          setStep('queued')
          setMessage(
            'Saved on this device. Waiting for a connection before it can be sent.',
          )
          return
        }
        const intent =
          productionIntent ?? (await productionService.beginCapture(task.id))
        setMessage('Sending video…')
        await productionService.uploadAndFinalizeCapture({
          intent,
          blob: recording.blob,
          mutationId,
          sha256,
          startedAtClient: recording.startedAtLocal,
          endedAtClient: recording.endedAtLocal,
          markerMethod: marker.method,
          markerValue: marker.value,
          expectedMarkerMatched: marker.expectedMarkerMatched,
          onProgress: (uploaded, total) =>
            setMessage(
              `Sending video… ${Math.round((uploaded / total) * 100)}%`,
            ),
        })
        const completedTask = {
          ...task,
          status: 'submitted' as const,
          completedAtLocal: now.toISOString(),
        }
        await repository.deleteCaptureBlob(draftBlobKey)
        setFingerprint(sha256)
        setTask(completedTask)
        setStep('submitted')
        setMessage('Sent and accepted by SchoolTwin.')
        captureService.dispose()
        refresh()
        return
      }
      const completedTask = transitionTask(task, 'submitted', now)
      const blobKey = `evidence-${task.id}`
      const artifact: CaptureArtifact = {
        id: finalArtifactId,
        schoolId: task.schoolId,
        taskId: task.id,
        challengeId: challenge.id,
        areaId: task.areaId,
        sectionId: task.sectionId,
        startedAtLocal: recording.startedAtLocal,
        endedAtLocal: recording.endedAtLocal,
        durationMs: recording.durationMs,
        markerMethod: marker.method,
        markerValue: marker.value,
        expectedMarkerMatched: marker.expectedMarkerMatched,
        sha256,
        mimeType: recording.mimeType,
        byteLength: recording.blob.size,
        blobKey,
      }
      await repository.saveCaptureBlob(blobKey, recording.blob)
      await repository.saveCaptureMetadata(artifact)
      await repository.saveSubmission({
        id: ids.create('submission'),
        schoolId: task.schoolId,
        taskId: task.id,
        sourceRecordId: artifact.id,
        kind: 'live_evidence',
        title: task.title,
        status: 'submitted',
        visibility: 'operator',
        submittedAtLocal: now.toISOString(),
      })
      await repository.appendAuditEvent({
        id: ids.create('audit'),
        schoolId: task.schoolId,
        type: 'capture_submitted',
        targetId: task.id,
        occurredAtLocal: now.toISOString(),
        detail: 'Live Evidence was stored in this browser profile.',
      })
      await repository.saveTask(completedTask)
      await repository.deleteCaptureBlob(draftBlobKey)
      setFingerprint(sha256)
      setTask(completedTask)
      setStep('submitted')
      captureService.dispose()
      refresh()
    } catch (error: unknown) {
      setMessage(captureErrorMessage(error))
    }
  }

  if (step === 'loading') return <LoadingState label="Loading Live Evidence…" />
  if (!task) return <ErrorState message="The requested task does not exist." />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={locale === 'or' ? 'ଆଜିର କାମ' : "Today's work"}
        title={task.sectionId ? t('task.classVideo') : t('task.facilityVideo')}
        description={
          locale === 'or'
            ? 'ମାର୍କର ଦେଖାଇ ଗୋଟିଏ ଲଗାତାର ଭିଡିଓ କରନ୍ତୁ।'
            : 'Find the marker, position the camera, then record one continuous video.'
        }
      />

      {step !== 'submitted' && step !== 'error' ? (
        <CaptureProgress
          step={step}
          markerReady={Boolean(marker?.expectedMarkerMatched)}
          locale={locale}
        />
      ) : null}

      {step === 'compatibility' ? (
        <Card className="border-0 p-6 sm:p-7">
          <p className="text-primary text-sm font-bold">1</p>
          <h2 className="mt-1 text-lg font-semibold">
            {locale === 'or' ? 'କ୍ୟାମେରା ଆରମ୍ଭ କରନ୍ତୁ' : 'Start the camera'}
          </h2>
          <ul className="mt-4 space-y-2 text-sm">
            <Capability
              ok={capabilities.secureContext}
              text="HTTPS deployment or localhost"
            />
            <Capability ok={capabilities.camera} text="Camera API available" />
            <Capability
              ok={
                capabilities.mediaRecorder &&
                Boolean(capabilities.supportedMimeType)
              }
              text="Continuous recording supported"
            />
          </ul>
          {capabilities.secureContext &&
          capabilities.camera &&
          capabilities.supportedMimeType ? (
            <button
              onClick={() => void enterPreview()}
              className="primary-action mt-6 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold"
            >
              <Camera className="size-4" />{' '}
              {locale === 'or' ? 'କ୍ୟାମେରା ଖୋଲନ୍ତୁ' : 'Start camera'}
            </button>
          ) : (
            <p
              role="alert"
              className="bg-destructive/5 text-destructive mt-5 rounded-lg p-4 text-sm"
            >
              Use the latest Chrome/Chromium on HTTPS or localhost with camera
              permission enabled.
            </p>
          )}
        </Card>
      ) : null}

      {challenge && step !== 'submitted' ? (
        <ChallengeCard challenge={challenge} />
      ) : null}

      {step === 'preview' || step === 'recording' ? (
        <Card className="overflow-hidden border-0">
          <div
            className={`camera-stage relative aspect-video bg-slate-950 ${marker?.expectedMarkerMatched ? 'marker-found' : 'marker-seeking'}`}
          >
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="camera-preview-enter h-full w-full object-cover"
            />
            {step === 'recording' ? (
              <div
                role="status"
                className="recording-indicator absolute top-3 left-3 z-10 flex items-center rounded-full bg-red-700/90 px-3 py-1.5 text-xs font-semibold text-white shadow-sm backdrop-blur-sm"
              >
                Recording continuously · {elapsed}s
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3 p-4">
            {step === 'preview' && marker?.expectedMarkerMatched ? (
              <p className="w-full pb-1 text-sm font-medium">
                {locale === 'or'
                  ? 'କ୍ୟାମେରାକୁ ସ୍ଥିର ରଖନ୍ତୁ ଏବଂ ସମ୍ପୂର୍ଣ୍ଣ ଶ୍ରେଣୀ ଦେଖାନ୍ତୁ।'
                  : 'Position the camera, then move slowly across the full classroom.'}
              </p>
            ) : null}
            {step === 'preview' && !marker?.expectedMarkerMatched ? (
              <button
                onClick={() => void scanMarker()}
                className="choice-control border-border inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold"
              >
                <QrCode className="size-4" />{' '}
                {locale === 'or' ? 'ମାର୍କର ଖୋଜନ୍ତୁ' : 'Find marker'}
              </button>
            ) : null}
            {step === 'preview' &&
            SCHOOLTWIN_CONFIG.allowDemoMarkerFallback &&
            !marker?.expectedMarkerMatched ? (
              <button
                onClick={() =>
                  setMarker({
                    method: 'demo_confirmation',
                    value: task.areaId,
                    expectedMarkerMatched: true,
                  })
                }
                className="choice-control border-primary text-primary rounded-lg border border-dashed px-4 py-2 text-sm font-semibold"
              >
                Demo marker confirmation
              </button>
            ) : null}
            {step === 'preview' && marker?.expectedMarkerMatched ? (
              <button
                onClick={() => void startRecording()}
                className="primary-action inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold"
              >
                <Camera className="size-4" />{' '}
                {locale === 'or' ? 'ଲଗାତାର ଭିଡିଓ ଆରମ୍ଭ କରନ୍ତୁ' : 'Record now'}
              </button>
            ) : null}
            {step === 'recording' ? (
              <button
                disabled={elapsed < SCHOOLTWIN_CONFIG.minCaptureDurationSeconds}
                onClick={() => void stopRecording()}
                className="bg-destructive inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                <CircleStop className="size-4" /> Stop recording
              </button>
            ) : null}
            <span className="text-muted-foreground text-xs">
              10–60 seconds · no pause control
            </span>
          </div>
        </Card>
      ) : null}

      {step === 'review' && recording && videoUrl ? (
        <Card className="wizard-stage elevated-surface overflow-hidden border-0">
          <div className="px-5 pt-5">
            <p className="text-lg font-semibold">
              {locale === 'or' ? 'ଭିଡିଓଟି ଦେଖନ୍ତୁ' : 'Review your video'}
            </p>
          </div>
          <video
            controls
            src={videoUrl}
            className="aspect-video w-full bg-black"
          />
          <div className="flex flex-wrap gap-3 p-4">
            <button
              onClick={() => void retake()}
              className="choice-control border-border inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold"
            >
              <RotateCcw className="size-4" />{' '}
              {locale === 'or' ? 'ପୁଣି ଭିଡିଓ କରନ୍ତୁ' : 'Record again'}
            </button>
            <button
              onClick={() => void submit()}
              className="primary-action rounded-lg px-4 py-2 text-sm font-semibold"
            >
              {t('common.submit')}
            </button>
          </div>
        </Card>
      ) : null}

      {step === 'submitted' ? (
        <Card className="wizard-stage p-6">
          <CheckCircle2 className="success-enter text-stable size-8" />
          <h2 className="mt-3 text-lg font-semibold">
            {locale === 'or' ? 'ଭିଡିଓ ଦାଖଲ ହୋଇଛି' : 'Video submitted'}
          </h2>
          {videoUrl ? (
            <video
              controls
              src={videoUrl}
              className="mt-5 aspect-video w-full max-w-2xl rounded-lg bg-black"
            />
          ) : null}
          <details className="border-border mt-5 rounded-lg border p-3">
            <summary className="min-h-10 cursor-pointer py-2 text-sm font-semibold">
              Technical details
            </summary>
            <div className="mt-3 grid gap-2 text-sm">
              <p>Recorded continuously in this SchoolTwin session.</p>
              <p>Expected classroom marker observed.</p>
              <p>Local capture timestamp recorded.</p>
              <p>Evidence fingerprint generated.</p>
            </div>
            {fingerprint ? (
              <p className="bg-muted mt-4 rounded-lg p-3 font-mono text-xs break-all">
                <Fingerprint className="mr-2 inline size-4" />
                {fingerprint}
              </p>
            ) : null}
          </details>
          <Link
            href="/tasks"
            className="primary-action mt-5 inline-flex min-h-12 items-center rounded-lg px-5 text-sm font-semibold"
          >
            {locale === 'or' ? 'ଆଜିର କାମକୁ ଫେରନ୍ତୁ' : 'Back to Today’s Work'}
          </Link>
        </Card>
      ) : null}
      {step === 'queued' ? (
        <Card className="wizard-stage p-6">
          <CheckCircle2 className="text-primary size-8" />
          <h2 className="mt-3 text-lg font-semibold">Saved on this device</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            The video is waiting to send. It is not submitted until the server
            accepts it.
          </p>
          <Link
            href="/tasks"
            className="primary-action mt-5 inline-flex min-h-12 items-center rounded-lg px-5 text-sm font-semibold"
          >
            Back to Today’s Work
          </Link>
        </Card>
      ) : null}

      {message && step !== 'error' ? (
        <p
          role="status"
          className="border-border bg-card rounded-lg border px-4 py-3 text-sm"
        >
          {message}
        </p>
      ) : null}
      {step === 'error' ? (
        <Card className="p-6">
          <AlertTriangle className="text-destructive size-7" />
          <h2 className="mt-3 font-semibold">Capture cannot continue</h2>
          <p className="text-muted-foreground mt-1 text-sm">{message}</p>
          {failureCode === 'permission_denied' ? (
            <div className="mt-5 space-y-5">
              <div className="bg-muted/60 rounded-lg p-4 text-sm">
                <p className="font-semibold">
                  {locale === 'or'
                    ? 'କ୍ୟାମେରା ଚାଲୁ କରିବା ପାଇଁ'
                    : 'To allow the camera'}
                </p>
                <ol className="text-muted-foreground mt-2 list-decimal space-y-1.5 pl-5">
                  <li>
                    {locale === 'or'
                      ? 'ଏହି ପୃଷ୍ଠାକୁ VS Code preview ବଦଳରେ Chrome କିମ୍ବା Edge ରେ ଖୋଲନ୍ତୁ।'
                      : 'Open this page in Chrome or Edge, not the VS Code preview browser.'}
                  </li>
                  <li>
                    {locale === 'or'
                      ? 'ଠିକଣା ପାଖରେ ଥିବା site/camera ଚିହ୍ନ ଦବାଇ Camera କୁ Allow କରନ୍ତୁ।'
                      : 'Click the site or camera icon beside the address and set Camera to Allow.'}
                  </li>
                  <li>
                    {locale === 'or'
                      ? 'ତାପରେ ତଳେ ଥିବା ବଟନ୍ ଦବାନ୍ତୁ।'
                      : 'Then use the button below to ask for the camera again.'}
                  </li>
                </ol>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void enterPreview()}
                  className="primary-action inline-flex min-h-12 items-center gap-2 rounded-lg px-5 text-sm font-semibold"
                >
                  <RotateCcw className="size-4" />
                  {locale === 'or'
                    ? 'କ୍ୟାମେରା ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ'
                    : 'Try camera again'}
                </button>
                <Link
                  href={`/tasks/${taskId}`}
                  className="choice-control border-border inline-flex min-h-12 items-center rounded-lg border px-5 text-sm font-semibold"
                >
                  {locale === 'or' ? 'କାମକୁ ଫେରନ୍ତୁ' : 'Return to task'}
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-5 flex flex-wrap gap-3">
              {failureCode === 'camera_busy' ? (
                <button
                  type="button"
                  onClick={() => void enterPreview()}
                  className="primary-action inline-flex min-h-12 items-center gap-2 rounded-lg px-5 text-sm font-semibold"
                >
                  <RotateCcw className="size-4" /> Try camera again
                </button>
              ) : null}
              <Link
                href={`/tasks/${taskId}`}
                className="text-primary inline-flex min-h-12 items-center text-sm font-semibold hover:underline"
              >
                Return to task
              </Link>
            </div>
          )}
        </Card>
      ) : null}
      {step === 'submitted' || step === 'queued' ? null : (
        <PrototypeNotice>
          Use the camera in this app. There is no gallery upload or pause
          button.
        </PrototypeNotice>
      )}
    </div>
  )
}

function CaptureProgress({
  step,
  markerReady,
  locale,
}: {
  step: CaptureStep
  markerReady: boolean
  locale: 'en' | 'or'
}) {
  const current =
    step === 'recording' || step === 'review' ? 2 : markerReady ? 1 : 0
  const labels =
    locale === 'or'
      ? ['ମାର୍କର', 'ସ୍ଥିତି', 'ଭିଡିଓ']
      : ['Marker', 'Position', 'Record']
  return (
    <ol
      aria-label={locale === 'or' ? 'ଭିଡିଓ ପ୍ରଗତି' : 'Capture progress'}
      className="mx-auto flex max-w-xl items-center"
    >
      {labels.map((label, index) => (
        <li key={label} className="flex flex-1 items-center last:flex-none">
          <span
            className={`flex items-center gap-2 text-xs font-semibold ${index <= current ? 'text-primary' : 'text-muted-foreground'}`}
          >
            <span
              className={`flex size-7 items-center justify-center rounded-full ${index < current ? 'brand-mark text-primary-foreground' : index === current ? 'ring-primary bg-primary/10 ring-2' : 'bg-muted'}`}
            >
              {index < current ? '✓' : index + 1}
            </span>
            {label}
          </span>
          {index < labels.length - 1 ? (
            <span
              className={`mx-3 h-px flex-1 ${index < current ? 'gradient-progress' : 'bg-border'}`}
            />
          ) : null}
        </li>
      ))}
    </ol>
  )
}

function ChallengeCard({ challenge }: { challenge: TaskChallenge }) {
  return (
    <Card className="p-5">
      <p className="text-primary text-xs font-semibold tracking-wide uppercase">
        {challenge.prototypeIssued
          ? 'Prototype-issued challenge'
          : 'Server-issued task challenge'}
      </p>
      <p className="mt-2 font-mono text-xl font-semibold">
        {challenge.displayCode}
      </p>
      <ol className="text-muted-foreground mt-4 list-decimal space-y-1 pl-5 text-sm">
        {challenge.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </Card>
  )
}

function Capability({ ok, text }: { ok: boolean; text: string }) {
  return (
    <li className="flex items-center gap-2">
      {ok ? (
        <CheckCircle2 className="text-stable size-4" />
      ) : (
        <AlertTriangle className="text-destructive size-4" />
      )}{' '}
      {text}
    </li>
  )
}

function captureErrorMessage(error: unknown): string {
  const value = error instanceof Error ? error.message : ''
  if (value === 'insecure_context')
    return 'Camera capture requires HTTPS or localhost.'
  if (value === 'no_camera') return 'No usable camera was found.'
  if (value === 'storage_failure')
    return 'Local evidence storage is almost full. Use Demo Reset to clear prototype evidence.'
  if (error instanceof DOMException && error.name === 'NotAllowedError')
    return 'Camera permission was denied. Allow camera access in Chrome and try again.'
  if (error instanceof DOMException && error.name === 'NotReadableError')
    return 'The camera is busy in another application. Close it there and try again.'
  return value || 'The continuous recording could not be completed.'
}

function captureFailureCode(error: unknown): CaptureFailureCode {
  const value = error instanceof Error ? error.message : ''
  if (value === 'insecure_context') return 'insecure_context'
  if (value === 'no_camera') return 'no_camera'
  if (error instanceof DOMException && error.name === 'NotAllowedError')
    return 'permission_denied'
  if (error instanceof DOMException && error.name === 'NotReadableError')
    return 'camera_busy'
  return 'other'
}
