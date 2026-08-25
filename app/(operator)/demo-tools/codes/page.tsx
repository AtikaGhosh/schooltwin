import { notFound } from 'next/navigation'

import { DemoCodeTools } from '@/components/schooltwin/demo-code-tools'
import { isProductionMode } from '@/lib/schooltwin/backend/config'

export default function DemoCodesPage() {
  if (isProductionMode()) notFound()
  return <DemoCodeTools />
}
