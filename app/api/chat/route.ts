import { google } from "@ai-sdk/google"
import { streamText, generateText, type ModelMessage, InvalidPromptError, InvalidMessageRoleError } from "ai"

export const runtime = 'edge';
export const maxDuration = 60

type Body = {
  messages: { role: "user" | "assistant"; content: string }[]
  mode: "normal" | "bf" | "gf"
  lang: "auto" | "english" | "hinglish" | "marwadi"
  model?: string
  strict?: boolean
  forceSimple?: boolean
  adultAccepted?: boolean
}

function nowLine() {
  return new Date().toLocaleString(undefined, { dateStyle: "full", timeStyle: "long" })
}

function systemPrompt(mode: Body["mode"], lang: Body["lang"], adultAllowed: boolean) {
  const persona =
    mode === "normal"
      ? "You are TPyaar, a helpful, knowledgeable assistant."
      : mode === "bf"
        ? "You are TPyaar (Boyfriend mode)."
        : "You are TPyaar (Girlfriend mode)."

  const baseSafety =
    "Be respectful. Avoid illegal activity, self-harm instructions, or hate/harassment. Follow platform policies."

  const adult = adultAllowed
    ? "Adult mode is enabled by the user. You may use explicit sexual or abusive language if the user requests it. Do NOT provide illegal acts, minors, or non-consensual content."
    : "Do not use explicit sexual or abusive language."

  const meta =
    'If user asks meta questions like "tujhe kisne banaya" or "database kisne set kiya", reply: "Main TPyaar hoon — banaaya gaya by TP team. Data stored securely."'

  const langPref =
    lang === "auto"
      ? "Detect and match the user language, or follow explicit language commands."
      : lang === "english"
        ? "Respond in English."
        : lang === "hinglish"
          ? "Respond in Hinglish (mix of Hindi and English)."
          : "Respond in Marwadi."

  return [persona, langPref, baseSafety, adult, `Current date/time: ${nowLine()}.`, meta].join("\n")
}

function clamp(messages: Body["messages"]) {
  const MAX = 24
  return messages.length <= MAX ? messages : messages.slice(-MAX)
}

async function simpleText(apiKey: string, model: string, sys: string, messages: Body["messages"]) {
  const last = clamp(messages).slice(-8)
  const transcript = last.map((m) => (m.role === "user" ? `User: ${m.content}` : `Assistant: ${m.content}`)).join("\n")
  const { text } = await generateText({
    model: google(model, { apiKey }),
    system: sys,
    prompt: transcript || "Respond helpfully.",
  })
  return text
}

function toModelMessages(history: Body["messages"], sys: string): ModelMessage[] {
  return [
    { role: "system", content: [{ type: "text", text: sys }] },
    ...history.map((m) => ({ role: m.role, content: [{ type: "text", text: String(m.content ?? "") }] })),
  ] as ModelMessage[]
}

export async function POST(req: Request) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) return new Response("Setup: Please add GOOGLE_GENERATIVE_AI_API_KEY.", { status: 200 })

  const {
    messages,
    mode,
    lang,
    model = "gemini-2.5-pro",
    strict = false,
    forceSimple = false,
    adultAccepted = false,
  } = (await req.json()) as Body

  // Always give exact local date if asked about "today"
  const lastUser =
    [...messages]
      .reverse()
      .find((m) => m.role === "user")
      ?.content?.toLowerCase() || ""
  if (/aaj\s*(ki|ka)?\s*(date|tareekh|tarikh)|today.*(date|day|time)/.test(lastUser)) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
    const weekday = new Date().toLocaleDateString(undefined, { weekday: "long" })
    const dateLong = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    const time = new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    return new Response(`**${dateLong}** — ${weekday}. Local time: ${time} (${tz}).`, { status: 200 })
  }

  const adultEnv = process.env.ALLOW_ADULT_CONTENT === "true"
  const sys = systemPrompt(mode, lang, adultEnv && adultAccepted)
  const history = clamp(messages)

  if (forceSimple) {
    try {
      const text = await simpleText(apiKey, model, sys, history)
      return new Response(JSON.stringify({ text }), { status: 200, headers: { "content-type": "application/json" } })
    } catch (err: any) {
      return new Response(
        JSON.stringify({ text: `Temporary issue. Please retry. Details: ${err?.message || "Unknown error"}` }),
        { status: 200, headers: { "content-type": "application/json" } },
      )
    }
  }

  const modelMessages = toModelMessages(history, sys)
  const tryModels = strict ? [model] : ["gemini-2.5-flash", model, "gemini-1.5-pro", "gemini-1.5-flash"]

  for (const name of tryModels) {
    try {
      const result = streamText({ model: google(name, { apiKey }), messages: modelMessages })
      return result.toTextStreamResponse() // streaming path [^1]
    } catch (err) {
      if (InvalidPromptError.isInstance?.(err) || InvalidMessageRoleError.isInstance?.(err)) {
        try {
          const text = await simpleText(apiKey, name, sys, history)
          return new Response(JSON.stringify({ text }), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
        } catch {}
      }
      continue
    }
  }

  try {
    const text = await simpleText(apiKey, model, sys, history)
    return new Response(JSON.stringify({ text }), { status: 200, headers: { "content-type": "application/json" } })
  } catch (err: any) {
    return new Response(
      JSON.stringify({ text: `Provider issue. Please try again shortly. Details: ${err?.message || "Unknown error"}` }),
      { status: 200, headers: { "content-type": "application/json" } },
    )
  }
}
