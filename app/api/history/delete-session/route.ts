import { getSupabaseServerClient } from "@/lib/supabase/server"

export const maxDuration = 60

type Body = { sessionId: string }

export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") || ""
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined
    if (!token) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    const supabase = getSupabaseServerClient(token)
    const { data: userRes } = await supabase.auth.getUser()
    const userId = userRes.user!.id

    const { sessionId } = (await req.json()) as Body
    if (!sessionId) return new Response(JSON.stringify({ error: "Missing sessionId" }), { status: 400 })

    // Compute bytes to subtract
    const { data: msgs } = await supabase
      .from("chat_messages")
      .select("content")
      .eq("user_id", userId)
      .eq("session_id", sessionId)
    const bytes = (msgs || []).reduce((sum, m) => sum + Buffer.byteLength(m.content || "", "utf8"), 0)

    // Delete messages, then session
    await supabase.from("chat_messages").delete().eq("user_id", userId).eq("session_id", sessionId)
    await supabase.from("chat_sessions").delete().eq("user_id", userId).eq("id", sessionId)

    // Decrement usage
    const { data: usageRow } = await supabase
      .from("user_usage")
      .select("total_bytes")
      .eq("user_id", userId)
      .maybeSingle()
    const current = usageRow?.total_bytes || 0
    const next = Math.max(0, current - bytes)
    if (usageRow) {
      await supabase.from("user_usage").update({ total_bytes: next }).eq("user_id", userId)
    } else {
      await supabase.from("user_usage").insert({ user_id: userId, total_bytes: next })
    }

    return new Response(JSON.stringify({ ok: true, freed_bytes: bytes, now: next }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 400 })
  }
}
