import { PairDeviceForm } from '@/components/backend/pair-device-form'
import { Card } from '@/components/primitives'
import { requireAccount } from '@/lib/schooltwin/backend/auth'

export default async function PairDevicePage() {
  await requireAccount()
  return (
    <main className="mx-auto max-w-xl px-5 py-12">
      <h1 className="text-2xl font-semibold">Pair this school device</h1>
      <p className="text-muted-foreground mt-2 mb-6 text-sm">
        Ask a field coordinator for a one-use pairing code.
      </p>
      <Card className="p-6">
        <PairDeviceForm />
      </Card>
    </main>
  )
}
