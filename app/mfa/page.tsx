import { Card } from '@/components/primitives'
import { MfaSetup } from '@/components/backend/mfa-setup'
import { requireAccount } from '@/lib/schooltwin/backend/auth'

export default async function MfaPage() {
  const account = await requireAccount()
  return (
    <main className="mx-auto max-w-lg px-5 py-12">
      <Card className="p-7">
        <h1 className="text-2xl font-semibold">
          Two-step verification required
        </h1>
        <p className="text-muted-foreground mt-3 text-sm leading-6">
          {account.displayName}, administrators and field coordinators must
          complete authenticator-app verification before using setup tools.
          Enrol or verify an authenticator through the pilot account recovery
          process.
        </p>
        <MfaSetup />
      </Card>
    </main>
  )
}
