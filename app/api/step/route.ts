import Anthropic from "@anthropic-ai/sdk";
import { isAuthed, unauthorized } from "@/lib/auth";
import { copyCheck } from "@/lib/copycheck";
import { ACCOUNTS, analyze, judge, optimize, write, type Account } from "@/lib/pipeline";

export const maxDuration = 300;

// Body: { step: "analyze"|"write"|"optimize"|"judge"|"revise", account, reel, transcript, analysis?, script?, feedback? }
export async function POST(req: Request) {
  if (!(await isAuthed())) return unauthorized();
  const b = await req.json().catch(() => ({}));
  const account = b.account as Account;
  if (!(account in ACCOUNTS) || !b.reel?.shortcode) return Response.json({ error: "Missing account or video." }, { status: 400 });
  const transcript = String(b.transcript || "");
  try {
    switch (b.step) {
      case "analyze": return Response.json(await analyze(account, b.reel, transcript));
      case "write": return Response.json(await write(account, b.reel, transcript, String(b.analysis || "")));
      case "optimize": return Response.json(await optimize(account, b.reel, transcript, String(b.script || "")));
      case "revise": return Response.json(await optimize(account, b.reel, transcript, String(b.script || ""), String(b.feedback || "")));
      case "judge": {
        const cc = copyCheck(transcript, String(b.script || ""), b.reel.username || "");
        const report = `${cc.verdict} (longest copied run ${cc.longestRun} words, ${Math.round(cc.coverage * 100)}% of the script in copied runs${cc.copied ? `; longest run: "${cc.copied}"` : ""})`;
        const j = await judge(account, b.reel, transcript, String(b.script || ""), report);
        return Response.json({ ...j, verdict: cc.verdict === "FAIL" ? "FAIL" : j.verdict, copy: cc });
      }
      default: return Response.json({ error: "Unknown step." }, { status: 400 });
    }
  } catch (e) {
    console.error("step failed:", b.step, e instanceof Error ? e.message : e);
    const msg = e instanceof Anthropic.AuthenticationError ? "The Claude key on the server isn't valid. Tell Yanele."
      : e instanceof Anthropic.RateLimitError ? "Claude is busy right now. Wait a minute and press Retry."
      : e instanceof Anthropic.APIError && /credit balance/i.test(e.message) ? "Claude is out of credit. Tell Yanele."
      : e instanceof Error ? e.message : "Something went wrong.";
    return Response.json({ error: msg }, { status: 502 });
  }
}
