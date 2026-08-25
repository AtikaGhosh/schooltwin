import { LoginForm } from '@/components/backend/login-form'
import { Card } from '@/components/primitives'
import { isProductionMode } from '@/lib/schooltwin/backend/config'

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center px-5 py-12">
      <Card className="w-full p-7">
        <p className="text-primary text-sm font-semibold">DrishtiShala</p>
        <h1 className="mt-2 text-2xl font-semibold">School operator sign in</h1>
        <p className="text-muted-foreground mt-2 mb-7 text-sm leading-6">
          Use the named account provided by your field coordinator.
        </p>
        {isProductionMode() ? (
          <LoginForm />
        ) : (
          <p className="bg-muted rounded-lg p-4 text-sm">
            Sign-in is disabled in demo mode. Open the pre-paired demo
            workspace.
          </p>
        )}
      </Card>
    </main>
  )
}
