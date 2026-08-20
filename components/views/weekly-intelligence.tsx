"use client"

import {
  CalendarClock,
  TrendingUp,
  TrendingDown,
  Sparkles,
  ShieldAlert,
  CircleHelp,
} from "lucide-react"
import { useStore } from "@/lib/store"
import { weeklyReviews, schools, attendanceTrend } from "@/lib/data"
import { Card, CardHeader, StatusPill } from "@/components/primitives"

export function WeeklyIntelligenceView() {
  const { schoolId } = useStore()
  const school = schools.find((s) => s.id === schoolId) ?? schools[0]
  const review = weeklyReviews.find((r) => r.schoolId === schoolId)

  if (!review) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
        {`A weekly AI review is generated for the demo focus school. Switch to Govt Primary School, Rampur.`}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Weekly AI School Review
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-balance">{school.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{review.weekLabel}</p>
        </div>
        <StatusPill status={review.status} className="text-sm" />
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-accent/60 px-5 py-4">
        <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" />
        <p className="text-sm leading-relaxed text-pretty">{review.headline}</p>
      </div>

      <Card>
        <CardHeader title="Attendance — reported vs evidence" subtitle="6-week trend" icon={<TrendingDown className="size-4" />} />
        <div className="p-5">
          <TrendChart />
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <div className="flex items-center gap-2 border-b border-border px-5 py-3">
            <TrendingUp className="size-4 text-stable" />
            <p className="text-sm font-semibold">Improved this week</p>
          </div>
          <ul className="divide-y divide-border">
            {review.improved.map((it) => (
              <li key={it.label} className="px-5 py-3">
                <p className="text-sm font-medium">{it.label}</p>
                <p className="text-xs text-muted-foreground text-pretty">{it.detail}</p>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <div className="flex items-center gap-2 border-b border-border px-5 py-3">
            <TrendingDown className="size-4 text-escalated" />
            <p className="text-sm font-semibold">Deteriorated</p>
          </div>
          <ul className="divide-y divide-border">
            {review.deteriorated.map((it) => (
              <li key={it.label} className="px-5 py-3">
                <p className="text-sm font-medium">{it.label}</p>
                <p className="text-xs text-muted-foreground text-pretty">{it.detail}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <CardHeader title="Important AI observations" icon={<Sparkles className="size-4" />} />
        <ul className="divide-y divide-border">
          {review.observations.map((o, i) => (
            <li key={i} className="flex gap-3 px-5 py-3">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
              <p className="text-sm text-pretty">{o}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader title="Actions due" icon={<CalendarClock className="size-4" />} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-5 py-2 font-medium">Action</th>
                <th className="px-5 py-2 font-medium">Owner</th>
                <th className="px-5 py-2 font-medium">Due</th>
                <th className="px-5 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {review.actionsDue.map((a) => (
                <tr key={a.title} className="border-b border-border last:border-0">
                  <td className="px-5 py-3 font-medium text-pretty">{a.title}</td>
                  <td className="px-5 py-3 text-muted-foreground">{a.owner}</td>
                  <td className="px-5 py-3 font-mono text-xs">{a.due}</td>
                  <td className="px-5 py-3">{a.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <div className="flex items-center gap-2 border-b border-border px-5 py-3">
            <ShieldAlert className="size-4 text-escalated" />
            <p className="text-sm font-semibold">Escalations</p>
          </div>
          <ul className="divide-y divide-border">
            {review.escalations.map((e, i) => (
              <li key={i} className="px-5 py-3 text-sm text-pretty">{e}</li>
            ))}
          </ul>
        </Card>
        <Card>
          <div className="flex items-center gap-2 border-b border-border px-5 py-3">
            <CircleHelp className="size-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Confidence notes</p>
          </div>
          <ul className="divide-y divide-border">
            {review.confidenceNotes.map((c, i) => (
              <li key={i} className="px-5 py-3 text-sm text-muted-foreground text-pretty">{c}</li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}

function TrendChart() {
  const w = 560
  const h = 180
  const pad = 28
  const max = 100
  const min = 75
  const pts = attendanceTrend
  const x = (i: number) => pad + (i * (w - pad * 2)) / (pts.length - 1)
  const y = (v: number) => pad + ((max - v) / (max - min)) * (h - pad * 2)
  const line = (key: "reported" | "observed") =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p[key])}`).join(" ")

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full min-w-[420px]" role="img" aria-label="Attendance trend: reported versus evidence-supported over six weeks">
        {[80, 90, 100].map((g) => (
          <g key={g}>
            <line x1={pad} x2={w - pad} y1={y(g)} y2={y(g)} className="stroke-border" strokeDasharray="3 3" />
            <text x={4} y={y(g) + 4} className="fill-muted-foreground text-[10px]">{g}</text>
          </g>
        ))}
        <path d={line("reported")} fill="none" className="stroke-chart-1" strokeWidth={2.5} />
        <path d={line("observed")} fill="none" className="stroke-attention" strokeWidth={2.5} />
        {pts.map((p, i) => (
          <g key={p.label}>
            <circle cx={x(i)} cy={y(p.reported)} r={3} className="fill-chart-1" />
            <circle cx={x(i)} cy={y(p.observed)} r={3} className="fill-attention" />
            <text x={x(i)} y={h - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">{p.label}</text>
          </g>
        ))}
      </svg>
      <div className="mt-2 flex items-center gap-4 text-xs">
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 bg-chart-1" /> Reported</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 bg-attention" /> Evidence-supported</span>
      </div>
    </div>
  )
}
