import type { ReactNode } from 'react'

import { OperatorShell } from '@/components/operator-shell'

export default function OperatorLayout({ children }: { children: ReactNode }) {
  return <OperatorShell>{children}</OperatorShell>
}
