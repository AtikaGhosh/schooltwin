"use client"

import { useState } from "react"
import { MessageSquareWarning, ShieldAlert, CheckCircle2, Lock } from "lucide-react"
import { useStore } from "@/lib/store"
import { issueCategories } from "@/lib/data"
import { Card } from "@/components/primitives"
import { cn } from "@/lib/utils"

export function ReportIssueView() {
  const { addActivity } = useStore()
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState("")
  const [submitted, setSubmitted] = useState(false)

  function submit() {
    if (!selected) return
    setSubmitted(true)
    addActivity("student", `Anonymous issue reported: "${selected}". Added as an independent signal.`)
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-md">
        <Card className="p-8 text-center">
          <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-stable/15 text-stable">
            <CheckCircle2 className="size-6" />
          </span>
          <h2 className="text-lg font-semibold">Report received</h2>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">
            Thank you. Your report about <span className="font-medium text-foreground">{selected}</span> was
            recorded anonymously. If other students report the same thing, SchoolTwin will open an issue and
            notify the right person.
          </p>
          <button
            onClick={() => {
              setSubmitted(false)
              setSelected(null)
              setDetail("")
            }}
            className="mt-5 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Report something else
          </button>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Report Something Wrong
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-balance">
          Tell us what&apos;s not working
        </h1>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">
          Pick what&apos;s wrong at school. Your report is anonymous and helps make problems visible.
        </p>
      </div>

      <Card className="p-5">
        <p className="text-sm font-medium">What&apos;s the problem?</p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {issueCategories.map((c) => (
            <button
              key={c}
              onClick={() => setSelected(c)}
              className={cn(
                "rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                selected === c
                  ? "border-primary bg-accent font-medium"
                  : "border-border bg-card hover:border-primary/40",
              )}
            >
              {c}
            </button>
          ))}
        </div>

        <label htmlFor="detail" className="mt-5 block text-sm font-medium">
          Anything to add? <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <textarea
          id="detail"
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          rows={3}
          placeholder="For example: the tap has had no water since Monday."
          className="mt-2 w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />

        <button
          onClick={submit}
          disabled={!selected}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <MessageSquareWarning className="size-4" /> Submit report
        </button>
      </Card>

      <div className="space-y-3">
        <div className="flex items-start gap-2.5 rounded-xl bg-accent/60 px-4 py-3">
          <Lock className="mt-0.5 size-4 shrink-0 text-primary" />
          <p className="text-xs text-muted-foreground text-pretty">
            Reports are anonymous. Ordinary operational feedback is aggregated before anyone sees it.
          </p>
        </div>
        <div className="flex items-start gap-2.5 rounded-xl border border-border px-4 py-3">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-attention" />
          <p className="text-xs text-muted-foreground text-pretty">
            For safety or protection concerns, a separate protected channel is used — these are not handled
            as ordinary school-management issues.
          </p>
        </div>
      </div>
    </div>
  )
}
