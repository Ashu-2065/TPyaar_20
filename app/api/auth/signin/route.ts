export const maxDuration = 30
import { signToken } from "../_utils"

type Body = { email: string; password: string }

export async function POST(req: Request) {
  const { email, password } = (await req.json()) as Body
  if (!email || !password) {
    return new Response(JSON.stringify({ error: "Missing credentials" }), { status: 400 })
  }
  // Demo: no DB — always signs in
  const token = await signToken(email.toLowerCase())
  return new Response(JSON.stringify({ token }), { status: 200, headers: { "content-type": "application/json" } })
}
