"use client"

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { Role } from "./types"
import { FOCUS_SCHOOL_ID } from "./data"

export interface ActivityEntry {
  id: string
  time: string
  role: Role
  text: string
}

interface StoreValue {
  role: Role
  setRole: (r: Role) => void
  schoolId: string
  setSchoolId: (id: string) => void
  activity: ActivityEntry[]
  addActivity: (role: Role, text: string) => void
  view: string
  setView: (v: string) => void
}

const StoreContext = createContext<StoreValue | null>(null)

function nowLabel() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("headmaster")
  const [schoolId, setSchoolId] = useState<string>(FOCUS_SCHOOL_ID)
  const [view, setView] = useState<string>("twin")
  const [activity, setActivity] = useState<ActivityEntry[]>([
    {
      id: "seed-1",
      time: "11:34",
      role: "student",
      text: "Student Pulse recorded: drinking water reported unavailable.",
    },
    {
      id: "seed-2",
      time: "09:05",
      role: "teacher",
      text: "Class 5 attendance submitted: 38 / 40 present.",
    },
  ])

  function addActivity(r: Role, text: string) {
    setActivity((prev) => [
      { id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, time: nowLabel(), role: r, text },
      ...prev,
    ])
  }

  const value = useMemo<StoreValue>(
    () => ({ role, setRole, schoolId, setSchoolId, activity, addActivity, view, setView }),
    [role, schoolId, activity, view],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error("useStore must be used within StoreProvider")
  return ctx
}
