'use client'

import { useEffect, useState } from 'react'

import { useSchoolTwin } from '@/components/providers/schooltwin-provider'
import type { OperatorSubmissionView } from '@/lib/schooltwin/domain/privacy'
import type { OperatorDailyCoverageView } from '@/lib/schooltwin/domain/daily-coverage'
import {
  toTodayWorkView,
  type TodayWorkView,
} from '@/lib/schooltwin/domain/today-work'
import type {
  School,
  SchoolArea,
  Section,
  VerificationTask,
} from '@/lib/schooltwin/domain/types'

export interface WorkspaceSnapshot {
  school: School
  areas: SchoolArea[]
  sections: Section[]
  tasks: VerificationTask[]
  submissions: OperatorSubmissionView[]
  coverage: OperatorDailyCoverageView
  work: TodayWorkView
}

interface WorkspaceState {
  data: WorkspaceSnapshot | null
  loading: boolean
  error: string | null
}

export function useWorkspace(): WorkspaceState {
  const { repository, clock, ready, revision } = useSchoolTwin()
  const [state, setState] = useState<WorkspaceState>({
    data: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    if (!ready) return
    let active = true

    Promise.all([
      repository.getSchool(),
      repository.getAreas(),
      repository.getSections(),
      repository.getTasks(clock.now()),
      repository.getOperatorSubmissions(),
      repository.getOperatorDailyCoverage(clock.now()),
    ])
      .then(([school, areas, sections, tasks, submissions, coverage]) => {
        if (active) {
          const work = toTodayWorkView({
            coverage,
            tasks,
            now: clock.now(),
            areaNames: Object.fromEntries(
              areas.map((area) => [area.id, area.name]),
            ),
          })
          setState({
            data: {
              school,
              areas,
              sections,
              tasks,
              submissions,
              coverage,
              work,
            },
            loading: false,
            error: null,
          })
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setState({
            data: null,
            loading: false,
            error:
              cause instanceof Error
                ? cause.message
                : 'The local prototype data could not be loaded.',
          })
        }
      })

    return () => {
      active = false
    }
  }, [repository, clock, ready, revision])

  return state
}
