import { isAuthed, unauthorized } from "@/lib/auth";
import { reelDetail } from "@/lib/instagram";

export const maxDuration = 120;

// Body: { shortcode, videoUrl? }. Downloads the reel's video and transcribes it with OpenAI Whisper.
export async function POST(req: Request) {
  if (!(await isAuthed())) return unauthorized();
  const { shortcode, videoUrl } = await req.json().catch(() => ({}));
  const key = process.env.OPENAI_API_KEY;
  if (!key) return Response.json({ error: "Transcription isn't set up (OPENAI_API_KEY missing)." }, { status: 500 });
  try {
    let url = String(videoUrl || "");
    let vid = url ? await fetch(url) : null;
    if (!vid || !vid.ok) {
      // Instagram video links expire; fetch a fresh one.
      url = (await reelDetail(String(shortcode))).videoUrl;
      vid = url ? await fetch(url) : null;
    }
    if (!vid || !vid.ok) return Response.json({ error: "Couldn't download this reel's video." }, { status: 502 });
    const buf = await vid.arrayBuffer();
    if (buf.byteLength > 24 * 1024 * 1024) return Response.json({ error: "This video is too long to transcribe." }, { status: 413 });
    const form = new FormData();
    form.append("file", new Blob([buf], { type: "video/mp4" }), "reel.mp4");
    form.append("model", process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1");
    const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = String(j?.error?.message || "");
      return Response.json({ error: /credit|quota|billing/i.test(msg) ? "Transcription is out of credit. Tell Yanele." : "Transcription failed." }, { status: 502 });
    }
    return Response.json({ transcript: String(j.text || "").trim() });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Transcription failed." }, { status: 502 });
  }
}
