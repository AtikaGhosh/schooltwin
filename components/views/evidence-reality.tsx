"use client"

import { useState } from "react"
import { Radar, Sparkles, CheckCircle2, XCircle, Clock } from "lucide-react"
import { useStore } from "@/lib/store"
import { claims, signals, waterTimeline, schools } from "@/lib/data"
import {
  Card,
  CardHeader,
  ConfidencePill,
  RealityGapPill,
} from "@/components/primitives"
import { sourceLabel } from "@/components/source-label"
import { cn } from "@/lib/utils"

export function EvidenceRealityView() {
  const { schoolId, role, addActivity } = useStore()
  const school = schools.find((s) => s.id === schoolId) ?? schools[0]
  const schoolClaims = claims.filter((c) => c.schoolId === schoolId)
  const [activeId, setActiveId] = useState(schoolClaims[0]?.id ?? "")
  const [requested, setRequested] = useState(false)

  const active = schoolClaims.find((c) => c.id === activeId) ?? schoolClaims[0]

  if (!active) {
    return (
      <EmptyState note={`No claim signals are populated for ${school.name} in this demo. Switch to Govt Primary School, Rampur.`} />
    )
  }

  const claimSignals = signals.filter((s) => s.claimId === active.id)
  const supporting = claimSignals.filter((s) => /yes|served|present|available: yes/i.test(s.value))
  const contradicting = claimSignals.filter((s) => !/yes|served|present|available: yes/i.test(s.value))

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reality Engine</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-balance">Evidence & Reality</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Independent signals are corroborated over time. Anomaly does not equal misconduct.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* Claim list */}
        <div className="space-y-2">
          {schoolClaims.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setActiveId(c.id)
                setRequested(false)
              }}
              className={cn(
                "w-full rounded-lg border px-3 py-2.5 text-left transition-colors",
                c.id === active.id
                  ? "border-primary bg-accent"
                  : "border-border bg-card hover:border-primary/40",
              )}
            >
              <p className="text-sm font-medium text-pretty">{c.subject}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{c.domain}</p>
              <div className="mt-1.5">
                <RealityGapPill gap={c.realityGap} />
              </div>
            </button>
          ))}
        </div>

        {/* Detail */}
        <div className="space-y-4">
          <Card>
            <CardHeader
              title={`${active.subject} — ${active.predicate}`}
              subtitle={active.timeScope}
              icon={<Radar className="size-4" />}
              action={<ConfidencePill confidence={active.confidence} />}
            />
            <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-3">
              <StateCard label="Reported" value={active.reportedState} tone="neutral" />
              <StateCard label="Observed" value={active.observedState} tone="warn" />
              <StateCard label="Verified" value={active.verifiedState} tone="neutral" />
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-3">
              <span className="text-xs text-muted-foreground">Reality Gap</span>
              <RealityGapPill gap={active.realityGap} />
              <span className="ml-auto text-xs text-muted-foreground">Updated {active.lastUpdated}</span>
            </div>
          </Card>

          {active.recommendation ? (
            <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-accent/60 px-5 py-4">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  System recommendation
                </p>
                <p className="mt-1 text-sm text-pretty">{active.recommendation}</p>
                {(role === "headmaster" || role === "inspector" || role === "authority") && !requested ? (
                  <button
                    onClick={() => {
                      setRequested(true)
                      addActivity(role, `Verification requested for "${active.subject}".`)
                    }}
                    className="mt-3 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
                  >
                    Request verification
                  </button>
                ) : null}
                {requested ? (
                  <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-stable">
                    <CheckCircle2 className="size-3.5" /> Verification requested — logged to timeline.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <SignalColumn title="Supporting signals" tone="good" signals={supporting} />
            <SignalColumn title="Contradicting signals" tone="bad" signals={contradicting} />
          </div>

          {active.id === "clm-water" ? (
            <Card>
              <CardHeader title="Evidence timeline" subtitle="Water availability — chronology" icon={<Clock className="size-4" />} />
              <ol className="relative space-y-4 px-5 py-5">
                {waterTimeline.map((e) => (
                  <li key={e.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={cn(
                          "size-2.5 rounded-full",
                          e.kind === "escalation"
                            ? "bg-escalated"
                            : e.kind === "resolution"
                              ? "bg-stable"
                              : e.kind === "action"
                                ? "bg-primary"
                                : "bg-muted-foreground",
                        )}
                      />
                      <span className="mt-1 w-px flex-1 bg-border" />
                    </div>
                    <div className="-mt-0.5 pb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{e.date}</span>
                        {sourceLabel(e.source)}
                      </div>
                      <p className="mt-0.5 text-sm text-pretty">{e.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function StateCard({ label, value, tone }: { label: string; value: string; tone: "neutral" | "warn" }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-sm font-semibold text-pretty", tone === "warn" && "text-attention")}>
        {value}
      </p>
    </div>
  )
}

function SignalColumn({
  title,
  tone,
  signals,
}: {
  title: string
  tone: "good" | "bad"
  signals: { id: string; value: string; note?: string; source: any; timestamp: string }[]
}) {
  return (
    <Card>
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        {tone === "good" ? (
          <CheckCircle2 className="size-4 text-stable" />
        ) : (
          <XCircle className="size-4 text-escalated" />
        )}
        <p className="text-sm font-semibold">{title}</p>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
          {signals.length}
        </span>
      </div>
      <div className="divide-y divide-border">
        {signals.length === 0 ? (
          <p className="px-4 py-4 text-xs text-muted-foreground">None recorded.</p>
        ) : (
          signals.map((s) => (
            <div key={s.id} className="px-4 py-3">
              {sourceLabel(s.source)}
              <p className="mt-1 text-sm text-pretty">{s.value}</p>
              {s.note ? <p className="mt-0.5 text-xs text-muted-foreground text-pretty">{s.note}</p> : null}
            </div>
          ))
        )}
      </div>
    </Card>
  )
}

function EmptyState({ note }: { note: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
      <p className="text-sm text-muted-foreground text-pretty">{note}</p>
    </div>
  )
}
