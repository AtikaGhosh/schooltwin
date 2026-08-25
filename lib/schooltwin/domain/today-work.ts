import type { OperatorDailyCoverageView } from './daily-coverage'
import { deriveTaskStatus } from './task-state'
import type { DerivedTaskStatus, VerificationTask } from './types'

export type TodayWorkKind =
  'class_check' | 'class_video' | 'facility_check' | 'facility_video'
export type TodayWorkStatus = 'done' | 'do_now' | 'not_open_yet' | 'not_done'

export interface TodayWorkItem {
  id: string
  kind: TodayWorkKind
  status: TodayWorkStatus
  inProgress?: boolean
  sectionId?: string
  sectionName?: string
  areaId?: string
  areaName?: string
  scheduledStart: string
  scheduledEnd: string
  href: string
}

export interface TodayWorkView {
  total: number
  completed: number
  doNow: TodayWorkItem[]
  notOpenYet: TodayWorkItem[]
  notDone: TodayWorkItem[]
  done: TodayWorkItem[]
  remaining: number
  stillToDo: number
  next: TodayWorkItem | null
}

export function toTodayWorkView(input: {
  coverage: OperatorDailyCoverageView
  tasks: VerificationTask[]
  now: Date
  areaNames?: Record<string, string>
}): TodayWorkView {
  const items: TodayWorkItem[] = []
  for (const row of input.coverage.rows) {
    items.push({
      id: row.classPulse.assignmentId,
      kind: 'class_check',
      status: toWorkStatus(row.classPulse.status),
      inProgress: row.classPulse.status === 'in_progress',
      sectionId: row.sectionId,
      sectionName: row.sectionName,
      scheduledStart: row.classPulse.scheduledStart,
      scheduledEnd: row.classPulse.scheduledEnd,
      href: `/school-pulse/${row.classPulse.sessionId}`,
    })
  }
  for (const task of input.tasks.filter(
    (item) => item.type === 'live_evidence',
  )) {
    const isClass = task.liveEvidenceScope === 'class'
    const row = input.coverage.rows.find(
      (item) => item.sectionId === task.sectionId,
    )
    const derivedStatus = deriveTaskStatus(task, input.now)
    items.push({
      id: task.id,
      kind: isClass ? 'class_video' : 'facility_video',
      status: toWorkStatus(derivedStatus),
      inProgress: derivedStatus === 'in_progress',
      sectionId: task.sectionId,
      sectionName: row?.sectionName,
      areaId: task.areaId,
      areaName: task.areaId ? input.areaNames?.[task.areaId] : undefined,
      scheduledStart: task.scheduledStart,
      scheduledEnd: task.scheduledEnd,
      href: `/capture/${task.id}`,
    })
  }
  items.push({
    id: input.coverage.facilityPulse.assignmentId,
    kind: 'facility_check',
    status: toWorkStatus(input.coverage.facilityPulse.status),
    inProgress: input.coverage.facilityPulse.status === 'in_progress',
    scheduledStart: input.coverage.facilityPulse.scheduledStart,
    scheduledEnd: input.coverage.facilityPulse.scheduledEnd,
    href: `/facility-pulse/${input.coverage.facilityPulse.assignmentId}`,
  })

  const done = items.filter((item) => item.status === 'done')
  const doNow = items
    .filter((item) => item.status === 'do_now')
    .sort(compareNext)
  const notOpenYet = items
    .filter((item) => item.status === 'not_open_yet')
    .sort((a, b) => Date.parse(a.scheduledStart) - Date.parse(b.scheduledStart))
  const notDone = items.filter((item) => item.status === 'not_done')
  return {
    total: items.length,
    completed: done.length,
    doNow,
    notOpenYet,
    notDone,
    done,
    remaining: doNow.length + notOpenYet.length + notDone.length,
    stillToDo: doNow.length + notOpenYet.length,
    next: doNow[0] ?? null,
  }
}

function toWorkStatus(status: DerivedTaskStatus): TodayWorkStatus {
  if (status === 'submitted') return 'done'
  if (status === 'available' || status === 'in_progress') return 'do_now'
  if (status === 'scheduled') return 'not_open_yet'
  return 'not_done'
}

function compareNext(a: TodayWorkItem, b: TodayWorkItem): number {
  const inProgress = (item: TodayWorkItem) => (item.inProgress ? 0 : 1)
  const progressOrder = inProgress(a) - inProgress(b)
  if (progressOrder) return progressOrder
  const deadline = Date.parse(a.scheduledEnd) - Date.parse(b.scheduledEnd)
  if (deadline) return deadline
  const kindOrder: Record<TodayWorkKind, number> = {
    class_video: 0,
    facility_video: 1,
    class_check: 2,
    facility_check: 3,
  }
  const kind = kindOrder[a.kind] - kindOrder[b.kind]
  if (kind) return kind
  const judgeDemoOrder = demoSectionPriority(a) - demoSectionPriority(b)
  if (judgeDemoOrder) return judgeDemoOrder
  return numericName(a).localeCompare(numericName(b), undefined, {
    numeric: true,
  })
}

function demoSectionPriority(item: TodayWorkItem): number {
  return item.sectionName === 'Class 8A' ? 0 : 1
}

function numericName(item: TodayWorkItem): string {
  return item.sectionName ?? item.areaName ?? item.id
}
