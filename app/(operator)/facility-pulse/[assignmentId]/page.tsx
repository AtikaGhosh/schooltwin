import { FacilityPulseView } from '@/components/schooltwin/facility-pulse-view'

export default async function FacilityPulsePage({
  params,
}: {
  params: Promise<{ assignmentId: string }>
}) {
  const { assignmentId } = await params
  return <FacilityPulseView assignmentId={assignmentId} />
}
