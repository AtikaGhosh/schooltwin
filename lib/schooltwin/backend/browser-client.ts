'use client'

import { createBrowserClient } from '@supabase/ssr'
import { FunctionRegion, type SupabaseClient } from '@supabase/supabase-js'

import { getPublicSupabaseConfig } from './config'
import type { Database } from './database.types'

let client: SupabaseClient<Database> | null = null

export function getSupabaseBrowserClient(): SupabaseClient<Database> {
  if (!client) {
    const config = getPublicSupabaseConfig()
    client = createBrowserClient<Database>(config.url, config.publishableKey, {
      global: {
        headers: { 'x-schooltwin-client': 'school-collection-web' },
      },
    })
  }
  return client
}

export async function invokeMumbai<T>(
  name: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await getSupabaseBrowserClient().functions.invoke<T>(
    name,
    {
      body,
      region: FunctionRegion.ApSouth1,
    },
  )

  if (error) {
    throw new Error(await readFunctionError(error))
  }
  if (data === null) {
    throw new Error('empty_backend_response')
  }
  return data
}

async function readFunctionError(error: unknown): Promise<string> {
  if (
    error &&
    typeof error === 'object' &&
    'context' in error &&
    error.context instanceof Response
  ) {
    try {
      const body = (await error.context.clone().json()) as { error?: unknown }
      if (typeof body.error === 'string') return body.error
    } catch {
      // Fall back to the SDK error message.
    }
  }
  return error instanceof Error ? error.message : 'backend_request_failed'
}
