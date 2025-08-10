import { createClient, type SupabaseClient } from "@supabase/supabase-js"

export function getSupabaseServerClient(accessToken?: string) {
  const url = process.env.SUPABASE_URL as string
  const anon = process.env.SUPABASE_ANON_KEY as string
  if (!url || !anon) {
    console.warn("Supabase server env vars missing: SUPABASE_URL / SUPABASE_ANON_KEY")
  }
  const client: SupabaseClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  if (accessToken) {
    // Attach the user's access token so RLS policies run as that user
    // (supabase-js v2)
    // @ts-expect-error
    client.auth.setAuth(accessToken)
  }
  return client
}
