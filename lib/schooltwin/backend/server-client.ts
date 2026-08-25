import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { getPublicSupabaseConfig } from './config'
import type { Database } from './database.types'

export async function getSupabaseServerClient() {
  const config = getPublicSupabaseConfig()
  const cookieStore = await cookies()

  return createServerClient<Database>(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(items) {
        try {
          for (const item of items) {
            cookieStore.set(item.name, item.value, item.options)
          }
        } catch {
          // Server Components cannot always write cookies. proxy.ts refreshes them.
        }
      },
    },
  })
}
