"use client";
import { useEffect, useMemo, useState } from "react";

type Account = "omer" | "esteban" | "hireremotelatinos";
type Reel = { shortcode: string; link: string; username: string; takenAt: number; views: number; likes: number; comments: number; shares: number; saves: number; caption: string; videoUrl: string };
type Job = { reel: Reel; status: string; error?: string; transcript?: string; title?: string; script?: string; notes?: string; verdict?: string; judgeNotes?: string; copy?: string; md?: string };
type Batch = { id: string; at: string; account: Account; md: string; count: number };

const ACCOUNTS: { id: Account; name: string; hint: string }[] = [
  { id: "omer", name: "Omer Bloch", hint: "Business growth, top of funnel" },
  { id: "esteban", name: "Esteban", hint: "Marketing, AI tools, leads" },
  { id: "hireremotelatinos", name: "Hire Remote Latinos", hint: "Talent Hunt Pro, bottom of funnel" },
];
const STEPS = ["Transcribing", "Analysing", "Writing", "Polishing", "Checking", "Done"];
const fmt = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? Math.round(n / 1e3) + "K" : String(n));
const day = (t: number) => (t ? new Date(t * 1000).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "");

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) throw Object.assign(new Error(j.error || "Please log in again."), { auth: true });
  if (!r.ok) throw new Error(j.error || "Something went wrong.");
  return j;
}

function toMarkdown(j: Job, account: Account) {
  const r = j.reel, who = ACCOUNTS.find((a) => a.id === account)!.name;
  return [
    `# ${j.title || "Untitled"}`,
    "",
    `**Source:** ${r.link} (@${r.username}${r.takenAt ? ", posted " + day(r.takenAt) : ""})`,
    `**Metrics:** ${fmt(r.views)} views | ${fmt(r.likes)} likes | ${fmt(r.comments)} comments | ${fmt(r.shares)} shares | ${fmt(r.saves)} saves`,
    `**Script for:** ${who}`,
    "",
    "---",
    "",
    "## Original Transcript",
    "",
    j.transcript || "(no speech in this reel)",
    "",
    "---",
    "",
    "## Script",
    "",
    j.script || "",
    "",
    "---",
    "",
    "## Notes",
    "",
    `- Review: ${j.verdict === "PASS" ? "passed the judges" : "did not fully pass the judges, check the notes below"}. Copy check: ${j.copy}.`,
    j.notes ? j.notes : "",
    j.verdict !== "PASS" && j.judgeNotes ? "\nJudges:\n" + j.judgeNotes : "",
    "",
  ].join("\n");
}

export default function Home() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [code, setCode] = useState("");
  const [account, setAccount] = useState<Account | null>(null);
  const [mode, setMode] = useState<"links" | "competitors">("links");
  const [links, setLinks] = useState("");
  const [handles, setHandles] = useState("");
  const [days, setDays] = useState(30);
  const [top, setTop] = useState(5);
  const [found, setFound] = useState<Reel[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState("");
  const [history, setHistory] = useState<Batch[]>([]);
  const [view, setView] = useState<"new" | "history">("new");

  useEffect(() => {
    fetch("/api/login").then((r) => r.json()).then((j) => setAuthed(!!j.ok)).catch(() => setAuthed(false));
    try { setHistory(JSON.parse(localStorage.getItem("rl-ideas-history") || "[]")); } catch {}
  }, []);
  const saveHistory = (h: Batch[]) => { setHistory(h); try { localStorage.setItem("rl-ideas-history", JSON.stringify(h.slice(0, 50))); } catch {} };

  const fail = (e: any) => { if (e?.auth) setAuthed(false); setMsg(e?.message || "Something went wrong."); };

  async function login(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    try { await post("/api/login", { passcode: code }); setAuthed(true); } catch (e: any) { setMsg(e.message); }
  }

  async function findVideos() {
    setMsg(""); setFound([]); setJobs([]);
    const list: Reel[] = [];
    try {
      if (mode === "links") {
        const l = links.split(/\s+/).filter((x) => x.includes("instagram.com"));
        if (!l.length) return setMsg("Paste at least one Instagram reel link.");
        setBusy(`Getting ${l.length} video${l.length > 1 ? "s" : ""}…`);
        const j = await post("/api/scrape", { links: l });
        list.push(...j.reels);
        if (j.failed?.length) setMsg(`${j.failed.length} link(s) couldn't be opened and were skipped.`);
      } else {
        const hs = handles.split(/[\s,]+/).filter(Boolean);
        if (!hs.length) return setMsg("Add at least one competitor account.");
        for (const [i, h] of hs.entries()) {
          setBusy(`Checking ${h} (${i + 1} of ${hs.length})…`);
          try { const j = await post("/api/scrape", { handle: h, days, top }); list.push(...j.reels); }
          catch (e: any) { if (e?.auth) throw e; setMsg((m) => (m ? m + " " : "") + `${h}: ${e.message}`); }
        }
      }
      list.sort((a, b) => b.views - a.views);
      setFound(list); setPicked(new Set(list.map((r) => r.shortcode)));
      if (!list.length) setMsg("No videos found. Check the links or accounts and try again.");
    } catch (e) { fail(e); } finally { setBusy(""); }
  }

  async function runOne(job: Job, acc: Account, update: (p: Partial<Job>) => void) {
    const base = { account: acc, reel: job.reel };
    update({ status: "Transcribing", error: undefined });
    let transcript = "";
    try { transcript = (await post("/api/transcribe", { shortcode: job.reel.shortcode, videoUrl: job.reel.videoUrl })).transcript; }
    catch (e: any) { if (e?.auth) throw e; transcript = ""; update({ error: e.message + " Using the caption instead." }); }
    const t = { ...base, transcript: transcript || job.reel.caption };
    update({ status: "Analysing", transcript });
    const { analysis } = await post("/api/step", { ...t, step: "analyze" });
    update({ status: "Writing" });
    const w = await post("/api/step", { ...t, step: "write", analysis });
    update({ status: "Polishing", title: w.title });
    let { script, notes } = await post("/api/step", { ...t, step: "optimize", script: w.script });
    let jd: any = null;
    for (let round = 0; round < 3; round++) {
      update({ status: "Checking" });
      jd = await post("/api/step", { ...t, step: "judge", script });
      if (jd.verdict === "PASS" || round === 2) break;
      update({ status: "Polishing" });
      const rv = await post("/api/step", { ...t, step: "revise", script, feedback: jd.notes });
      script = rv.script; notes = rv.notes || notes;
    }
    const done: Job = { ...job, transcript, title: w.title, script, notes: [w.notes, notes].filter(Boolean).join("\n"), verdict: jd.verdict, judgeNotes: jd.notes,
      copy: `${jd.copy.verdict}${jd.copy.longestRun ? `, longest copied run ${jd.copy.longestRun} words` : ""}`, status: "Done" };
    done.md = toMarkdown(done, acc);
    update(done);
    return done;
  }

  async function writeScripts() {
    if (!account) return setMsg("Pick who the scripts are for first.");
    const chosen = found.filter((r) => picked.has(r.shortcode));
    if (!chosen.length) return setMsg("Tick at least one video.");
    setMsg(""); setBusy("Writing scripts… keep this tab open.");
    const list: Job[] = chosen.map((reel) => ({ reel, status: "Waiting" }));
    setJobs(list);
    const results: Job[] = [];
    for (let i = 0; i < list.length; i++) {
      const update = (p: Partial<Job>) => setJobs((js) => js.map((j, k) => (k === i ? { ...j, ...p } : j)));
      try { results.push(await runOne(list[i], account, update)); }
      catch (e: any) { if (e?.auth) { fail(e); break; } update({ status: "Failed", error: e.message }); }
    }
    setBusy("");
    if (results.length) {
      const md = results.map((r) => r.md).join("\n\n");
      saveHistory([{ id: Date.now().toString(36), at: new Date().toISOString(), account, md, count: results.length }, ...history]);
    }
  }

  async function retry(i: number) {
    if (!account) return;
    const update = (p: Partial<Job>) => setJobs((js) => js.map((j, k) => (k === i ? { ...j, ...p } : j)));
    setBusy("Retrying…");
    try {
      const r = await runOne(jobs[i], account, update);
      saveHistory([{ id: Date.now().toString(36), at: new Date().toISOString(), account, md: r.md!, count: 1 }, ...history]);
    } catch (e: any) { if (e?.auth) fail(e); else update({ status: "Failed", error: e.message }); }
    setBusy("");
  }

  async function copy(text: string, id: string) {
    try { await navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(""), 2000); }
    catch { setMsg("Copy was blocked. Select the text and press Ctrl+C."); }
  }
  function download(md: string, name: string) {
    const url = URL.createObjectURL(new Blob([md], { type: "text/markdown" }));
    const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
  }

  const allMd = useMemo(() => jobs.filter((j) => j.md).map((j) => j.md).join("\n\n"), [jobs]);
  const stamp = () => new Date().toISOString().slice(0, 10);

  if (authed === null) return <main className="wrap"><p className="muted">Loading…</p></main>;
  if (!authed)
    return (
      <main className="wrap narrow">
        <h1>Remote Latinos script ideas</h1>
        <form onSubmit={login} className="card">
          <label htmlFor="pc">Team passcode</label>
          <input id="pc" type="password" value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
          <button className="primary big" type="submit">Open the app</button>
          {msg && <p className="err">{msg}</p>}
        </form>
      </main>
    );

  return (
    <main className="wrap">
      <header className="top">
        <h1>Remote Latinos script ideas</h1>
        <nav>
          <button className={view === "new" ? "tab on" : "tab"} onClick={() => setView("new")}>New scripts</button>
          <button className={view === "history" ? "tab on" : "tab"} onClick={() => setView("history")}>Saved ({history.length})</button>
        </nav>
      </header>

      {view === "history" ? (
        <section>
          {!history.length && <p className="muted">Nothing saved yet. Every batch you write is saved here on this computer.</p>}
          {history.map((h) => (
            <div className="card" key={h.id}>
              <div className="row">
                <strong>{new Date(h.at).toLocaleString()} · {ACCOUNTS.find((a) => a.id === h.account)?.name} · {h.count} script{h.count > 1 ? "s" : ""}</strong>
                <span className="grow" />
                <button onClick={() => copy(h.md, h.id)}>{copied === h.id ? "Copied ✓" : "Copy all"}</button>
                <button onClick={() => download(h.md, `scripts-${h.at.slice(0, 10)}.md`)}>Download</button>
                <button onClick={() => saveHistory(history.filter((x) => x.id !== h.id))}>Delete</button>
              </div>
              <details><summary>Show</summary><pre className="md">{h.md}</pre></details>
            </div>
          ))}
        </section>
      ) : (
        <>
          <section className="card">
            <h2><span className="n">1</span> Who are the scripts for?</h2>
            <div className="choices">
              {ACCOUNTS.map((a) => (
                <button key={a.id} className={account === a.id ? "choice on" : "choice"} onClick={() => setAccount(a.id)}>
                  <strong>{a.name}</strong><span>{a.hint}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="card">
            <h2><span className="n">2</span> Where should the ideas come from?</h2>
            <div className="row">
              <button className={mode === "links" ? "tab on" : "tab"} onClick={() => setMode("links")}>Reel links</button>
              <button className={mode === "competitors" ? "tab on" : "tab"} onClick={() => setMode("competitors")}>Competitor accounts</button>
            </div>
            {mode === "links" ? (
              <>
                <label htmlFor="links">Paste Instagram reel links, one per line</label>
                <textarea id="links" rows={5} value={links} onChange={(e) => setLinks(e.target.value)} placeholder="https://www.instagram.com/reel/…" />
              </>
            ) : (
              <>
                <label htmlFor="handles">Competitor accounts, one per line (@name or profile link)</label>
                <textarea id="handles" rows={4} value={handles} onChange={(e) => setHandles(e.target.value)} placeholder="@alexhormozi" />
                <div className="row">
                  <label>From the last
                    <select value={days} onChange={(e) => setDays(+e.target.value)}>{[7, 14, 30, 60, 90].map((d) => <option key={d} value={d}>{d} days</option>)}</select>
                  </label>
                  <label>Take the top
                    <select value={top} onChange={(e) => setTop(+e.target.value)}>{[3, 5, 10, 20].map((d) => <option key={d} value={d}>{d} by views</option>)}</select>
                  </label>
                </div>
              </>
            )}
            <button className="primary big" disabled={!!busy} onClick={findVideos}>Find videos</button>
          </section>

          {busy && <p className="busy">{busy}</p>}
          {msg && <p className="err">{msg}</p>}

          {found.length > 0 && (
            <section className="card">
              <h2><span className="n">3</span> Tick the videos to script</h2>
              <div className="row">
                <button onClick={() => setPicked(new Set(found.map((r) => r.shortcode)))}>Tick all</button>
                <button onClick={() => setPicked(new Set())}>Untick all</button>
              </div>
              <ul className="reels">
                {found.map((r) => (
                  <li key={r.shortcode}>
                    <label className="reel">
                      <input type="checkbox" checked={picked.has(r.shortcode)} onChange={(e) => { const s = new Set(picked); e.target.checked ? s.add(r.shortcode) : s.delete(r.shortcode); setPicked(s); }} />
                      <span className="grow">
                        <strong>@{r.username}</strong> · {day(r.takenAt)}<br />
                        <span className="muted">{r.caption.slice(0, 110) || "(no caption)"}</span>
                      </span>
                      <span className="stats">{fmt(r.views)} views<br />{fmt(r.likes)} likes · {fmt(r.shares)} shares</span>
                    </label>
                    <a href={r.link} target="_blank" rel="noreferrer">Open</a>
                  </li>
                ))}
              </ul>
              <button className="primary big" disabled={!!busy || !picked.size} onClick={writeScripts}>Write {picked.size} script{picked.size === 1 ? "" : "s"}</button>
              <p className="muted">Takes about 2 to 4 minutes per video. Keep this tab open.</p>
            </section>
          )}

          {jobs.length > 0 && (
            <section className="card">
              <h2><span className="n">4</span> Your scripts</h2>
              {allMd && (
                <div className="row">
                  <button className="primary" onClick={() => copy(allMd, "all")}>{copied === "all" ? "Copied ✓" : "Copy all for Google Docs"}</button>
                  <button onClick={() => download(allMd, `scripts-${stamp()}.md`)}>Download .md file</button>
                </div>
              )}
              {jobs.map((j, i) => (
                <div className="job" key={j.reel.shortcode}>
                  <div className="row">
                    <strong className="grow">{j.title || `@${j.reel.username} · ${fmt(j.reel.views)} views`}</strong>
                    {j.md && <button onClick={() => copy(j.md!, j.reel.shortcode)}>{copied === j.reel.shortcode ? "Copied ✓" : "Copy"}</button>}
                    {j.status === "Failed" && <button disabled={!!busy} onClick={() => retry(i)}>Retry</button>}
                  </div>
                  {j.status !== "Done" && j.status !== "Failed" && (
                    <ol className="steps">{STEPS.slice(0, 5).map((s) => <li key={s} className={s === j.status ? "now" : STEPS.indexOf(s) < STEPS.indexOf(j.status) ? "did" : ""}>{s}</li>)}</ol>
                  )}
                  {j.error && <p className="err small">{j.error}</p>}
                  {j.md && <pre className="md">{j.md}</pre>}
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </main>
  );
}
