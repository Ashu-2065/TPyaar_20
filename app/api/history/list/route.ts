import { getSupabaseServerClient } from "@/lib/supabase/server"

export const maxDuration = 60
const QUOTA_BYTES = 100 * 1024 * 1024

export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization") || ""
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined
    if (!token) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    const supabase = getSupabaseServerClient(token)
    const { data: userRes, error: uErr } = await supabase.auth.getUser()
    if (uErr || !userRes.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    const userId = userRes.user.id

    const { data: sessions, error: sErr } = await supabase
      .from("chat_sessions")
      .select("id,title,created_at,updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
    if (sErr) return new Response(JSON.stringify({ error: sErr.message }), { status: 400 })

    // Fetch contents to compute per-session bytes (approx)
    const { data: msgs, error: mErr } = await supabase
      .from("chat_messages")
      .select("session_id,content")
      .eq("user_id", userId)
    if (mErr) return new Response(JSON.stringify({ error: mErr.message }), { status: 400 })

    const sizeBySession = new Map<string, number>()
    let total = 0
    for (const m of msgs || []) {
      const b = Buffer.byteLength(m.content || "", "utf8")
      total += b
      sizeBySession.set(m.session_id as string, (sizeBySession.get(m.session_id as string) || 0) + b)
    }

    const list = (sessions || []).map((s) => ({
      id: s.id,
      title: s.title,
      created_at: s.created_at,
      updated_at: s.updated_at,
      size_bytes: sizeBySession.get(s.id as string) || 0,
    }))

    return new Response(JSON.stringify({ sessions: list, total_bytes: total, limit: QUOTA_BYTES }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 400 })
  }
}
