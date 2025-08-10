export const maxDuration = 180;

type Body = {
  prompt: string;
  duration?: number; // seconds hint
  model?: string;
};

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing GOOGLE_GENERATIVE_AI_API_KEY' }), { status: 400 });
    }
    const { prompt, duration = 8, model } = (await req.json()) as Body;

    // Try Veo 3 first, then 2.5, then 2.0
    const candidates = [
      model || 'veo-3.0',
      'veo-2.5',
      'veo-2.0',
      'video-2.0',
    ];

    let lastErr: any = null;
    for (const m of candidates) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          m
        )}:generateVideo?key=${encodeURIComponent(apiKey)}`;

        const payload: any = {
          prompt: { text: prompt },
          videoConfig: {
            durationSeconds: Math.min(30, Math.max(3, Math.floor(duration))),
          },
          safetySettings: [],
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          lastErr = await res.text();
          continue;
        }

        const json = (await res.json()) as any;
        // Prefer inline base64
        const inline = json?.generatedVideos?.[0]?.inlineData;
        if (inline?.data) {
          const mime = inline?.mimeType || 'video/mp4';
          return new Response(JSON.stringify({ dataUrl: `data:${mime};base64,${inline.data}` }), { status: 200 });
        }

        // Or a downloadable URI
        const uri =
          json?.video?.uri ||
          json?.generatedVideos?.[0]?.video?.uri ||
          json?.candidates?.[0]?.content?.parts?.find((p: any) => p.file_data)?.file_data?.file_uri;

        if (uri) {
          return new Response(JSON.stringify({ uri }), { status: 200 });
        }

        lastErr = 'No video returned';
        continue;
      } catch (e) {
        lastErr = e;
        continue;
      }
    }

    return new Response(
      JSON.stringify({
        error:
          'Veo (video generation) not enabled for this Google project or model unavailable.',
        details: String(lastErr || ''),
      }),
      { status: 400 }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 400 });
  }
}
