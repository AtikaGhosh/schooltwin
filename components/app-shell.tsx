"use client"

import { useEffect } from "react"
import {
  Activity,
  ClipboardCheck,
  Radar,
  ListChecks,
  CalendarClock,
  LayoutDashboard,
  MessageSquareText,
  History,
  MessageSquareWarning,
  UserRound,
  GraduationCap,
  ShieldCheck,
  Building2,
  BadgeCheck,
  Waypoints,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useStore } from "@/lib/store"
import type { Role } from "@/lib/types"
import { schools } from "@/lib/data"

import { SchoolTwinView } from "@/components/views/school-twin"
import { EvidenceRealityView } from "@/components/views/evidence-reality"
import { IssuesActionsView } from "@/components/views/issues-actions"
import { StudentPulseView } from "@/components/views/student-pulse"
import { StudentRecordsView } from "@/components/views/student-records"
import { ReportIssueView } from "@/components/views/report-issue"
import { TeacherUpdateView } from "@/components/views/teacher-update"
import { WeeklyIntelligenceView } from "@/components/views/weekly-intelligence"
import { AuthorityDashboardView } from "@/components/views/authority-dashboard"
import { AskSchoolTwinView } from "@/components/views/ask-schooltwin"
import { SchoolMemoryView } from "@/components/views/school-memory"
import { InspectorQueueView } from "@/components/views/inspector-queue"

interface NavItem {
  id: string
  label: string
  icon: typeof Activity
}

const navByRole: Record<Role, NavItem[]> = {
  student: [
    { id: "pulse", label: "Daily School Pulse", icon: Radar },
    { id: "records", label: "My Records", icon: ClipboardCheck },
    { id: "report", label: "Report Something Wrong", icon: MessageSquareWarning },
  ],
  teacher: [
    { id: "teacher-update", label: "Daily Update", icon: ClipboardCheck },
    { id: "issues", label: "Issues & Actions", icon: ListChecks },
    { id: "twin", label: "School Twin", icon: Activity },
  ],
  headmaster: [
    { id: "twin", label: "School Digital Twin", icon: Activity },
    { id: "evidence", label: "Evidence & Reality", icon: Radar },
    { id: "issues", label: "Issues & Actions", icon: ListChecks },
    { id: "weekly", label: "Weekly Intelligence", icon: CalendarClock },
    { id: "memory", label: "School Memory", icon: History },
  ],
  inspector: [
    { id: "inspector", label: "Verification Queue", icon: BadgeCheck },
    { id: "evidence", label: "Evidence & Reality", icon: Radar },
  ],
  authority: [
    { id: "district", label: "District Dashboard", icon: LayoutDashboard },
    { id: "twin", label: "School Digital Twin", icon: Activity },
    { id: "weekly", label: "Weekly Intelligence", icon: CalendarClock },
    { id: "ask", label: "Ask SchoolTwin", icon: MessageSquareText },
  ],
}

const roles: { id: Role; label: string; icon: typeof Activity; blurb: string }[] = [
  { id: "student", label: "Student", icon: GraduationCap, blurb: "Independent reality contributor" },
  { id: "teacher", label: "Teacher", icon: UserRound, blurb: "Reports one evidence source" },
  { id: "headmaster", label: "Headmaster", icon: Building2, blurb: "Manages school workspace" },
  { id: "inspector", label: "Inspector", icon: BadgeCheck, blurb: "High-trust verification" },
  { id: "authority", label: "District Authority", icon: ShieldCheck, blurb: "Cross-school oversight" },
]

export function AppShell() {
  const { role, setRole, view, setView } = useStore()
  const nav = navByRole[role]

  // Keep the active view valid whenever the role changes.
  useEffect(() => {
    if (!nav.some((n) => n.id === view)) setView(nav[0].id)
  }, [role]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar nav={nav} view={view} setView={setView} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar role={role} setRole={setRole} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">
          <ViewRouter view={view} />
        </main>
      </div>
    </div>
  )
}

function Sidebar({
  nav,
  view,
  setView,
}: {
  nav: NavItem[]
  view: string
  setView: (v: string) => void
}) {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <Waypoints className="size-5" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold">SchoolTwin</p>
          <p className="text-[11px] text-sidebar-foreground/60">Evidence & Accountability</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-2">
        {nav.map((item) => {
          const Icon = item.icon
          const active = view === item.id
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="text-pretty text-left">{item.label}</span>
            </button>
          )
        })}
      </nav>
      <div className="border-t border-sidebar-border px-5 py-4">
        <p className="text-[11px] leading-relaxed text-sidebar-foreground/55 text-pretty">
          No single actor controls the truth. SchoolTwin corroborates independent signals over time.
        </p>
      </div>
    </aside>
  )
}

function TopBar({ role, setRole }: { role: Role; setRole: (r: Role) => void }) {
  const { schoolId, setSchoolId, view } = useStore()
  const showSchoolPicker = view === "twin" || view === "evidence" || view === "issues" || view === "weekly" || view === "memory"
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-8">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <span className="mr-1 hidden text-xs font-medium text-muted-foreground sm:inline">
            View as
          </span>
          {roles.map((r) => {
            const Icon = r.icon
            const active = role === r.id
            return (
              <button
                key={r.id}
                onClick={() => setRole(r.id)}
                title={r.blurb}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" />
                {r.label}
              </button>
            )
          })}
        </div>
        {showSchoolPicker ? (
          <div className="flex items-center gap-2">
            <label htmlFor="school" className="text-xs text-muted-foreground">
              School
            </label>
            <select
              id="school"
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              className="max-w-[220px] truncate rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium outline-none focus:ring-2 focus:ring-ring"
            >
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
    </header>
  )
}

function ViewRouter({ view }: { view: string }) {
  switch (view) {
    case "twin":
      return <SchoolTwinView />
    case "evidence":
      return <EvidenceRealityView />
    case "issues":
      return <IssuesActionsView />
    case "pulse":
      return <StudentPulseView />
    case "records":
      return <StudentRecordsView />
    case "report":
      return <ReportIssueView />
    case "teacher-update":
      return <TeacherUpdateView />
    case "weekly":
      return <WeeklyIntelligenceView />
    case "district":
      return <AuthorityDashboardView />
    case "ask":
      return <AskSchoolTwinView />
    case "memory":
      return <SchoolMemoryView />
    case "inspector":
      return <InspectorQueueView />
    default:
      return <SchoolTwinView />
  }
}
