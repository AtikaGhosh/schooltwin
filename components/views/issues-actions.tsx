"use client"

import { useState } from "react"
import { ListChecks, ArrowUpRight, CheckCircle2, ShieldAlert } from "lucide-react"
import { useStore } from "@/lib/store"
import { issues, schools } from "@/lib/data"
import type { Issue, IssueStatus, Severity } from "@/lib/types"
import { Card, CardHeader, ConfidencePill } from "@/components/primitives"
import { cn } from "@/lib/utils"

const lifecycle: IssueStatus[] = [
  "detected",
  "under-review",
  "action-required",
  "assigned",
  "in-progress",
  "verification",
  "resolved",
]

const statusText: Record<IssueStatus, string> = {
  detected: "Detected",
  "under-review": "Under review",
  "action-required": "Action required",
  assigned: "Assigned",
  "in-progress": "In progress",
  "resolution-claimed": "Resolution claimed",
  verification: "Verification",
  resolved: "Resolved",
  escalated: "Escalated",
}

const severityCls: Record<Severity, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-watch/25 text-watch-foreground",
  high: "bg-attention/15 text-attention",
  critical: "bg-escalated/15 text-escalated",
}

export function IssuesActionsView() {
  const { schoolId, role, addActivity } = useStore()
  const school = schools.find((s) => s.id === schoolId) ?? schools[0]
  const [localIssues, setLocalIssues] = useState<Issue[]>(issues)
  const schoolIssues = localIssues.filter((i) => i.schoolId === schoolId)

  const canAct = role === "headmaster" || role === "teacher"

  function markCompleted(issue: Issue) {
    setLocalIssues((prev) =>
      prev.map((i) => (i.id === issue.id ? { ...i, status: "resolution-claimed" } : i)),
    )
    addActivity(role, `Marked "${issue.title}" as resolution claimed — awaiting verification.`)
  }

  function requestSupport(issue: Issue) {
    setLocalIssues((prev) =>
      prev.map((i) =>
        i.id === issue.id
          ? { ...i, status: "escalated", escalationLevel: i.escalationLevel + 1, responsibleLevel: "Block Authority" }
          : i,
      ),
    )
    addActivity(role, `Requested higher-level support for "${issue.title}" — responsibility moved upward.`)
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Action & Accountability
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-balance">Issues & Actions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Detect → Understand → Assist → Assign → Track → Verify → Escalate. The system escalates
          problems, not people.
        </p>
      </div>

      {schoolIssues.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          {`No active issues recorded for ${school.name} in this demo.`}
        </div>
      ) : (
        <div className="space-y-4">
          {schoolIssues.map((issue) => (
            <Card key={issue.id}>
              <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground">{issue.id}</span>
                    <h3 className="text-sm font-semibold text-pretty">{issue.title}</h3>
                    <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-medium capitalize", severityCls[issue.severity])}>
                      {issue.severity}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground text-pretty">{issue.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  {issue.status === "escalated" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-escalated/15 px-2.5 py-0.5 text-xs font-medium text-escalated">
                      <ShieldAlert className="size-3.5" /> Escalated · L{issue.escalationLevel}
                    </span>
                  ) : null}
                  <ConfidencePill confidence={issue.confidence} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-5 py-4 text-xs sm:grid-cols-4">
                <Meta label="Owner" value={issue.owner} />
                <Meta label="Responsible level" value={issue.responsibleLevel} />
                <Meta label="Student impact" value={String(issue.studentImpact)} />
                <Meta label="Deadline" value={issue.deadline ?? "—"} />
                <Meta label="First detected" value={issue.firstDetected} />
                {issue.dependency ? <Meta label="Dependency" value={issue.dependency} /> : null}
              </div>

              <div className="border-t border-border px-5 py-4">
                <Lifecycle status={issue.status} />
              </div>

              {canAct ? (
                <div className="flex flex-wrap gap-2 border-t border-border px-5 py-3">
                  <button
                    onClick={() => markCompleted(issue)}
                    disabled={issue.status === "resolution-claimed" || issue.status === "resolved"}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <CheckCircle2 className="size-3.5" /> Mark resolution claimed
                  </button>
                  {issue.dependency && issue.status !== "escalated" ? (
                    <button
                      onClick={() => requestSupport(issue)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
                    >
                      <ArrowUpRight className="size-3.5" /> Request higher-level support
                    </button>
                  ) : null}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium text-pretty">{value}</p>
    </div>
  )
}

function Lifecycle({ status }: { status: IssueStatus }) {
  const escalated = status === "escalated"
  const claimed = status === "resolution-claimed"
  const activeIndex = escalated
    ? lifecycle.indexOf("action-required")
    : claimed
      ? lifecycle.indexOf("verification")
      : lifecycle.indexOf(status)

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <ListChecks className="size-3.5 text-muted-foreground" />
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Lifecycle
        </span>
        <span className="ml-auto text-xs font-medium">
          {escalated ? "Escalated to higher authority" : statusText[status]}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {lifecycle.map((step, idx) => {
          const done = idx <= activeIndex
          return (
            <span
              key={step}
              className={cn(
                "rounded-md px-2 py-1 text-[10px] font-medium",
                done ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground",
                idx === activeIndex && !escalated && "ring-1 ring-primary",
              )}
            >
              {statusText[step]}
            </span>
          )
        })}
        {escalated ? (
          <span className="rounded-md bg-escalated/15 px-2 py-1 text-[10px] font-medium text-escalated ring-1 ring-escalated/40">
            Escalation → Higher authority
          </span>
        ) : null}
      </div>
    </div>
  )
}
