import { PrivateReportView } from '@/components/schooltwin/report-views'

export default async function PrivateReportPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params
  return <PrivateReportView sessionId={sessionId} />
}
