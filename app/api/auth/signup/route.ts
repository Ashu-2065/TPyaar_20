export const maxDuration = 30
import { signToken } from "../_utils"

type Body = { email: string; password: string }

export async function POST(req: Request) {
  const { email, password } = (await req.json()) as Body
  if (!email || !password || password.length < 6) {
    return new Response(JSON.stringify({ error: "Invalid email or password (min 6 chars)" }), { status: 400 })
  }
  // Demo: accept any email/password and return a token
  const token = await signToken(email.toLowerCase())
  return new Response(JSON.stringify({ token }), { status: 200, headers: { "content-type": "application/json" } })
}
