"use client"

import { useState } from "react"
import { ClipboardCheck, Check, Flag, PackageCheck, Clock3 } from "lucide-react"
import { useStore } from "@/lib/store"
import { studentAttendance, studentEntitlements } from "@/lib/data"
import { Card, CardHeader } from "@/components/primitives"

export function StudentRecordsView() {
  const { addActivity } = useStore()
  const [disputed, setDisputed] = useState<Record<string, boolean>>({})

  function dispute(date: string) {
    setDisputed((prev) => ({ ...prev, [date]: true }))
    addActivity("student", `Disputed attendance record for ${date} — independent check logged.`)
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Student Record Verification
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-balance">My Records</h1>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">
          Check what the school has recorded about you. If something is wrong, you can flag it.
        </p>
      </div>

      <Card>
        <CardHeader title="Your attendance" subtitle="Tap to confirm or dispute" icon={<ClipboardCheck className="size-4" />} />
        <div className="divide-y divide-border">
          {studentAttendance.map((rec) => {
            const isDisputed = disputed[rec.date]
            return (
              <div key={rec.date} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className="text-sm font-medium">{rec.date}</p>
                  <p className="text-xs text-muted-foreground capitalize">Recorded: {rec.status}</p>
                </div>
                {isDisputed ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-attention/15 px-3 py-1.5 text-xs font-medium text-attention">
                    <Flag className="size-3.5" /> Disputed
                  </span>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-stable">
                      <Check className="size-3.5" /> Correct
                    </span>
                    <button
                      onClick={() => dispute(rec.date)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:border-attention hover:text-attention"
                    >
                      This is incorrect
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Card>

      <Card>
        <CardHeader title="Your entitlements" subtitle="Confirm what you actually received" icon={<PackageCheck className="size-4" />} />
        <div className="divide-y divide-border">
          {studentEntitlements.map((e) => (
            <div key={e.id} className="flex items-center justify-between px-5 py-3">
              <p className="text-sm font-medium text-pretty">{e.label}</p>
              {e.status === "confirmed" ? (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-stable/15 px-2 py-0.5 text-xs font-medium text-stable">
                  <Check className="size-3.5" /> Received
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  <Clock3 className="size-3.5" /> Pending
                </span>
              )}
            </div>
          ))}
        </div>
      </Card>

      <p className="text-center text-xs text-muted-foreground text-pretty">
        Disputes create an independent check against attendance and entitlement fabrication.
      </p>
    </div>
  )
}
