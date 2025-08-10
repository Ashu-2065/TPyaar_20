import { getSupabaseServerClient } from "@/lib/supabase/server"

export const maxDuration = 60

const QUOTA_BYTES = 100 * 1024 * 1024 // 100 MB

type Body = {
  sessionId?: string
  title?: string
  messages: { role: "user" | "assistant"; content: string }[]
}

export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") || ""
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined
    if (!token) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })

    const supabase = getSupabaseServerClient(token)
    const { data: userRes, error: uErr } = await supabase.auth.getUser()
    if (uErr || !userRes.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    }
    const userId = userRes.user.id

    const body = (await req.json()) as Body
    if (!body?.messages?.length) {
      return new Response(JSON.stringify({ error: "No messages" }), { status: 400 })
    }

    // Compute new bytes
    const newBytes = body.messages.reduce((sum, m) => sum + Buffer.byteLength(m.content || "", "utf8"), 0)

    // Get current usage
    const { data: usageRow } = await supabase
      .from("user_usage")
      .select("total_bytes")
      .eq("user_id", userId)
      .maybeSingle()
    const current = usageRow?.total_bytes || 0
    if (current + newBytes > QUOTA_BYTES) {
      return new Response(
        JSON.stringify({
          error: "Storage full. To continue, delete one of your chat sessions to free up space.",
          usage: current,
          limit: QUOTA_BYTES,
          overBy: current + newBytes - QUOTA_BYTES,
        }),
        { status: 409 },
      )
    }

    let sessionId = body.sessionId
    if (!sessionId) {
      // Create session
      const title = (body.title || body.messages[0]?.content || "New Chat").slice(0, 80)
      const { data: created, error: sErr } = await supabase
        .from("chat_sessions")
        .insert({ user_id: userId, title })
        .select("id")
        .single()
      if (sErr) {
        return new Response(JSON.stringify({ error: sErr.message }), { status: 400 })
      }
      sessionId = created.id as string
    }

    // Insert messages
    const rows = body.messages.map((m) => ({
      session_id: sessionId,
      user_id: userId,
      role: m.role,
      content: m.content,
    }))
    const { error: mErr } = await supabase.from("chat_messages").insert(rows)
    if (mErr) {
      return new Response(JSON.stringify({ error: mErr.message }), { status: 400 })
    }

    // Update usage
    if (usageRow) {
      await supabase
        .from("user_usage")
        .update({ total_bytes: current + newBytes })
        .eq("user_id", userId)
    } else {
      await supabase.from("user_usage").insert({ user_id: userId, total_bytes: newBytes })
    }

    return new Response(JSON.stringify({ sessionId, usage: current + newBytes, limit: QUOTA_BYTES }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 400 })
  }
}
