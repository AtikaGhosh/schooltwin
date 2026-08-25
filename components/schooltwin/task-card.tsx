import Link from 'next/link'
import { ArrowRight, Camera, MessageCircle } from 'lucide-react'

import { Card, TaskStatusBadge } from '@/components/primitives'
import { deriveTaskStatus } from '@/lib/schooltwin/domain/task-state'
import type { VerificationTask } from '@/lib/schooltwin/domain/types'

export function TaskCard({ task, now }: { task: VerificationTask; now: Date }) {
  const status = deriveTaskStatus(task, now)
  const Icon = task.type === 'live_evidence' ? Camera : MessageCircle

  return (
    <Card className="overflow-hidden">
      <Link
        href={`/tasks/${task.id}`}
        className="group hover:bg-accent/30 focus-visible:ring-ring flex min-h-32 items-start gap-4 p-5 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
      >
        <span className="bg-accent text-accent-foreground flex size-10 shrink-0 items-center justify-center rounded-lg">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="text-sm font-semibold text-pretty">{task.title}</h2>
            <TaskStatusBadge status={status} />
          </div>
          <p className="text-muted-foreground mt-2 text-xs leading-5 text-pretty">
            {task.instructions}
          </p>
          <p className="text-muted-foreground mt-2 font-mono text-[11px]">
            {formatTaskWindow(task)}
          </p>
        </div>
        <ArrowRight className="text-muted-foreground mt-3 size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </Card>
  )
}

export function formatTaskWindow(task: VerificationTask): string {
  const formatter = new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${formatter.format(new Date(task.scheduledStart))}–${formatter.format(new Date(task.scheduledEnd))}`
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}
