// Yanele's scripting pipeline (scripting-pipeline-orchestrator), one step per request so each
// stays well under the serverless time limit:
//   analyze  -> Script Analyzer (Beginner): feeling, hook, order, type
//   write    -> V3 Script Writer: strategy, flow, sentence, checklist (client voice swapped in)
//   optimize -> Script Optimizer: tasteful, human, no micro-exits
//   judge    -> Panel of Judges (script-checker) + the copy check as a hard gate
//   revise   -> Optimizer again with the judges' notes (max 2 rounds, run by the page)
import Anthropic from "@anthropic-ai/sdk";
import { PROMPTS } from "./prompts.generated";
import type { Reel } from "./instagram";

export type Account = "omer" | "esteban" | "hireremotelatinos";
export const ACCOUNTS: Record<Account, string> = {
  omer: "Omer Bloch",
  esteban: "Esteban Andrade",
  hireremotelatinos: "Hire Remote Latinos",
};

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const EFFORT = (process.env.ANTHROPIC_EFFORT || "high") as "low" | "medium" | "high";
const client = new Anthropic();

const CLIENT_GUARD = `CLIENT GUARD: the writing skill below was built for Nick Perry. Run the same phases, but swap every Nick-specific input for this client's own profile: their voice rules, their content, their facts. Never use Nick's personal story, proof bank, numbers or catchphrases. Where the skill points at a file you don't have (a CSV, a format guide), use the source reel's own proven hook and the client profile instead.`;

const OUTPUT_RULES = `OUTPUT RULES
- The script is spoken words only, one beat per line, ready to read to camera. No headings, no stage directions inside it.
- Keep the source's STRUCTURE (its order of ideas and its mechanic) but re-say every line in the client's words. Never copy 6+ words in a row from the source transcript (Instagram Content Protection matches spoken words).
- Never invent facts, names, numbers or results. If the source has a claim you can't keep honestly, drop it.
- Length: 30-40 seconds spoken (about 100-150 words) unless the client profile says otherwise.`;

function sys(framework: string, account: Account) {
  return [
    { type: "text" as const, text: framework, cache_control: { type: "ephemeral" as const } },
    { type: "text" as const, text: `CLIENT PROFILE (${ACCOUNTS[account]})\n\n${PROMPTS.profiles[account]}\n\n${OUTPUT_RULES}`, cache_control: { type: "ephemeral" as const } },
  ];
}

function sourceBlock(reel: Reel, transcript: string) {
  return `SOURCE REEL
Link: ${reel.link}
Creator: @${reel.username}
Metrics: ${reel.views} views, ${reel.likes} likes, ${reel.comments} comments, ${reel.shares} shares, ${reel.saves} saves
Caption: ${reel.caption.slice(0, 1500)}

TRANSCRIPT (what is said in the reel)
${transcript || "(no speech found in this reel; work from the caption)"}`;
}

async function ask(system: ReturnType<typeof sys>, user: string, maxTokens = 16000): Promise<string> {
  const msg = await client.beta.messages
    .stream({
      model: MODEL,
      max_tokens: maxTokens,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: EFFORT },
      system,
      messages: [{ role: "user", content: user }],
    })
    .finalMessage();
  if (msg.stop_reason === "refusal") throw new Error("Claude declined this video. Skip it and pick another.");
  return msg.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
}

export const tag = (text: string, name: string) => {
  const m = text.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1].trim() : "";
};

export async function analyze(account: Account, reel: Reel, transcript: string) {
  const out = await ask(sys(PROMPTS.analyzer, account),
    `${sourceBlock(reel, transcript)}\n\nRun the Script Analyzer on this reel for this client. Write the analysis in plain English, then put it inside <analysis></analysis>.`);
  return { analysis: tag(out, "analysis") || out };
}

export async function write(account: Account, reel: Reel, transcript: string, analysis: string) {
  const out = await ask(sys(`${CLIENT_GUARD}\n\n${PROMPTS.writer}`, account),
    `${sourceBlock(reel, transcript)}\n\nANALYSIS\n${analysis}\n\nWrite this client's script from the source, running all four v3 phases. Work through the phases first, then give:\n<title>a punchy 6-10 word title for the video</title>\n<script>the final spoken script</script>\n<notes>2-4 short bullets for the editor or reviewer (hook choice, anything dropped and why)</notes>`);
  return { title: tag(out, "title"), script: tag(out, "script"), notes: tag(out, "notes") };
}

export async function optimize(account: Account, reel: Reel, transcript: string, script: string, feedback = "") {
  const out = await ask(sys(PROMPTS.optimizer, account),
    `${sourceBlock(reel, transcript)}\n\nDRAFT SCRIPT\n${script}\n\n${feedback ? `JUDGES' NOTES TO FIX\n${feedback}\n\n` : ""}Run the Script Optimizer on the draft${feedback ? " and fix every judge note" : ""}. Keep the hook, the one point, the closer and the length. Give the result as <script></script> and what you changed as <notes></notes> (short bullets).`);
  return { script: tag(out, "script") || script, notes: tag(out, "notes") };
}

export async function judge(account: Account, reel: Reel, transcript: string, script: string, copyReport: string) {
  const out = await ask(sys(PROMPTS.checker, account),
    `${sourceBlock(reel, transcript)}\n\nSCRIPT TO JUDGE\n${script}\n\nCOPY CHECK (hard gate, already measured): ${copyReport}\n\nAct as the panel of judges: Hook, Flow, Beats, Voice, Honesty, Craft, plus the copy check. A FAIL on the copy check fails the panel. Give <verdict>PASS</verdict> or <verdict>FAIL</verdict>, then <notes></notes> with one short line per judge (what passed, and exactly what to fix where it failed).`, 8000);
  const verdict = /PASS/i.test(tag(out, "verdict")) ? "PASS" : "FAIL";
  return { verdict, notes: tag(out, "notes") || out };
}
