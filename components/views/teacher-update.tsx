"use client"

import { useState } from "react"
import {
  ClipboardCheck,
  BookOpenCheck,
  Wrench,
  MessageCircleQuestion,
  Check,
  Send,
} from "lucide-react"
import { useStore } from "@/lib/store"
import { Card, CardHeader } from "@/components/primitives"
import { cn } from "@/lib/utils"

export function TeacherUpdateView() {
  const { role, addActivity } = useStore()
  const [present, setPresent] = useState(38)
  const total = 40
  const [attSubmitted, setAttSubmitted] = useState(false)
  const [classes, setClasses] = useState<Record<string, boolean>>({
    Mathematics: false,
    Science: false,
    "Language (Hindi)": false,
    "Social Studies": false,
  })
  const [explanation, setExplanation] = useState("")
  const [responded, setResponded] = useState(false)

  function submitAttendance() {
    setAttSubmitted(true)
    addActivity(role, `Attendance submitted: ${present}/${total} present. Recorded as one evidence source.`)
  }

  function toggleClass(name: string) {
    setClasses((prev) => {
      const next = { ...prev, [name]: !prev[name] }
      if (!prev[name]) addActivity(role, `Confirmed class conducted: ${name}.`)
      return next
    })
  }

  function respond() {
    if (!explanation.trim()) return
    setResponded(true)
    addActivity(role, "Responded to attendance discrepancy with an explanation. Recorded, not treated as misconduct.")
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Teacher Daily Update
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-balance">Class 5 — Daily Update</h1>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">
          Capture once, reuse everywhere. Your input is treated as one independent evidence source.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Attendance */}
        <Card>
          <CardHeader title="Mark attendance" subtitle={`Class 5 · ${total} enrolled`} icon={<ClipboardCheck className="size-4" />} />
          <div className="p-5">
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => setPresent((p) => Math.max(0, p - 1))}
                className="flex size-10 items-center justify-center rounded-lg border border-border text-lg font-medium hover:bg-accent"
                aria-label="Decrease"
              >
                −
              </button>
              <div className="text-center">
                <p className="font-mono text-3xl font-semibold tabular-nums">
                  {present}
                  <span className="text-lg text-muted-foreground">/{total}</span>
                </p>
                <p className="text-xs text-muted-foreground">present today</p>
              </div>
              <button
                onClick={() => setPresent((p) => Math.min(total, p + 1))}
                className="flex size-10 items-center justify-center rounded-lg border border-border text-lg font-medium hover:bg-accent"
                aria-label="Increase"
              >
                +
              </button>
            </div>
            <button
              onClick={submitAttendance}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              {attSubmitted ? <Check className="size-4" /> : <Send className="size-4" />}
              {attSubmitted ? "Attendance submitted" : "Submit attendance"}
            </button>
          </div>
        </Card>

        {/* Class delivery */}
        <Card>
          <CardHeader title="Confirm classes conducted" subtitle="Today's timetable" icon={<BookOpenCheck className="size-4" />} />
          <div className="divide-y divide-border">
            {Object.keys(classes).map((name) => (
              <button
                key={name}
                onClick={() => toggleClass(name)}
                className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-accent/50"
              >
                <span className="text-sm">{name}</span>
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-md border",
                    classes[name] ? "border-stable bg-stable text-stable-foreground" : "border-border",
                  )}
                >
                  {classes[name] ? <Check className="size-4" /> : null}
                </span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Discrepancy response */}
      <Card>
        <CardHeader
          title="Respond to a discrepancy"
          subtitle="SchoolTwin asks — it does not accuse"
          icon={<MessageCircleQuestion className="size-4" />}
        />
        <div className="p-5">
          <div className="rounded-lg border border-attention/40 bg-attention/10 px-4 py-3">
            <p className="text-sm font-medium text-attention">Persistent attendance discrepancy detected</p>
            <p className="mt-1 text-xs text-muted-foreground text-pretty">
              Reported attendance (~96%) has exceeded independent student evidence (~82%) for several days.
              This may have many causes — please help us understand.
            </p>
          </div>

          {!responded ? (
            <>
              <label htmlFor="exp" className="mt-4 block text-sm font-medium">
                Your explanation
              </label>
              <textarea
                id="exp"
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                rows={3}
                placeholder="For example: several students left early due to a local festival; some marked present had already been sent home."
                className="mt-2 w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={respond}
                disabled={!explanation.trim()}
                className="mt-3 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="size-4" /> Submit explanation
              </button>
            </>
          ) : (
            <div className="mt-4 flex items-start gap-2.5 rounded-lg bg-stable/10 px-4 py-3">
              <Check className="mt-0.5 size-4 shrink-0 text-stable" />
              <p className="text-sm text-pretty">
                Explanation recorded. The issue stays under observation — it is not marked as misconduct.
              </p>
            </div>
          )}
        </div>
      </Card>

      <div className="flex items-start gap-2.5 rounded-xl border border-border px-4 py-3">
        <Wrench className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground text-pretty">
          Spotted a broken facility? Use Issues &amp; Actions to open a maintenance issue — it becomes a
          tracked item with an owner and deadline.
        </p>
      </div>
    </div>
  )
}
