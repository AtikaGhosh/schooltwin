"use client"

import { useState } from "react"
import { Card, CardHeader, ConfidencePill, RealityGapPill } from "@/components/primitives"
import { claims, schools } from "@/lib/data"
import { useStore } from "@/lib/store"
import { BadgeCheck, MapPin, CheckCircle2, XCircle } from "lucide-react"

export function InspectorQueueView() {
  const { addActivity } = useStore()
  const school = schools[0]
  // Prioritise the low-confidence / verify claims — that is where an inspector adds the most trust.
  const queue = claims.filter((c) => c.confidence === "low" || c.realityGap === "verify" || c.realityGap === "persistent")
  const [verified, setVerified] = useState<Record<string, "confirmed" | "refuted">>({})

  function record(id: string, subject: string, outcome: "confirmed" | "refuted") {
    setVerified((v) => ({ ...v, [id]: outcome }))
    addActivity(
      "inspector",
      `High-trust verification: "${subject}" ${outcome === "confirmed" ? "confirmed on site" : "refuted on site"}.`,
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-balance">Verification Queue</h1>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">
          Your on-site checks carry high trust weight. SchoolTwin routes you to the claims where evidence is weakest or
          disputed — not every school, only what needs a human.
        </p>
      </div>

      <div className="grid gap-4">
        {queue.map((c) => {
          const outcome = verified[c.id]
          return (
            <Card key={c.id}>
              <CardHeader
                title={`${c.subject} — ${c.predicate}`}
                subtitle={`${school.name} · ${school.block}`}
                icon={<BadgeCheck className="size-4" />}
                action={<RealityGapPill gap={c.realityGap} />}
              />
              <div className="space-y-4 p-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Reported state" value={c.reportedState} />
                  <Field label="Independent evidence" value={c.observedState} />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <ConfidencePill confidence={c.confidence} />
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" />
                    On-site check requested
                  </span>
                </div>

                {outcome ? (
                  <div
                    className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium ${
                      outcome === "confirmed"
                        ? "border-stable/40 bg-stable/10 text-stable"
                        : "border-escalated/40 bg-escalated/10 text-escalated"
                    }`}
                  >
                    {outcome === "confirmed" ? (
                      <CheckCircle2 className="size-4" />
                    ) : (
                      <XCircle className="size-4" />
                    )}
                    Verification recorded — confidence upgraded to High.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => record(c.id, c.subject, "confirmed")}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-stable px-3 py-2 text-xs font-medium text-stable-foreground transition hover:opacity-90"
                    >
                      <CheckCircle2 className="size-4" />
                      Confirm on site
                    </button>
                    <button
                      onClick={() => record(c.id, c.subject, "refuted")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-escalated/40 bg-escalated/10 px-3 py-2 text-xs font-medium text-escalated transition hover:bg-escalated/20"
                    >
                      <XCircle className="size-4" />
                      Refute on site
                    </button>
                  </div>
                )}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary/60 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-pretty">{value}</p>
    </div>
  )
}
