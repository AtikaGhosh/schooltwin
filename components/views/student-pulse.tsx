"use client"

import { useMemo, useState } from "react"
import { Radar, Check, X, ShieldCheck, PartyPopper } from "lucide-react"
import { useStore } from "@/lib/store"
import { pulseQuestions } from "@/lib/data"
import { Card } from "@/components/primitives"
import { cn } from "@/lib/utils"

export function StudentPulseView() {
  const { addActivity } = useStore()
  // Randomly sample 3 questions (rotating, unpredictable — anti-gaming).
  const sample = useMemo(() => {
    return [...pulseQuestions].sort(() => Math.random() - 0.5).slice(0, 3)
  }, [])
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, "yes" | "no">>({})
  const [done, setDone] = useState(false)

  const current = sample[step]
  const progress = Math.round(((step + (done ? 1 : 0)) / sample.length) * 100)

  function answer(v: "yes" | "no") {
    const next = { ...answers, [current.id]: v }
    setAnswers(next)
    if (step + 1 < sample.length) {
      setStep(step + 1)
    } else {
      setDone(true)
      addActivity("student", "Daily School Pulse submitted — added to today's aggregated student sample.")
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="text-center">
        <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Radar className="size-6" />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-balance">Daily School Pulse</h1>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">
          A few quick questions. Takes about 20 seconds. Your answers are private and combined with
          others.
        </p>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
      </div>

      {!done ? (
        <Card className="p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Question {step + 1} of {sample.length}
          </p>
          <p className="mt-3 text-xl font-medium leading-snug text-balance">{current.text}</p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              onClick={() => answer("yes")}
              className="flex flex-col items-center gap-2 rounded-xl border-2 border-border bg-card py-6 text-sm font-semibold transition-colors hover:border-stable hover:bg-stable/10"
            >
              <span className="flex size-11 items-center justify-center rounded-full bg-stable/15 text-stable">
                <Check className="size-6" />
              </span>
              Yes
            </button>
            <button
              onClick={() => answer("no")}
              className="flex flex-col items-center gap-2 rounded-xl border-2 border-border bg-card py-6 text-sm font-semibold transition-colors hover:border-escalated hover:bg-escalated/10"
            >
              <span className="flex size-11 items-center justify-center rounded-full bg-escalated/15 text-escalated">
                <X className="size-6" />
              </span>
              No
            </button>
          </div>
        </Card>
      ) : (
        <Card className="p-6 text-center">
          <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-stable/15 text-stable">
            <PartyPopper className="size-6" />
          </span>
          <h2 className="text-lg font-semibold">Thank you!</h2>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">
            Your pulse was recorded. It becomes one independent signal in today&apos;s sample.
          </p>
          <div className="mt-4 space-y-1.5 text-left">
            {sample.map((q) => (
              <div key={q.id} className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm">
                <span className="text-pretty">{q.text}</span>
                <span
                  className={cn(
                    "ml-3 shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold",
                    answers[q.id] === "yes" ? "bg-stable/15 text-stable" : "bg-escalated/15 text-escalated",
                  )}
                >
                  {answers[q.id] === "yes" ? "Yes" : "No"}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex items-start gap-2.5 rounded-xl bg-accent/60 px-4 py-3">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
        <p className="text-xs text-muted-foreground text-pretty">
          Your identity stays protected. Teachers never see who said what — only aggregated results
          like &ldquo;76% of sampled students reported no drinking water.&rdquo;
        </p>
      </div>
    </div>
  )
}
