import { StudentPulseWorkflow } from '@/components/schooltwin/kiosk-workflow'

export default async function PulseSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params
  return <StudentPulseWorkflow sessionId={sessionId} />
}
