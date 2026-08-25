'use client'

import Link from 'next/link'
import { CheckCircle2, MapPin, Search } from 'lucide-react'

import { Card, PageHeader, PrototypeNotice } from '@/components/primitives'

export function SetupView() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Prototype pairing demonstration"
        title="Pair a school workspace"
        description="The Sundarpur demo is already paired. This page illustrates a future installation flow and is not government authentication."
      />
      <PrototypeNotice>
        Pairing in this frontend prototype establishes local demo context only.
      </PrototypeNotice>
      <Card className="mx-auto max-w-2xl p-6">
        <ol className="space-y-5">
          <Step
            icon={<Search className="size-4" />}
            title="Search school"
            description="Find a matching fictional school and location."
          />
          <Step
            icon={<MapPin className="size-4" />}
            title="Review identity"
            description="Confirm name, district, state, and DrishtiShala ID."
          />
          <Step
            icon={<CheckCircle2 className="size-4" />}
            title="Pair installation"
            description="Store the selected prototype workspace in this browser."
          />
        </ol>
        <div className="border-border bg-muted/40 mt-6 rounded-lg border p-4">
          <p className="text-sm font-semibold">
            Sundarpur Government High School
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            ST-OD-1048 · Sundarpur, Odisha
          </p>
          <p className="text-primary mt-3 text-xs font-medium">
            Already paired for this hackathon demo
          </p>
        </div>
        <Link
          href="/home"
          className="primary-action mt-6 inline-flex rounded-lg px-4 py-2.5 text-sm font-semibold"
        >
          Return to workspace
        </Link>
      </Card>
    </div>
  )
}

function Step({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <li className="flex gap-3">
      <span className="bg-accent text-accent-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
        {icon}
      </span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
      </div>
    </li>
  )
}
