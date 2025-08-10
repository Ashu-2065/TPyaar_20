# TPyaar

TPyaar — your colorful AI companion.

What’s included
- Streaming chat with Gemini via the AI SDK. Falls back to non-streaming so replies don’t stop. [^1]
- Exact, real-time date answers from the server (no hallucinated dates).
- “Today’s” occasions/festivals (server-fetched) with citations.
- Image analysis, optional image/video generation (typed triggers behind a toggle).
- PWA install (manifest + SW).
- Demo Sign in/Sign up with stateless JWT (no DB) — replace with Supabase or Mongo later.
- Adult content gate for BF/GF modes with env toggles and one-time consent.

Quick start
1. Copy .env.example to your environment and set GOOGLE_GENERATIVE_AI_API_KEY.
2. Optionally set ALLOW_ADULT_CONTENT=true (server) and NEXT_PUBLIC_ALLOW_ADULT_CONTENT=true (client banner).
3. Run in Vercel/v0 preview.

Notes
- The demo auth uses a stateless token only. For production, plug in Supabase or Mongo and issue JWTs there.
- Service worker is a minimal cache. Extend if you need offline chat logs.

AI SDK
- The chat uses streamText for streaming, generateText as a fallback. [^1]
