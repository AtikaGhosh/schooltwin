import Link from 'next/link'
import type { ReactNode } from 'react'

import { requireAdminAccount } from '@/lib/schooltwin/backend/auth'

export default async function AdminLayout({
  children,
}: {
  children: ReactNode
}) {
  const account = await requireAdminAccount()
  return (
    <div className="bg-background min-h-dvh">
      <header className="border-border bg-card border-b">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div>
            <p className="font-semibold">SchoolTwin setup</p>
            <p className="text-muted-foreground text-xs">
              {account.displayName}
            </p>
          </div>
          <Link href="/home" className="text-primary text-sm font-semibold">
            School workspace
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-8">{children}</main>
    </div>
  )
}
