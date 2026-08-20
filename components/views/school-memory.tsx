"use client"

import { Card, CardHeader, SectionLabel } from "@/components/primitives"
import { schoolMemory, memoryInsight, schools } from "@/lib/data"
import { useStore } from "@/lib/store"
import { History, Lightbulb, AlertTriangle } from "lucide-react"

export function SchoolMemoryView() {
  const { schoolId } = useStore()
  const school = schools.find((s) => s.id === schoolId) ?? schools[0]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-balance">Institutional Memory</h1>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">
          {school.name} — SchoolTwin remembers every issue and resolution so recurring failures are never treated as
          new.
        </p>
      </div>

      <Card className="border-attention/40 bg-attention/5">
        <div className="flex items-start gap-3 p-5">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-attention/15 text-attention">
            <Lightbulb className="size-5" />
          </span>
          <div>
            <SectionLabel>Pattern detected</SectionLabel>
            <p className="mt-1 text-sm leading-relaxed text-pretty">{memoryInsight}</p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Water pump — recurrence history"
          subtitle="Same asset, repeated failures"
          icon={<History className="size-4" />}
        />
        <ol className="relative space-y-0 p-5">
          {schoolMemory.map((m, i) => {
            const last = i === schoolMemory.length - 1
            return (
              <li key={m.year} className="relative flex gap-4 pb-6 last:pb-0">
                {i < schoolMemory.length - 1 && (
                  <span className="absolute left-[7px] top-4 h-full w-px bg-border" aria-hidden />
                )}
                <span
                  className={`mt-1 size-3.5 shrink-0 rounded-full border-2 ${
                    last ? "border-escalated bg-escalated/20" : "border-primary bg-card"
                  }`}
                  aria-hidden
                />
                <div>
                  <p className="text-sm font-medium">{m.year}</p>
                  <p className="text-sm text-muted-foreground text-pretty">{m.text}</p>
                  {last && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-escalated/15 px-2 py-0.5 text-xs font-medium text-escalated">
                      <AlertTriangle className="size-3" />
                      Recurring
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </Card>
    </div>
  )
}
