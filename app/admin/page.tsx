import { AdminConsole } from '@/components/backend/admin-console'

export default function AdminPage() {
  return (
    <div>
      <h1 className="text-3xl font-semibold">Pilot setup</h1>
      <p className="text-muted-foreground mt-2 mb-8 max-w-2xl text-sm leading-6">
        Manage schools, accounts, paired devices, and printed passes. Protected
        answers and private reports are never shown here.
      </p>
      <AdminConsole />
    </div>
  )
}
