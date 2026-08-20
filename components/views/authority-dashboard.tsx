"use client"

import { LayoutDashboard, ArrowRight, Flame, MessageSquareText } from "lucide-react"
import { useStore } from "@/lib/store"
import { schools, DISTRICT } from "@/lib/data"
import type { OperationalStatus } from "@/lib/types"
import { Card, CardHeader, StatusPill } from "@/components/primitives"
import { cn } from "@/lib/utils"

const statusOrder: Record<OperationalStatus, number> = {
  escalated: 0,
  attention: 1,
  watch: 2,
  stable: 3,
}

export function AuthorityDashboardView() {
  const { setSchoolId, setView } = useStore()
  const ranked = [...schools].sort((a, b) => statusOrder[a.status] - statusOrder[b.status])

  function openSchool(id: string) {
    setSchoolId(id)
    setView("twin")
  }

  const priorities = ranked.filter((s) => s.status === "escalated" || s.status === "attention")

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Government Control Centre
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-balance">{DISTRICT.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Operational statuses — not permanent school grades.
          </p>
        </div>
        <button
          onClick={() => setView("ask")}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-accent md:self-auto"
        >
          <MessageSquareText className="size-4" /> Ask SchoolTwin
        </button>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard label="Stable" value={DISTRICT.stable} total={DISTRICT.total} tone="stable" />
        <SummaryCard label="Watch" value={DISTRICT.watch} total={DISTRICT.total} tone="watch" />
        <SummaryCard label="Needs Attention" value={DISTRICT.attention} total={DISTRICT.total} tone="attention" />
        <SummaryCard label="Escalated" value={DISTRICT.escalated} total={DISTRICT.total} tone="escalated" />
      </div>

      {/* Attention ranking */}
      <Card>
        <CardHeader
          title="Attention ranking"
          subtitle="Severity × Duration × Student Impact × Confidence × Urgency"
          icon={<Flame className="size-4" />}
        />
        <ol className="divide-y divide-border">
          {priorities.map((s, i) => (
            <li key={s.id}>
              <button
                onClick={() => openSchool(s.id)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-accent/50"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/12 font-mono text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.block} Block · {s.openIssues} open · {s.escalations} escalated · gap{" "}
                    {s.attendanceReported - s.attendanceObserved} pts
                  </p>
                </div>
                <StatusPill status={s.status} />
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ol>
      </Card>

      {/* All schools */}
      <Card>
        <CardHeader title="Schools under jurisdiction" subtitle={`${schools.length} shown of ${DISTRICT.total}`} icon={<LayoutDashboard className="size-4" />} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-5 py-2 font-medium">School</th>
                <th className="px-5 py-2 font-medium">Block</th>
                <th className="px-5 py-2 font-medium">Students</th>
                <th className="px-5 py-2 font-medium">Open</th>
                <th className="px-5 py-2 font-medium">Status</th>
                <th className="px-5 py-2" />
              </tr>
            </thead>
            <tbody>
              {ranked.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                  <td className="px-5 py-3 font-medium text-pretty">{s.name}</td>
                  <td className="px-5 py-3 text-muted-foreground">{s.block}</td>
                  <td className="px-5 py-3 tabular-nums">{s.students}</td>
                  <td className="px-5 py-3 tabular-nums">{s.openIssues}</td>
                  <td className="px-5 py-3"><StatusPill status={s.status} /></td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => openSchool(s.id)}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  total,
  tone,
}: {
  label: string
  value: number
  total: number
  tone: OperationalStatus
}) {
  const bar =
    tone === "stable"
      ? "bg-stable"
      : tone === "watch"
        ? "bg-watch"
        : tone === "attention"
          ? "bg-attention"
          : "bg-escalated"
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", bar)} style={{ width: `${(value / total) * 100}%` }} />
      </div>
    </Card>
  )
}
