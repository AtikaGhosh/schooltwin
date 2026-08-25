import { TwinAreaView } from '@/components/schooltwin/twin-view'

export default async function TwinAreaPage({
  params,
}: {
  params: Promise<{ areaId: string }>
}) {
  const { areaId } = await params
  return <TwinAreaView areaId={areaId} />
}
