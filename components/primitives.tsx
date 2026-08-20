import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import type { OperationalStatus, Confidence, RealityGap } from "@/lib/types"

export function Card({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card text-card-foreground shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  subtitle,
  icon,
  action,
}: {
  title: string
  subtitle?: string
  icon?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
      <div className="flex items-start gap-3">
        {icon ? (
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            {icon}
          </span>
        ) : null}
        <div>
          <h3 className="text-sm font-semibold leading-tight text-pretty">{title}</h3>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-muted-foreground text-pretty">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {action}
    </div>
  )
}

const statusMeta: Record<OperationalStatus, { label: string; cls: string }> = {
  stable: { label: "Stable", cls: "bg-stable/15 text-stable border-stable/30" },
  watch: { label: "Watch", cls: "bg-watch/25 text-watch-foreground border-watch/50" },
  attention: {
    label: "Needs Attention",
    cls: "bg-attention/15 text-attention border-attention/40",
  },
  escalated: {
    label: "Escalated",
    cls: "bg-escalated/15 text-escalated border-escalated/40",
  },
}

export function StatusPill({
  status,
  className,
}: {
  status: OperationalStatus
  className?: string
}) {
  const m = statusMeta[status]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        m.cls,
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {m.label}
    </span>
  )
}

const confidenceMeta: Record<Confidence, { label: string; cls: string }> = {
  high: { label: "High confidence", cls: "bg-stable/15 text-stable" },
  medium: { label: "Medium confidence", cls: "bg-watch/25 text-watch-foreground" },
  low: { label: "Low confidence", cls: "bg-attention/15 text-attention" },
  unknown: { label: "Unknown", cls: "bg-muted text-muted-foreground" },
}

export function ConfidencePill({ confidence }: { confidence: Confidence }) {
  const m = confidenceMeta[confidence]
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", m.cls)}>
      {m.label}
    </span>
  )
}

const gapMeta: Record<RealityGap, { label: string; cls: string }> = {
  none: { label: "Aligned", cls: "bg-stable/15 text-stable" },
  minor: { label: "Minor gap", cls: "bg-watch/25 text-watch-foreground" },
  significant: { label: "Significant gap", cls: "bg-attention/15 text-attention" },
  persistent: { label: "Persistent gap", cls: "bg-escalated/15 text-escalated" },
  verify: { label: "Verify", cls: "bg-accent text-accent-foreground" },
}

export function RealityGapPill({ gap }: { gap: RealityGap }) {
  const m = gapMeta[gap]
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", m.cls)}>
      {m.label}
    </span>
  )
}

export function DualBar({
  reported,
  observed,
}: {
  reported: number
  observed: number
}) {
  return (
    <div className="space-y-2">
      <div>
        <div className="mb-1 flex justify-between text-xs">
          <span className="text-muted-foreground">Reported</span>
          <span className="font-mono font-medium">{reported}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-chart-1" style={{ width: `${reported}%` }} />
        </div>
      </div>
      <div>
        <div className="mb-1 flex justify-between text-xs">
          <span className="text-muted-foreground">Evidence-supported</span>
          <span className="font-mono font-medium">{observed}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full",
              reported - observed > 10 ? "bg-attention" : "bg-chart-2",
            )}
            style={{ width: `${observed}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  )
}
