export const maxDuration = 60;

type Body = {
dataUrl: string;
prompt?: string;
mode: 'normal' | 'bf' | 'gf';
lang: 'auto' | 'english' | 'hinglish' | 'marwadi';
};

function systemPrompt(mode: Body['mode'], lang: Body['lang']) {
const persona =
  mode === 'normal'
    ? 'You are TPyaar, a helpful, knowledgeable assistant.'
    : mode === 'bf'
    ? 'You are TPyaar in Boyfriend mode: warm, supportive, playful, flirty (PG-13).'
    : 'You are TPyaar in Girlfriend mode: caring, empathetic, playful, flirty (PG-13).';
const safety =
  'Be respectful, avoid explicit sexual content, illegal activity, self-harm instructions, hate or harassment. Refuse unsafe requests. Keep conversations consensual and age-appropriate.';
const langPref =
  lang === 'auto'
    ? 'Detect and match the user language, or follow explicit language commands.'
    : lang === 'english'
    ? 'Respond in English.'
    : lang === 'hinglish'
    ? 'Respond in Hinglish (mix of Hindi and English).'
    : 'Respond in Marwadi.';
return `${persona}\n${langPref}\n${safety}`;
}

async function callGeminiImage(apiKey: string, model: string, mime: string, b64: string, contentText: string) {
const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
  model
)}:generateContent?key=${encodeURIComponent(apiKey)}`;

const payload = {
  contents: [
    {
      role: 'user',
      parts: [
        { text: contentText },
        {
          inline_data: {
            mime_type: mime,
            data: b64,
          },
        },
      ],
    },
  ],
};

const res = await fetch(url, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(payload),
});

if (!res.ok) {
  const t = await res.text();
  // Convert provider quota/rate messages into a friendly 200 response.
  if (/rate|quota/i.test(t)) {
    return new Response(
      JSON.stringify({ text: 'Gemini rate limit or quota reached for image analysis. Please try again soon.' }),
      { status: 200 }
    );
  }
  return new Response(JSON.stringify({ text: `Image analysis failed: ${t}` }), { status: 200 });
}

const json = (await res.json()) as any;
const text =
  json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ||
  json?.candidates?.[0]?.content?.parts?.[0]?.text ||
  'No description was returned.';
return text;
}

export async function POST(req: Request) {
try {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ text: 'Setup: Add GOOGLE_GENERATIVE_AI_API_KEY to enable image analysis.' }),
      { status: 200 }
    );
  }
  const { dataUrl, prompt, mode, lang } = (await req.json()) as Body;

  const match = dataUrl.match(/^data:(.+);base64,(.*)$/);
  if (!match) {
    return new Response(JSON.stringify({ text: 'Invalid image data (expected data URL)' }), { status: 200 });
  }
  const mime = match[1];
  const b64 = match[2];

  const contentText = systemPrompt(mode, lang) + '\n\nTask: ' + (prompt || 'Describe this image and provide insights.');

  const models = ['gemini-1.5-pro', 'gemini-1.5-flash'];
  let lastErr: any = null;
  for (const m of models) {
    try {
      const text = await callGeminiImage(apiKey, m, mime, b64, contentText);
      return new Response(JSON.stringify({ text }), { status: 200 });
    } catch (e) {
      lastErr = e;
      continue;
    }
  }
  return new Response(
    JSON.stringify({
      text:
        'Image analysis temporarily unavailable due to provider limits. Please try again later.',
      details: String(lastErr?.message || ''),
    }),
    { status: 200 }
  );
} catch (e: any) {
  return new Response(JSON.stringify({ text: `Image analysis error: ${e?.message || 'Unknown error'}` }), { status: 200 });
}
}
