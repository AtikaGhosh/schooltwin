import { CaptureView } from '@/components/schooltwin/capture-view'

export default async function CapturePage({
  params,
}: {
  params: Promise<{ taskId: string }>
}) {
  const { taskId } = await params
  return <CaptureView taskId={taskId} />
}
