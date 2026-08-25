import type { ReactNode } from 'react'

import { KioskShell } from '@/components/kiosk-shell'

export default function KioskLayout({ children }: { children: ReactNode }) {
  return <KioskShell>{children}</KioskShell>
}
