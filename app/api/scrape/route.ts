import { isAuthed, unauthorized } from "@/lib/auth";
import { creatorReels, handleFrom, reelDetail, shortcodeFrom, type Reel } from "@/lib/instagram";

export const maxDuration = 120;

// Body: { links: string[] } for specific reels, or { handle, days, top } for one competitor.
export async function POST(req: Request) {
  if (!(await isAuthed())) return unauthorized();
  const body = await req.json().catch(() => ({}));
  try {
    if (Array.isArray(body.links)) {
      const codes = [...new Set(body.links.map((l: string) => shortcodeFrom(l)).filter(Boolean))] as string[];
      const reels: Reel[] = [];
      const failed: string[] = [];
      for (const c of codes.slice(0, 30)) {
        try { reels.push(await reelDetail(c)); } catch { failed.push(c); }
      }
      return Response.json({ reels, failed });
    }
    const handle = handleFrom(String(body.handle || ""));
    if (!handle) return Response.json({ error: "That doesn't look like an Instagram handle." }, { status: 400 });
    const days = Math.max(1, Math.min(365, Number(body.days) || 30));
    const top = Math.max(1, Math.min(30, Number(body.top) || 10));
    const since = Date.now() / 1000 - days * 86400;
    const all = await creatorReels(handle, days > 60 ? 5 : 3);
    const reels = all.filter((r) => !r.takenAt || r.takenAt >= since).sort((a, b) => b.views - a.views).slice(0, top);
    return Response.json({ reels, found: all.length });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Scraping failed." }, { status: 502 });
  }
}
