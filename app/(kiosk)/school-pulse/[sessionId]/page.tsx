import { ClassPulseView } from '@/components/schooltwin/class-pulse-view'

export default async function SchoolPulsePage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params
  return <ClassPulseView sessionId={sessionId} />
}
