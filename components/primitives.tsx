import type { ReactNode } from 'react'

import {
  AlertCircle,
  CheckCircle2,
  CircleDashed,
  Clock3,
  LoaderCircle,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import type { DerivedTaskStatus } from '@/lib/schooltwin/domain/types'

export function Card({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'elevated-surface border-border/80 text-card-foreground rounded-[0.875rem] border',
        className,
      )}
    >
      {children}
    </section>
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
    <header className="flex items-start justify-between gap-4 px-5 pt-5 pb-3 sm:px-6 sm:pt-6">
      <div className="flex items-start gap-3">
        {icon ? (
          <span className="bg-muted text-muted-foreground mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg">
            {icon}
          </span>
        ) : null}
        <div>
          <h2 className="text-base font-semibold text-pretty sm:text-lg">
            {title}
          </h2>
          {subtitle ? (
            <p className="text-muted-foreground mt-0.5 text-xs text-pretty">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {action}
    </header>
  )
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div>
        {eyebrow ? (
          <p className="text-muted-foreground text-sm font-medium">{eyebrow}</p>
        ) : null}
        <h1 className="mt-1 text-[1.45rem] leading-tight font-semibold tracking-[-0.025em] text-balance sm:text-[1.7rem] lg:text-[2rem]">
          {title}
        </h1>
        {description ? (
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6 text-pretty">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  )
}

const taskStatusMeta: Record<
  DerivedTaskStatus,
  { label: string; className: string; icon: typeof Clock3 }
> = {
  scheduled: {
    label: 'Not open yet',
    className: 'status-later',
    icon: Clock3,
  },
  available: {
    label: 'Do now',
    className: 'status-now',
    icon: Clock3,
  },
  in_progress: {
    label: 'In progress',
    className: 'bg-watch/15 text-watch-foreground',
    icon: LoaderCircle,
  },
  submitted: {
    label: 'Done',
    className: 'status-done',
    icon: CheckCircle2,
  },
  missed: {
    label: 'Not done',
    className: 'status-missed',
    icon: AlertCircle,
  },
  failed: {
    label: 'Not done',
    className: 'status-missed',
    icon: AlertCircle,
  },
}

export function TaskStatusBadge({ status }: { status: DerivedTaskStatus }) {
  const meta = taskStatusMeta[status]
  const Icon = meta.icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        meta.className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {meta.label}
    </span>
  )
}

export function LoadingState({
  label = 'Loading workspace…',
}: {
  label?: string
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="surface-shadow border-border/70 bg-card min-h-48 rounded-xl border p-6"
    >
      <p className="text-muted-foreground text-xs font-semibold">{label}</p>
      <div aria-hidden className="mt-6 space-y-4">
        <div className="skeleton h-5 w-2/5 rounded-md" />
        <div className="skeleton h-3 w-full rounded-md" />
        <div className="skeleton h-3 w-4/5 rounded-md" />
      </div>
    </div>
  )
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="border-destructive/30 bg-destructive/5 rounded-xl border p-5"
    >
      <p className="text-destructive flex items-center gap-2 text-sm font-semibold">
        <AlertCircle className="size-4" /> Local workspace unavailable
      </p>
      <p className="text-muted-foreground mt-1 text-sm">{message}</p>
    </div>
  )
}

export function EmptyState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="border-border bg-card rounded-xl border border-dashed p-8 text-center">
      <span className="bg-accent text-accent-foreground mx-auto flex size-10 items-center justify-center rounded-xl">
        <CircleDashed className="size-5" aria-hidden />
      </span>
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm text-pretty">
        {description}
      </p>
    </div>
  )
}

export function PrototypeNotice({ children }: { children: ReactNode }) {
  return (
    <div className="border-primary/20 bg-primary/5 text-muted-foreground rounded-lg border px-4 py-3 text-xs leading-5">
      {children}
    </div>
  )
}
