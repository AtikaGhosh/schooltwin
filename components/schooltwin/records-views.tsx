'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  Database,
  FileVideo,
  HardDrive,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  PrototypeNotice,
} from '@/components/primitives'
import { useSchoolTwin } from '@/components/providers/schooltwin-provider'
import { BrowserStorageQuotaService } from '@/lib/schooltwin/adapters/browser'
import { isProductionMode } from '@/lib/schooltwin/backend/config'
import type { OperatorSubmissionView } from '@/lib/schooltwin/domain/privacy'
import type { SchoolTwinRepository } from '@/lib/schooltwin/repository/types'
import type {
  CaptureArtifact,
  PrototypeStorageStatus,
} from '@/lib/schooltwin/domain/types'

const quotaService = new BrowserStorageQuotaService()
const productionMode = isProductionMode()

export function SubmissionsView() {
  const { repository, refresh, t, intlLocale } = useSchoolTwin()
  const router = useRouter()
  const [submissions, setSubmissions] = useState<
    OperatorSubmissionView[] | null
  >(null)
  const [captures, setCaptures] = useState<CaptureArtifact[]>([])
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({})
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([
      repository.getOperatorSubmissions(),
      repository.getCaptureArtifacts(),
    ])
      .then(async ([records, artifacts]) => {
        if (!active) return
        setSubmissions(records)
        setCaptures(artifacts)
        const pairs = await Promise.all(
          artifacts.map(
            async (artifact) =>
              [
                artifact.id,
                await repository.getCaptureBlob(artifact.blobKey),
              ] as const,
          ),
        )
        if (active)
          setVideoUrls(
            Object.fromEntries(
              pairs
                .filter(
                  (pair): pair is readonly [string, Blob] => pair[1] !== null,
                )
                .map(([id, blob]) => [id, URL.createObjectURL(blob)]),
            ),
          )
      })
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : 'Submission records could not be loaded.',
        ),
      )
    return () => {
      active = false
    }
  }, [repository])

  async function resetDemo() {
    if (
      !window.confirm(
        'Reset the DrishtiShala demo? All locally captured prototype evidence will be deleted.',
      )
    )
      return
    Object.values(videoUrls).forEach((url) => URL.revokeObjectURL(url))
    await repository.resetDemo()
    refresh()
    router.push('/home')
  }

  if (error) return <ErrorState message={error} />
  if (!submissions)
    return <LoadingState label="Loading permitted submissions…" />

  const groups = groupBySchoolDate(submissions)

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('history.title')}
        description="Completed school work that this account is allowed to see."
      />
      <Card className="overflow-hidden">
        {submissions.length ? (
          <div className="divide-border divide-y">
            {groups.map(([dateKey, records]) => (
              <section key={dateKey}>
                <h2 className="bg-muted/50 px-5 py-3 text-sm font-semibold">
                  {historyDayLabel(dateKey, intlLocale)}
                </h2>
                <div className="divide-border divide-y">
                  {records.map((submission) => {
                    const artifact = captures.find(
                      (item) => item.taskId === submission.taskId,
                    )
                    return (
                      <article key={submission.id} className="history-row p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h2 className="text-sm font-semibold">
                              {friendlySubmissionTitle(
                                submission,
                                localeLabel(intlLocale),
                              )}
                            </h2>
                            <p className="text-muted-foreground mt-1 text-xs">
                              {new Intl.DateTimeFormat(intlLocale, {
                                hour: 'numeric',
                                minute: '2-digit',
                                timeZone: 'Asia/Kolkata',
                              }).format(new Date(submission.submittedAtLocal))}
                            </p>
                          </div>
                          <span className="bg-stable/10 text-stable rounded-full px-2.5 py-1 text-xs font-semibold">
                            Submitted
                          </span>
                        </div>
                        {artifact && videoUrls[artifact.id] ? (
                          <details className="border-border bg-card/60 mt-4 rounded-lg border p-3">
                            <summary className="min-h-10 cursor-pointer py-2 text-sm font-semibold">
                              Watch video and technical details
                            </summary>
                            <div className="mt-3">
                              <video
                                controls
                                preload="metadata"
                                src={videoUrls[artifact.id]}
                                className="aspect-video w-full max-w-xl rounded-lg bg-black"
                              />
                              <details className="mt-3">
                                <summary className="text-muted-foreground cursor-pointer text-xs font-semibold">
                                  Fingerprint
                                </summary>
                                <p className="text-muted-foreground mt-2 font-mono text-[11px] break-all">
                                  {artifact.sha256}
                                </p>
                              </details>
                            </div>
                          </details>
                        ) : submission.evidenceId ? (
                          <RemoteEvidencePlayback
                            evidenceId={submission.evidenceId}
                            repository={repository}
                          />
                        ) : null}
                      </article>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="p-5">
            <EmptyState
              title="No permitted submissions"
              description="Complete an operator-visible collection workflow to add a record."
            />
          </div>
        )}
      </Card>
      {!productionMode ? (
        <details className="border-border bg-card rounded-lg border p-5">
          <summary className="cursor-pointer text-sm font-semibold">
            Demo tools
          </summary>
          <div className="mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-sm font-semibold">More</h2>
              <div className="mt-2 flex flex-wrap gap-4 text-sm">
                <Link
                  href="/demo-tools/codes"
                  className="text-primary font-semibold hover:underline"
                >
                  Demo check codes
                </Link>
                <Link
                  href="/privacy"
                  className="text-primary font-semibold hover:underline"
                >
                  Help & Privacy
                </Link>
                <Link
                  href="/setup"
                  className="text-primary font-semibold hover:underline"
                >
                  Pairing demo
                </Link>
              </div>
            </div>
            <button
              onClick={() => void resetDemo()}
              className="border-destructive/30 text-destructive inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold"
            >
              <RotateCcw className="size-4" /> Demo Reset
            </button>
          </div>
        </details>
      ) : null}
    </div>
  )
}

function RemoteEvidencePlayback({
  evidenceId,
  repository,
}: {
  evidenceId: string
  repository: SchoolTwinRepository
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setBusy(true)
    setError('')
    try {
      setUrl(await repository.getEvidencePlaybackUrl(evidenceId))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Video unavailable.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <details className="border-border bg-card/60 mt-4 rounded-lg border p-3">
      <summary className="min-h-10 cursor-pointer py-2 text-sm font-semibold">
        Watch video
      </summary>
      <div className="mt-3">
        {url ? (
          <video
            controls
            preload="metadata"
            src={url}
            className="aspect-video w-full max-w-xl rounded-lg bg-black"
          />
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void load()}
            className="primary-action min-h-12 rounded-lg px-4 text-sm font-semibold"
          >
            {busy ? 'Opening…' : 'Open secure playback'}
          </button>
        )}
        {error ? (
          <p className="text-destructive mt-2 text-sm" role="alert">
            {error}
          </p>
        ) : null}
        <p className="text-muted-foreground mt-2 text-xs">
          Playback links expire after 60 seconds. Open again when needed.
        </p>
      </div>
    </details>
  )
}

function groupBySchoolDate(submissions: OperatorSubmissionView[]) {
  const groups = new Map<string, OperatorSubmissionView[]>()
  for (const item of submissions) {
    const key = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(item.submittedAtLocal))
    groups.set(key, [...(groups.get(key) ?? []), item])
  }
  return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a))
}

function historyDayLabel(dateKey: string, locale: string): string {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  const yesterday = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(Date.now() - 86_400_000))
  if (dateKey === today) return locale === 'or-IN' ? 'ଆଜି' : 'Today'
  if (dateKey === yesterday) return locale === 'or-IN' ? 'ଗତକାଲି' : 'Yesterday'
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(`${dateKey}T12:00:00+05:30`))
}

function localeLabel(locale: string): 'en' | 'or' {
  return locale === 'or-IN' ? 'or' : 'en'
}

function friendlySubmissionTitle(
  submission: OperatorSubmissionView,
  locale: 'en' | 'or',
): string {
  const section = submission.title.match(/Class\s+\d+[AB]/)?.[0]
  if (submission.kind === 'class_pulse')
    return `${section ?? ''} ${locale === 'or' ? 'ଦୈନିକ ଶ୍ରେଣୀ ଯାଞ୍ଚ' : 'Daily Class Check'}`.trim()
  if (submission.kind === 'facility_pulse')
    return locale === 'or' ? 'ଦୈନିକ ସୁବିଧା ଯାଞ୍ଚ' : 'Daily Facility Check'
  if (submission.kind === 'live_evidence') {
    if (section)
      return `${section} ${locale === 'or' ? 'ଶ୍ରେଣୀ ଭିଡିଓ' : 'Class Video'}`
    return submission.title.replace('Live Evidence', 'Video')
  }
  if (submission.kind === 'operator_report')
    return locale === 'or' ? 'ସମସ୍ୟା ରିପୋର୍ଟ' : 'Problem report'
  return submission.title
}

export function PrivacyView() {
  const { repository, clock, t, locale } = useSchoolTwin()
  const [status, setStatus] = useState<PrototypeStorageStatus | null>(null)
  const [quota, setQuota] = useState<string>('Checking local storage…')

  useEffect(() => {
    Promise.all([repository.getStorageStatus(), quotaService.estimate()]).then(
      ([stored, estimate]) => {
        setStatus(stored)
        setQuota(
          estimate.usageBytes === null || estimate.quotaBytes === null
            ? 'Storage estimate unavailable in this browser.'
            : `${formatBytes(estimate.usageBytes)} used of approximately ${formatBytes(estimate.quotaBytes)} available to this profile.`,
        )
      },
    )
  }, [repository])

  async function requestPersistence() {
    const granted = await quotaService.requestPersistence()
    const next: PrototypeStorageStatus = {
      id: 'prototype-storage',
      persistenceRequested: true,
      persistenceGranted: granted,
      lastCheckedAtLocal: clock.now().toISOString(),
    }
    await repository.saveStorageStatus(next)
    setStatus(next)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('nav.help')}
        description={
          locale === 'or'
            ? 'ଏହି ଡିଭାଇସ୍‌ରେ ତଥ୍ୟ କିପରି ରହେ ଓ ଗୋପନୀୟ ଉତ୍ତର କିପରି ଲୁଚି ରହେ।'
            : 'How this browser stores school work and protects private participant responses.'
        }
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <InfoCard
          icon={<Database className="size-5" />}
          title={
            productionMode ? 'Production storage' : 'Local prototype storage'
          }
        >
          {productionMode ? (
            <>
              <p>
                Accepted school work is stored by the DrishtiShala pilot server.
                Videos use private storage and short-lived playback links.
              </p>
              <p>
                Work waiting to send and seven-day recovery copies may remain on
                this device. Server acceptance is required before work is shown
                as submitted.
              </p>
            </>
          ) : (
            <>
              <p>
                This prototype stores evidence locally in this browser.
                Production deployment uses remote infrastructure.
              </p>
              <p>
                Captured evidence is retained in the current browser profile and
                expected to survive normal refresh or relaunch, unless browser
                storage is manually cleared or evicted.
              </p>
            </>
          )}
          <p className="text-foreground font-medium">{quota}</p>
          {status ? (
            <p>
              Persistent-storage request:{' '}
              {status.persistenceGranted === true
                ? 'granted by browser'
                : status.persistenceGranted === false
                  ? 'not granted by browser'
                  : 'not yet resolved'}
              .
            </p>
          ) : null}
          {!productionMode ? (
            <button
              onClick={() => void requestPersistence()}
              className="border-border mt-1 rounded-lg border px-3 py-2 text-sm font-semibold"
            >
              Request persistent browser storage
            </button>
          ) : null}
        </InfoCard>
        <InfoCard
          icon={<ShieldCheck className="size-5" />}
          title="Participant privacy"
        >
          <p>
            Operator projections exclude individual Pulse answers, access
            credentials, and all private-report details.
          </p>
          <p>
            {productionMode
              ? 'Private reports omit participant links and exact application timestamps. Network and platform timing logs mean guaranteed anonymity is not claimed.'
              : 'Frontend code and IndexedDB cannot guarantee anonymity against someone who controls this device or its developer tools.'}
          </p>
        </InfoCard>
        <InfoCard
          icon={<FileVideo className="size-5" />}
          title="Capture integrity language"
        >
          <p>
            Live Evidence can record continuously, observe an expected marker,
            record local timestamps, and generate an evidence fingerprint.
          </p>
          <p>
            These checks do not prove authenticity, physical presence,
            immutability, or tamper resistance.
          </p>
        </InfoCard>
        <InfoCard
          icon={<HardDrive className="size-5" />}
          title="Supported demo environment"
        >
          <p>
            Use the latest Chrome or Chromium, HTTPS deployment or localhost,
            and an enabled camera permission.
          </p>
          <p>
            Other browsers receive compatibility guidance where required media
            APIs are unavailable.
          </p>
        </InfoCard>
      </div>
      <PrototypeNotice>
        Sensitive or immediate-safety descriptions are not persisted. The
        prototype shows protected-channel guidance without unverified contact
        information.
      </PrototypeNotice>
    </div>
  )
}

function InfoCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <Card className="p-5">
      <span className="bg-accent text-accent-foreground flex size-10 items-center justify-center rounded-lg">
        {icon}
      </span>
      <h2 className="mt-4 text-base font-semibold">{title}</h2>
      <div className="text-muted-foreground mt-3 space-y-3 text-sm leading-6">
        {children}
      </div>
    </Card>
  )
}

function formatBytes(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'unit',
    unit: value >= 1024 ** 2 ? 'megabyte' : 'kilobyte',
    maximumFractionDigits: 1,
  }).format(value / (value >= 1024 ** 2 ? 1024 ** 2 : 1024))
}
