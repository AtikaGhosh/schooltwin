import {
  Building2,
  UserRound,
  Radar,
  MessageSquareWarning,
  Users,
  BadgeCheck,
  Cpu,
  FileText,
} from "lucide-react"
import type { SignalSource } from "@/lib/types"

const meta: Record<SignalSource, { label: string; icon: typeof Building2 }> = {
  headmaster: { label: "Headmaster", icon: Building2 },
  teacher: { label: "Teacher", icon: UserRound },
  "student-pulse": { label: "Student Pulse", icon: Radar },
  "student-report": { label: "Student report", icon: MessageSquareWarning },
  parent: { label: "Parent", icon: Users },
  inspector: { label: "Inspector", icon: BadgeCheck },
  system: { label: "System", icon: Cpu },
  record: { label: "Record", icon: FileText },
}

export function sourceLabel(source: SignalSource) {
  const m = meta[source]
  const Icon = m.icon
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <Icon className="size-3.5" />
      {m.label}
    </span>
  )
}
