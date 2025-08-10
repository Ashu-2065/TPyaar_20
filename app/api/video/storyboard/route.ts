import { google } from '@ai-sdk/google';
import { generateText, RetryError } from 'ai';

export const maxDuration = 60;

type Body = {
prompt: string;
mode: 'normal' | 'bf' | 'gf';
lang: 'auto' | 'english' | 'hinglish' | 'marwadi';
};

function sysPrompt(mode: Body['mode'], lang: Body['lang']) {
const persona =
  mode === 'normal'
    ? 'You are TPyaar, a helpful assistant.'
    : mode === 'bf'
    ? 'You are TPyaar (Boyfriend mode): warm, supportive, playful (PG-13).'
    : 'You are TPyaar (Girlfriend mode): caring, empathetic, playful (PG-13).';
const langPref =
  lang === 'auto'
    ? 'Write captions in the user language; if not obvious, use English.'
    : lang === 'english'
    ? 'Write captions in English.'
    : lang === 'hinglish'
    ? 'Write captions in Hinglish.'
    : 'Write captions in Marwadi.';
return `${persona}\n${langPref}\nCreate a short storyboard (4-6 scenes). Provide a JSON array of objects with { title, caption } pairs.`;
}

async function tryGenerate(apiKey: string, modelName: 'gemini-1.5-pro' | 'gemini-1.5-flash', prompt: string, system: string) {
const { text } = await generateText({
  model: google(modelName, { apiKey }),
  system,
  prompt: `Prompt: ${prompt}\nReturn ONLY valid JSON array: [{"title":"...", "caption":"..."}]`,
});
return text;
}

export async function POST(req: Request) {
const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const { prompt, mode, lang } = (await req.json()) as Body;
const strict = true; // Assuming strict mode is always true for this example

if (!apiKey) {
  const frames = [
    { title: 'Scene 1', caption: `Intro: ${prompt.slice(0, 60)}...` },
    { title: 'Scene 2', caption: 'Key idea 1 explained simply.' },
    { title: 'Scene 3', caption: 'Key idea 2 with an example.' },
    { title: 'Scene 4', caption: 'Conclusion and call-to-action.' },
  ];
  return new Response(JSON.stringify({ frames }), { status: 200 });
}

const system = sysPrompt(mode, lang);

const models: ('gemini-1.5-pro' | 'gemini-1.5-flash')[] = ['gemini-1.5-pro', 'gemini-1.5-flash'];
let text = '';
let ok = false;
for (const m of models) {
  try {
    text = await tryGenerate(apiKey, m, prompt, system);
    ok = true;
    break;
  } catch (err) {
    if (RetryError.isInstance(err)) {
      // Friendly 200 response if strict or last fallback
      if (strict || m === models[models.length - 1]) {
        const frames = [
          { title: 'Scene 1', caption: 'Provider is rate-limited. Please retry in a moment.' },
          { title: 'Scene 2', caption: 'Tip: Add billing to your Gemini project to raise limits.' },
          { title: 'Scene 3', caption: 'We will resume normal generation after limits reset.' },
          { title: 'Scene 4', caption: 'Thanks for your patience.' },
        ];
        return new Response(JSON.stringify({ frames }), { status: 200 });
      }
      continue;
    }
    // Non-retry errors: continue unless last or strict
    if (strict || m === models[models.length - 1]) {
      const frames = [
        { title: 'Scene 1', caption: 'An error occurred while generating the storyboard.' },
        { title: 'Scene 2', caption: String(err?.message || 'Unknown error') },
        { title: 'Scene 3', caption: 'Please try again shortly.' },
        { title: 'Scene 4', caption: 'You can also reduce prompt length to reduce token usage.' },
      ];
      return new Response(JSON.stringify({ frames }), { status: 200 });
    }
    continue;
  }
}

let frames: { title: string; caption: string }[] = [];
if (ok) {
  try {
    const jsonStart = text.indexOf('[');
    const jsonEnd = text.lastIndexOf(']');
    const slice = jsonStart >= 0 && jsonEnd >= 0 ? text.slice(jsonStart, jsonEnd + 1) : text;
    frames = JSON.parse(slice);
  } catch {
    // fall through to default frames
  }
}
if (!frames.length) {
  frames = [
    { title: 'Scene 1', caption: `Intro: ${prompt.slice(0, 60)}...` },
    { title: 'Scene 2', caption: 'Key idea 1.' },
    { title: 'Scene 3', caption: 'Key idea 2.' },
    { title: 'Scene 4', caption: 'Conclusion.' },
  ];
}

if (frames.length < 4) {
  frames.push({ title: 'Scene 5', caption: 'Additional insight.' });
} else if (frames.length > 6) {
  frames = frames.slice(0, 6);
}

return new Response(JSON.stringify({ frames }), { status: 200 });
}
