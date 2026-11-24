// Instagram scraping through the RapidAPI "Instagram Scraper 2025" API (same endpoints as
// workflow-agents/shared/scraper.py): /userreels/ for a creator's reels, /postdetail/ for one reel.

export type Reel = {
  shortcode: string;
  link: string;
  username: string;
  takenAt: number; // unix seconds
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  caption: string;
  videoUrl: string;
  durationSec: number;
};

const HOST = process.env.RAPIDAPI_HOST || "instagram-scraper-20251.p.rapidapi.com";
const KEYS = [process.env.RAPIDAPI_KEY, process.env.RAPIDAPI_KEY_FALLBACK].filter(Boolean) as string[];

async function apiGet(endpoint: string, params: Record<string, string>): Promise<any> {
  if (!KEYS.length) throw new Error("The scraper key (RAPIDAPI_KEY) is not set on the server.");
  const qs = new URLSearchParams(params).toString();
  let lastErr = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    const key = KEYS[Math.min(attempt, KEYS.length - 1)];
    const r = await fetch(`https://${HOST}${endpoint}?${qs}`, {
      headers: { "x-rapidapi-key": key, "x-rapidapi-host": HOST },
      cache: "no-store",
    });
    if (r.ok) {
      const body = await r.json();
      const msg = typeof body?.message === "string" ? body.message.toLowerCase() : "";
      if (msg.includes("exceeded") && msg.includes("quota")) { lastErr = "scraper quota used up"; continue; }
      return body;
    }
    lastErr = `scraper returned ${r.status}`;
    await new Promise((res) => setTimeout(res, 800 * (attempt + 1)));
  }
  throw new Error(lastErr || "scraper failed");
}

const get = (o: any, ...paths: string[]) => {
  for (const p of paths) {
    let v = o;
    for (const k of p.split(".")) v = v?.[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
};
const num = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

function items(data: any): any[] {
  const d = data?.data ?? data;
  const list = d?.items ?? d?.reels ?? d?.edges ?? (Array.isArray(d) ? d : []);
  return (list || []).map((it: any) => it?.node?.media ?? it?.node ?? it?.media ?? it);
}

function toReel(n: any): Reel {
  const code = String(get(n, "code", "shortcode") || "");
  // play_count is already Instagram + Facebook combined; only add the splits when it's missing.
  const combined = num(get(n, "play_count", "total_play_count", "metrics.play_count"));
  const split = num(get(n, "ig_play_count", "metrics.ig_play_count", "video_view_count", "view_count")) + num(get(n, "fb_play_count", "metrics.fb_play_count"));
  const versions = get(n, "video_versions") as any[] | undefined;
  return {
    shortcode: code,
    link: `https://www.instagram.com/reel/${code}/`,
    username: String(get(n, "user.username", "owner.username", "username") || ""),
    takenAt: num(get(n, "taken_at", "taken_at_timestamp", "timestamp")),
    views: combined || split,
    likes: num(get(n, "like_count", "metrics.like_count", "edge_liked_by.count", "likes")),
    comments: num(get(n, "comment_count", "metrics.comment_count", "edge_media_to_comment.count", "comments")),
    shares: num(get(n, "share_count", "metrics.share_count", "reshare_count", "shares")),
    saves: num(get(n, "save_count", "metrics.save_count", "saves")),
    caption: String(get(n, "caption.text", "edge_media_to_caption.edges.0.node.text", "caption") || ""),
    videoUrl: String(get(n, "video_url") || (versions && versions[0]?.url) || ""),
    durationSec: num(get(n, "video_duration")),
  };
}

export function shortcodeFrom(input: string): string | null {
  const m = input.match(/instagram\.com\/(?:[^/]+\/)?(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{8,}$/.test(input.trim()) ? input.trim() : null;
}

export function handleFrom(input: string): string | null {
  const s = input.trim().replace(/^@/, "");
  const m = s.match(/instagram\.com\/([A-Za-z0-9_.]+)/i);
  const h = m ? m[1] : s;
  if (!h || ["reel", "reels", "p", "tv"].includes(h.toLowerCase())) return null;
  return /^[A-Za-z0-9_.]{1,30}$/.test(h) ? h.toLowerCase() : null;
}

export async function reelDetail(shortcode: string): Promise<Reel> {
  const data = await apiGet("/postdetail/", { code_or_url: shortcode });
  const d = data?.data && typeof data.data === "object" ? data.data : data;
  const r = toReel(d);
  if (!r.shortcode) r.shortcode = shortcode, r.link = `https://www.instagram.com/reel/${shortcode}/`;
  return r;
}

export async function creatorReels(handle: string, maxPages = 3): Promise<Reel[]> {
  const out: Reel[] = [];
  const seen = new Set<string>();
  let token: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const params: Record<string, string> = { username_or_id: handle };
    if (token) params.pagination_token = token;
    const data = await apiGet("/userreels/", params);
    const batch = items(data).map(toReel).filter((r) => r.shortcode && !seen.has(r.shortcode));
    if (!batch.length) break;
    batch.forEach((r) => { seen.add(r.shortcode); if (!r.username) r.username = handle; out.push(r); });
    token = get(data, "pagination_token", "data.pagination_token", "paging_info.max_id", "data.paging_info.max_id", "next_max_id");
    if (!token) break;
  }
  return out;
}
