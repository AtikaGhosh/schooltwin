"use client"

import {
  Droplets,
  Users,
  UtensilsCrossed,
  School,
  DoorClosed,
  MonitorSmartphone,
  AlertTriangle,
  Activity,
} from "lucide-react"
import { useStore } from "@/lib/store"
import { schools, claims, issues, signals } from "@/lib/data"
import {
  Card,
  CardHeader,
  StatusPill,
  ConfidencePill,
  RealityGapPill,
  DualBar,
} from "@/components/primitives"
import { sourceLabel } from "@/components/source-label"

export function SchoolTwinView() {
  const { schoolId } = useStore()
  const school = schools.find((s) => s.id === schoolId) ?? schools[0]
  const schoolClaims = claims.filter((c) => c.schoolId === schoolId)
  const schoolIssues = issues.filter((i) => i.schoolId === schoolId)
  const recent = signals.filter((s) => s.schoolId === schoolId).slice(0, 6)

  return (
    <div className="space-y-6">
      {/* Identity */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            School Digital Twin
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-balance">
            {school.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            UDISE {school.udise} · {school.block} Block · {school.cluster} · {school.district}
          </p>
        </div>
        <StatusPill status={school.status} className="text-sm" />
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Students" value={school.students} icon={<Users className="size-4" />} />
        <Stat label="Teachers" value={school.teachers} icon={<School className="size-4" />} />
        <Stat label="Open issues" value={school.openIssues} icon={<AlertTriangle className="size-4" />} />
        <Stat
          label="Last signal"
          value={school.lastSignalDaysAgo === 0 ? "Today" : `${school.lastSignalDaysAgo}d ago`}
          icon={<Activity className="size-4" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Domains */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader
              title="Attendance"
              subtitle="Reported vs evidence-supported estimate"
              icon={<Users className="size-4" />}
              action={<RealityGapPill gap={school.attendanceReported - school.attendanceObserved > 10 ? "persistent" : "minor"} />}
            />
            <div className="p-5">
              <DualBar reported={school.attendanceReported} observed={school.attendanceObserved} />
            </div>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <DomainCard icon={<Droplets className="size-4" />} title="Drinking Water" state="Failure confirmed" tone="bad" note="Pump failure · 9 of 12 days" />
            <DomainCard icon={<UtensilsCrossed className="size-4" />} title="Midday Meal" state="Served" tone="good" note="Confirmed 15/16 students" />
            <DomainCard icon={<DoorClosed className="size-4" />} title="Girls' Toilet" state="Door broken" tone="warn" note="Access affected · repair in progress" />
            <DomainCard icon={<MonitorSmartphone className="size-4" />} title="Computer Lab" state="No activity 31d" tone="warn" note="Verification requested" />
          </div>

          {/* Claims table */}
          <Card>
            <CardHeader title="Evidence-backed claims" subtitle="Reported ≠ Observed ≠ Verified" icon={<Activity className="size-4" />} />
            <div className="divide-y divide-border">
              {schoolClaims.length === 0 ? (
                <Empty />
              ) : (
                schoolClaims.map((c) => (
                  <div key={c.id} className="grid grid-cols-1 gap-2 px-5 py-4 sm:grid-cols-[1fr_auto]">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{c.subject}</p>
                        <span className="text-xs text-muted-foreground">{c.domain}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                        <Cell label="Reported" value={c.reportedState} />
                        <Cell label="Observed" value={c.observedState} />
                        <Cell label="Verified" value={c.verifiedState} />
                      </div>
                    </div>
                    <div className="flex flex-row items-center gap-2 sm:flex-col sm:items-end">
                      <ConfidencePill confidence={c.confidence} />
                      <RealityGapPill gap={c.realityGap} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Side column */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="Active issues" icon={<AlertTriangle className="size-4" />} />
            <div className="divide-y divide-border">
              {schoolIssues.length === 0 ? (
                <Empty />
              ) : (
                schoolIssues.map((i) => (
                  <div key={i.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-pretty">{i.title}</p>
                      <span className="font-mono text-[11px] text-muted-foreground">{i.id}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {i.owner} · impact {i.studentImpact} · due {i.deadline}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Recent signals" subtitle="Independent observations" icon={<Activity className="size-4" />} />
            <div className="divide-y divide-border">
              {recent.length === 0 ? (
                <Empty />
              ) : (
                recent.map((s) => (
                  <div key={s.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      {sourceLabel(s.source)}
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(s.timestamp).toLocaleDateString([], { month: "short", day: "numeric" })}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-foreground">{s.value}</p>
                    {s.note ? <p className="mt-0.5 text-[11px] text-muted-foreground">{s.note}</p> : null}
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </Card>
  )
}

function DomainCard({
  icon,
  title,
  state,
  note,
  tone,
}: {
  icon: React.ReactNode
  title: string
  state: string
  note: string
  tone: "good" | "warn" | "bad"
}) {
  const toneCls =
    tone === "good"
      ? "text-stable"
      : tone === "warn"
        ? "text-attention"
        : "text-escalated"
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium">{title}</span>
      </div>
      <p className={`mt-2 text-sm font-semibold ${toneCls}`}>{state}</p>
      <p className="mt-1 text-xs text-muted-foreground text-pretty">{note}</p>
    </Card>
  )
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/60 px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xs font-medium text-pretty">{value}</p>
    </div>
  )
}

function Empty() {
  return (
    <p className="px-5 py-6 text-center text-xs text-muted-foreground">
      Detailed signal data is populated for the demo focus school (Govt Primary School, Rampur).
    </p>
  )
}
