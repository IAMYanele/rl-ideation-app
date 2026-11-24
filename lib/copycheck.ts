// Port of workflow-agents/shared/copy_check.py. Instagram Content Protection matches the SPOKEN
// WORDS of a protected reel, so a script keeps the source's structure but re-says every line.
// FAIL = 15+ words in a row copied, or 40%+ of the script inside copied 6+ word runs.
// (Runs are found greedily, which is slightly stricter than the Python difflib version.)

const FAIL_RUN = 15, FAIL_COVERAGE = 0.4, WARN_RUN = 10, WARN_COVERAGE = 0.2, WARN_TRIGRAM = 0.25, MIN_RUN = 6;
const OWN = new Set(["omerbloch", "estenick", "hireremotelatinos", "remotelatinos", "latinosremotos"]);

export type CopyResult = { verdict: "PASS" | "WARN" | "FAIL" | "OWN" | "SKIP"; coverage: number; longestRun: number; trigram: number; copied: string };

const words = (t: string) => (t.replace(/’/g, "'").toLowerCase().match(/\p{L}+(?:'\p{L}+)?/gu) || []);
const stripCues = (t: string) => t.replace(/\[[^\]]*\]|\([^)]*\)/g, " ");

export function copyCheck(source: string, script: string, sourceHandle = ""): CopyResult {
  const a = words(source), b = words(stripCues(script));
  if (!a.length || !b.length) return { verdict: "SKIP", coverage: 0, longestRun: 0, trigram: 0, copied: "" };
  const pos = new Map<string, number[]>();
  a.forEach((w, i) => { const l = pos.get(w); l ? l.push(i) : pos.set(w, [i]); });
  let covered = 0, longest = 0, longestAt = 0, i = 0;
  while (i < b.length) {
    let best = 0;
    for (const j of pos.get(b[i]) || []) {
      let k = 0;
      while (i + k < b.length && j + k < a.length && a[j + k] === b[i + k]) k++;
      if (k > best) best = k;
    }
    if (best > longest) { longest = best; longestAt = i; }
    if (best >= MIN_RUN) { covered += best; i += best; } else i++;
  }
  const tri = (w: string[]) => new Set(w.slice(2).map((_, k) => w[k] + " " + w[k + 1] + " " + w[k + 2]));
  const ta = tri(a), tb = tri(b);
  let shared = 0; tb.forEach((t) => { if (ta.has(t)) shared++; });
  const coverage = covered / b.length, trigram = tb.size ? shared / tb.size : 0;
  let verdict: CopyResult["verdict"] =
    longest >= FAIL_RUN || coverage >= FAIL_COVERAGE ? "FAIL"
    : longest >= WARN_RUN || coverage >= WARN_COVERAGE || trigram >= WARN_TRIGRAM ? "WARN" : "PASS";
  if (OWN.has(sourceHandle.toLowerCase())) verdict = "OWN";
  return { verdict, coverage: Math.round(coverage * 1000) / 1000, longestRun: longest, trigram: Math.round(trigram * 1000) / 1000, copied: b.slice(longestAt, longestAt + longest).join(" ") };
}
