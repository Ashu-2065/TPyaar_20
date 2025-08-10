export const maxDuration = 60;

type Body = {
  prompt: string;
  size?: `${number}x${number}`; // e.g. "1024x1024"
  model?: string; // optional override
};

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing GOOGLE_GENERATIVE_AI_API_KEY' }), { status: 400 });
    }

    const { prompt, size = '1024x1024', model } = (await req.json()) as Body;
    const [wStr, hStr] = size.split('x');
    const width = Number(wStr) || 1024;
    const height = Number(hStr) || 1024;

    // Try Imagen 3 family first, then the generic alias.
    const candidates = [
      model || 'imagen-3.0-generate-001',
      'imagen-3.0',
      'imagegeneration',
    ];

    let lastErr: any = null;
    for (const m of candidates) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          m
        )}:generateImage?key=${encodeURIComponent(apiKey)}`;

        const payload = {
          prompt: { text: prompt },
          imageGenerationConfig: {
            numberOfImages: 1,
            width,
            height,
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
        const inline =
          json?.generatedImages?.[0]?.inlineData ||
          json?.candidates?.[0]?.content?.parts?.find((p: any) => p.inline_data)?.inline_data;

        if (inline?.data) {
          const mime = inline?.mimeType || 'image/png';
          return new Response(JSON.stringify({ dataUrl: `data:${mime};base64,${inline.data}` }), { status: 200 });
        }

        // Some responses may provide a blob URI
        const uri =
          json?.generatedImages?.[0]?.uri ||
          json?.candidates?.[0]?.content?.parts?.find((p: any) => p.file_data)?.file_data?.file_uri;

        if (uri) {
          return new Response(JSON.stringify({ uri }), { status: 200 });
        }

        lastErr = 'No image data in response';
        continue;
      } catch (e) {
        lastErr = e;
        continue;
      }
    }

    return new Response(
      JSON.stringify({
        error:
          'Imagen (image generation) not enabled for this Google project or model unavailable.',
        details: String(lastErr || ''),
      }),
      { status: 400 }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 400 });
  }
}
