import { PointerEvent as PE, lazy, Suspense, useEffect, useRef, useState, useCallback } from "react";
import { LayoutDashboard, FileText, Briefcase, ListChecks, MessageSquare, UserCircle, Menu, X, Upload, Send, Download, Trash2, LogOut, Copy, Box, ChevronLeft, ChevronRight } from "lucide-react";
import { api, json, STATUSES, label, ago } from "./api";
import { Gauge, Bar, Card, Err, Skeleton, Demo, Flag, Stat, Logo3D, tone, use3D, Toggle3D, SkillCloud } from "./ui";
import Login from "./Login";
const Globe = lazy(() => import("./Globe"));
const World = lazy(() => import("./World"));
const Pipeline3D = lazy(() => import("./Viz3D").then(m => ({ default: m.Pipeline3D })));
const MatchMap = lazy(() => import("./Viz3D").then(m => ({ default: m.MatchMap })));

type Page = "hub" | "dashboard" | "resume" | "jobs" | "tracker" | "chat" | "profile";
const NAV: { id: Page; name: string; icon: any }[] = [
  { id: "hub", name: "3D View", icon: Box },
  { id: "dashboard", name: "Overview", icon: LayoutDashboard }, { id: "resume", name: "Resume", icon: FileText },
  { id: "jobs", name: "Jobs", icon: Briefcase }, { id: "tracker", name: "Applications", icon: ListChecks },
  { id: "chat", name: "Assistant", icon: MessageSquare }, { id: "profile", name: "Profile", icon: UserCircle },
];

function useLoad<T>(path: string) {
  const [data, setData] = useState<T | null>(null); const [err, setErr] = useState(""); const [loading, setL] = useState(true);
  const reload = useCallback(() => { setL(true); api<T>(path).then(d => { setData(d); setErr(""); }).catch(e => setErr(e.message)).finally(() => setL(false)); }, [path]);
  useEffect(reload, [reload]);
  return { data, err, loading, reload };
}

export default function App() {
  const [auth, setAuth] = useState<"loading" | "login" | "ok" | "ok-auth">("loading");
  useEffect(() => {
    api("/auth/status").then(s => setAuth(s.authenticated ? (s.auth_required ? "ok-auth" : "ok") : "login")).catch(() => setAuth("ok"));
    const h = () => setAuth("login"); window.addEventListener("ap-unauth", h);
    return () => window.removeEventListener("ap-unauth", h);
  }, []);
  if (auth === "loading") return <div className="p-8"><Skeleton h="h-40" /></div>;
  if (auth === "login") return <Login onDone={() => setAuth("ok-auth")} />;
  return <Shell canLogout={auth === "ok-auth"} onLogout={async () => { await api("/auth/logout", { method: "POST" }); setAuth("login"); }} />;
}

function Shell({ canLogout, onLogout }: { canLogout: boolean; onLogout: () => void }) {
  const [page, setPage] = useState<Page>("hub"); const [open, setOpen] = useState(false);
  const go = (p: Page) => { setPage(p); setOpen(false); };
  const idx = NAV.findIndex(n => n.id === page);
  const [on3d] = use3D(); const slab = useRef<HTMLDivElement>(null);
  const { data: jobsForWorld, reload: reloadJobs } = useLoad<any[]>("/jobs?min_score=0");
  const labels = (jobsForWorld ?? []).slice().sort((a, b) => b.match.score - a.match.score).slice(0, 12).map(j => ({ text: String(j.title).slice(0, 34), score: j.match.score as number }));
  useEffect(() => { if (!on3d) return; const b = document.body.style.background, h = document.documentElement.style.background;
    document.documentElement.style.background = "#07070d"; document.body.style.background = "transparent";
    return () => { document.body.style.background = b; document.documentElement.style.background = h; }; }, [on3d]);
  const tilt = (e: PE<HTMLDivElement>) => { if (!slab.current || e.pointerType === "touch" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const x = e.clientX / innerWidth - 0.5, y = e.clientY / innerHeight - 0.5; slab.current.style.transform = `perspective(1800px) rotateX(${(-y * 1.4).toFixed(2)}deg) rotateY(${(x * 2.6).toFixed(2)}deg)`; };
  const nav = (dark: boolean) => (
    <nav aria-label="Main" className="relative">
      {dark && <span aria-hidden className="absolute left-0 top-0 h-11 w-1 rounded-r bg-signal transition-transform duration-300 ease-out" style={{ transform: `translateY(${idx * 44}px)` }} />}
      {NAV.map(n => <button key={n.id} onClick={() => go(n.id)} aria-current={page === n.id ? "page" : undefined}
        className={`flex h-11 w-full items-center gap-3 px-4 text-left text-sm transition-colors ${dark ? (page === n.id ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5 hover:text-white") : (page === n.id ? "bg-sky font-medium" : "hover:bg-sky")}`}>
        <n.icon size={18} />{n.name}</button>)}
    </nav>);
  return (
    <div className={`min-h-screen md:flex ${on3d ? "world" : ""}`} onPointerMove={on3d ? tilt : undefined}>
      {on3d && <Suspense fallback={null}><World index={idx} labels={labels} /></Suspense>}
      <aside className={`hidden w-60 shrink-0 flex-col py-6 md:flex ${on3d ? "dock md:sticky md:top-4 md:m-4 md:h-[calc(100vh-2rem)] md:self-start md:rounded-2xl md:border md:border-white/10 md:bg-[#0b0b16]/75 md:backdrop-blur-xl" : "bg-[#0b0b16]"}`}>
        <h1 className="mb-6 flex items-center gap-3 px-4 text-lg font-semibold tracking-tight text-white"><Logo3D />ApplyPilot AI</h1>{nav(true)}
        <div className="mt-auto px-4 py-2"><Toggle3D /></div>
        {canLogout && <button onClick={onLogout} className="flex items-center gap-2 px-4 py-2 text-sm text-white/65 hover:text-white"><LogOut size={16} />Sign out</button>}
      </aside>
      <header className="flex items-center justify-between bg-[#0b0b16] p-3 text-white md:hidden">
        <h1 className="flex items-center gap-3 font-semibold"><Logo3D />ApplyPilot AI</h1>
        <button aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
      </header>
      {open && <div className="border-b border-line bg-card md:hidden">{nav(false)}<div className="px-4 py-2"><Toggle3D dark={false} /></div>{canLogout && <button onClick={onLogout} className="flex h-11 items-center gap-2 px-4 text-sm"><LogOut size={16} />Sign out</button>}</div>}
      <main className="mx-auto w-full max-w-5xl p-4 md:p-8"><div ref={slab} className={on3d && page !== "hub" ? "world-slab rounded-3xl p-4 md:p-6" : ""}><div key={page} className="page">
        {page === "hub" && <Hub go={go} onJobs={reloadJobs} />}{page === "dashboard" && <Dashboard go={go} />}{page === "resume" && <Resume />}{page === "jobs" && <Jobs />}
        {page === "tracker" && <Tracker />}{page === "chat" && <Chat />}{page === "profile" && <Profile />}
      </div></div></main>
    </div>);
}

function Hub({ go, onJobs }: { go: (p: Page) => void; onJobs: () => void }) {
  const { data: d } = useLoad<any>("/dashboard"); const [on3d] = use3D();
  const items = NAV.filter(n => n.id !== "hub"); const has = d?.resume_score != null;
  const info: Record<string, [string, string]> = {
    dashboard: [d ? String(d.tracked) : "–", "applications tracked"], resume: [has ? String(d.resume_score) : "–", has ? "resume score" : "upload your CV"],
    jobs: [d ? String(d.jobs_discovered) : "–", "jobs discovered"], tracker: [d ? String(d.prepared) : "–", "applications prepared"],
    chat: ["Ask", "find jobs, review your CV"], profile: ["You", "skills and preferences"] };
  if (!on3d) return <div className="space-y-4"><h2 className="text-2xl font-semibold tracking-tight">Home</h2><div className="grid gap-3 sm:grid-cols-3">{items.map(n => <button key={n.id} onClick={() => go(n.id)} className="rounded-xl border border-line bg-card p-5 text-left"><n.icon size={20} /><p className="mt-2 text-3xl font-semibold">{info[n.id][0]}</p><p className="text-sm text-ink/70">{n.name} · {info[n.id][1]}</p></button>)}</div></div>;
  const stats: [string, string][] = [[d ? String(d.jobs_discovered) : "–", "jobs found"], [has ? String(d.resume_score) : "–", has ? "resume score" : "upload your CV"], [d ? String(d.tracked) : "–", "applications tracked"]];
  return (<div className="flex min-h-[80vh] max-w-xl flex-col justify-center gap-6">
    <h2 className="text-5xl font-semibold leading-[1.04] md:text-6xl">Make job decisions with confidence.</h2>
    <p className="max-w-md text-lg text-ink/70">ApplyPilot reads your resume, ranks every job by how well it fits, and shows why. The names floating on the sphere are your best matches right now.</p>
    <div className="flex flex-wrap gap-3"><button className="btn" onClick={() => go("jobs")}>See my matches</button><button className="btn-ghost" onClick={() => go("resume")}>Upload resume</button>{d && d.jobs_discovered === 0 && <button className="btn-ghost" onClick={async () => { await api("/jobs/refresh", { method: "POST" }); onJobs(); }}>Load demo jobs</button>}</div>
    <dl className="mt-2 flex flex-wrap gap-8">{stats.map(([v, l]) => <div key={l}><dt className="text-3xl font-semibold">{v}</dt><dd className="text-sm text-ink/60">{l}</dd></div>)}</dl>
  </div>);
}

function Dashboard({ go }: { go: (p: Page) => void }) {
  const { data: d, loading, err } = useLoad<any>("/dashboard"); const [on3d] = use3D();
  if (loading) return <div className="grid gap-3 sm:grid-cols-3">{[...Array(6)].map((_, i) => <Skeleton key={i} />)}</div>;
  if (err || !d) return <Err msg={err} />;
  const stats: [string, number][] = [["Jobs discovered", d.jobs_discovered], ["Jobs matching (60%+)", d.jobs_matching], ["Applications prepared", d.prepared],
    ["Awaiting approval", d.awaiting_approval], ["Confirmed submissions", d.confirmed], ["Interviews and offers", d.interviews_offers]];
  return (<div className="space-y-6">
    <Card className="flex flex-col items-center gap-6 sm:flex-row">
      {d.resume_score !== null ? <Gauge value={d.resume_score} size={210} label="Resume readiness" /> : <div className="flex h-[210px] w-[210px] shrink-0 items-center justify-center rounded-full border-2 border-dashed border-line text-sm text-ink/60">No score yet</div>}
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{d.resume_score === null ? "Start with your resume" : "Your flight plan"}</h2>
        <p className="mt-2 max-w-md text-ink/70">{d.resume_score === null ? "Upload your CV to get a score, then find real jobs ranked by how well they fit it." : `${d.tracked} applications tracked. Find new jobs or review your drafts.`}</p>
        <div className="mt-4 flex gap-2"><button className="btn" onClick={() => go(d.resume_score === null ? "resume" : "jobs")}>{d.resume_score === null ? "Upload resume" : "Find jobs"}</button>
          {d.resume_score !== null && <button className="btn-ghost" onClick={() => go("tracker")}>Applications</button>}</div>
      </div>
      <div className="ml-auto hidden h-56 w-64 shrink-0 overflow-hidden rounded-xl bg-[#0b0b16] lg:block">{on3d && <Suspense fallback={null}><Globe zoom={4.3} interactive={false} /></Suspense>}</div>
    </Card>
    {d.demo_jobs_only && <p className="text-sm text-signal">All listed jobs are demo data, not real openings.</p>}
    <div className="grid gap-3 sm:grid-cols-3">{stats.map(([k, v]) => <Stat key={k} label={k} value={v} />)}</div>
    <Card><h3 className="mb-3 font-medium">Pipeline in 3D</h3><Suspense fallback={<Skeleton h="h-72" />}><Pipeline3D stats={stats} /></Suspense></Card>
    <Card><h3 className="mb-2 font-medium">Recent activity</h3>
      {d.recent.length ? <ul className="space-y-1 text-sm">{d.recent.map((r: any, i: number) => <li key={i}>{label(r.action)} <span className="text-ink/60">{new Date(r.at).toLocaleString()}</span></li>)}</ul>
        : <p className="text-sm text-ink/70">No activity yet.</p>}</Card></div>);
}

function Resume() {
  const { data, loading, reload } = useLoad<any>("/resume"); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function upload(f?: File) {
    if (!f) return; setBusy(true); setErr("");
    const fd = new FormData(); fd.append("file", f);
    try { await api("/resume", { method: "POST", body: fd }); reload(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  const a = data?.analysis;
  return (<div className="space-y-6"><h2 className="text-2xl font-semibold tracking-tight">Resume</h2>
    <Card><label className="btn cursor-pointer"><Upload size={16} />{busy ? "Analyzing…" : a ? "Replace resume" : "Upload PDF or DOCX"}
      <input type="file" accept=".pdf,.docx" className="sr-only" disabled={busy} onChange={e => upload(e.target.files?.[0])} /></label>
      <p className="mt-2 text-sm text-ink/70">Max 5 MB. Scanned PDFs are not supported yet.</p>
      {a && <button className="btn-ghost mt-3" onClick={async () => { await api("/resume", { method: "DELETE" }); reload(); }}><Trash2 size={16} />Delete resume</button>}</Card>
    <Err msg={err} />{loading && <Skeleton h="h-48" />}
    {!loading && !a && <Card><p>No resume yet. Upload one to see your score and recommendations.</p></Card>}
    {a && (<>
      <Card className="flex flex-col items-center gap-6 sm:flex-row">
        <Gauge key={a.score} value={a.score} size={210} />
        <div><p className="text-xl font-semibold">{a.grade}</p><p className="mt-1">ATS readability: {a.ats_readability}.</p>
          <p className="mt-1 text-sm">Method: {a.method === "ai" ? "AI analysis" : "Basic rule-based checks"}</p>
          {a.notice && <p role="status" className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-signal">{a.notice}</p>}
          <p className="mt-3 text-sm text-ink/70">{a.methodology}</p></div></Card>
      <Card><h3 className="mb-3 font-medium">How the score was calculated</h3>
        <ul className="space-y-3">{a.breakdown.map((b: any) => <li key={b.check}>
          <div className="mb-1 flex justify-between text-sm"><span>{b.check}</span><span>{b.score}/{b.max}</span></div>
          <Bar value={b.score} max={b.max} color={tone((b.score / b.max) * 100)} /><p className="mt-1 text-xs text-ink/60">{b.note}</p></li>)}</ul></Card>
      {a.strengths?.length > 0 && <Card><h3 className="mb-2 font-medium">Strengths</h3><ul className="list-disc space-y-1 pl-5 text-sm">{a.strengths.map((i: string) => <li key={i}>{i}</li>)}</ul></Card>}
      <div className="grid gap-4 md:grid-cols-2">
        <Card><h3 className="mb-2 font-medium">Issues</h3>{a.issues.length ? <ul className="list-disc space-y-1 pl-5 text-sm">{a.issues.map((i: string) => <li key={i}>{i}</li>)}</ul> : <p className="text-sm">None detected.</p>}</Card>
        <Card><h3 className="mb-2 font-medium">Recommendations</h3><ul className="list-disc space-y-1 pl-5 text-sm">{a.recommendations.map((i: string) => <li key={i}>{i}</li>)}</ul>
          {a.missing_keywords.length > 0 && <p className="mt-3 text-sm">Commonly expected keywords not found: {a.missing_keywords.join(", ")}.</p>}</Card></div>
      {a.before_after.length > 0 && <Card><h3 className="mb-2 font-medium">Suggested rewrites</h3>
        {a.before_after.map((x: any, i: number) => <div key={i} className="mb-3 text-sm"><p className="text-ink/60">Before: {x.before}</p><p>After: {x.after}</p></div>)}
        <p className="text-xs text-ink/60">Fill in real numbers only. Do not claim results you did not achieve.</p></Card>}</>)}</div>);
}

function Jobs() {
  const [f, setF] = useState({ q: "", remote: "", job_type: "", min_score: "40" });
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v && v !== "0") as [string, string][]).toString();
  const { data, loading, reload, err } = useLoad<any[]>("/jobs?" + qs);
  const { data: prof } = useLoad<any>("/profile");
  const [msg, setMsg] = useState(""); const [pm, setPm] = useState("60"); const [pl, setPl] = useState("15");
  const [busyP, setBusyP] = useState(false); const [busyD, setBusyD] = useState(false); const [disc, setDisc] = useState<any>(null);
  async function discover() { setBusyD(true); setMsg(""); try { setDisc(await api("/jobs/discover", { method: "POST" })); reload(); } catch (e: any) { setMsg(e.message); } finally { setBusyD(false); } }
  async function prepare() {
    setBusyP(true); setMsg("");
    try { const r = await api("/applications/prepare", json("POST", { min_score: Number(pm), limit: 200, per_source_daily: Number(pl) }));
      setMsg(r.prepared ? `Prepared ${r.prepared} applications (${r.ai_letters} AI letters). Review them in Applications.` : "No new jobs reached that match level."); reload();
    } catch (e: any) { setMsg(e.message); } finally { setBusyP(false); }
  }
  async function track(id: number) { try { await api("/applications", json("POST", { job_id: id })); setMsg("Added to Applications."); } catch (e: any) { setMsg(e.message); } }
  return (<div className="space-y-4"><div><h2 className="text-3xl font-semibold tracking-tight">Job Matches</h2><p className="text-ink/60">Find your next career opportunity</p></div>
    <div className="flex flex-wrap gap-2">
      <button className="btn" disabled={busyD} onClick={discover}>{busyD ? "Searching…" : "Find real jobs for my resume"}</button>
      <button className="btn-ghost" onClick={async () => { await api("/jobs/refresh", { method: "POST" }); reload(); }}>Load demo jobs</button></div>
    {disc && <Card><p className="text-sm">Added {disc.added} new jobs from: {disc.sources_used.join(", ") || "no source"}. Searched for: {disc.queries.join(", ")}.
      {(disc.skipped_suspicious > 0 || disc.skipped_old > 0) && ` Skipped ${disc.skipped_suspicious} suspicious and ${disc.skipped_old} outdated listings.`}</p>
      {Object.entries(disc.errors).map(([k, v]) => <p key={k} role="alert" className="mt-1 text-sm text-signal">{k}: {String(v)}</p>)}</Card>}
    <Card><h3 className="font-medium">Prepare applications</h3>
      <p className="mb-3 text-sm text-ink/70">Drafts a cover letter and adds every matching job to Applications. It does not submit anything: you open each listing and apply yourself.</p>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Minimum match" className="input max-w-[10rem]" value={pm} onChange={e => setPm(e.target.value)}><option value="50">50%+ match</option><option value="60">60%+ match</option><option value="70">70%+ match</option></select>
        <select aria-label="Per platform per day" className="input max-w-[14rem]" value={pl} onChange={e => setPl(e.target.value)}><option value="10">10 per platform per day</option><option value="15">15 per platform per day</option><option value="20">20 per platform per day</option></select>
        <button className="btn" disabled={busyP} onClick={prepare}>{busyP ? "Preparing…" : "Prepare applications"}</button></div></Card>
    <PlatformLinks prof={prof} />
    <Card className="grid gap-3 sm:grid-cols-4">
      <input aria-label="Search" className="input" placeholder="Search title or company" value={f.q} onChange={e => setF({ ...f, q: e.target.value })} />
      <select aria-label="Work type" className="input" value={f.remote} onChange={e => setF({ ...f, remote: e.target.value })}><option value="">Any location</option><option value="true">Remote</option><option value="false">On-site</option></select>
      <select aria-label="Job type" className="input" value={f.job_type} onChange={e => setF({ ...f, job_type: e.target.value })}><option value="">Any type</option><option value="internship">Internship</option><option value="full-time">Full-time</option></select>
      <select aria-label="Minimum match" className="input" value={f.min_score} onChange={e => setF({ ...f, min_score: e.target.value })}><option value="0">All jobs</option><option value="40">Good matches (40%+)</option><option value="60">Strong matches (60%+)</option><option value="75">Best matches (75%+)</option></select></Card>
    {!!data?.length && <Card><h3 className="font-medium">Match map</h3><p className="mb-3 text-sm text-ink/70">Each planet is a job. Green is a strong match, blue is fair, amber is weak.</p><UniverseStats jobs={data} /><Suspense fallback={<Skeleton h="h-72" />}><MatchMap jobs={data} onPick={t => setF({ ...f, q: t })} /></Suspense></Card>}
    <p role="status" className="text-sm">{msg}</p><Err msg={err} />
    {loading && <Skeleton h="h-32" />}
    {!loading && data?.length === 0 && <Card><p>No jobs at this match level. Click “Find real jobs for my resume”, or lower the match filter.</p></Card>}
    {!!data?.length && <section className="overflow-hidden rounded-2xl border border-line bg-card">
      <div className="border-b border-line p-5"><h3 className="text-xl font-semibold">Matching jobs</h3><p className="text-sm text-ink/60">{data.length} jobs found</p></div>
      {data.map(j => { const fresh = j.posted_at && Date.now() - new Date(j.posted_at).getTime() < 7 * 864e5;
        return <article key={j.id} className="grid gap-3 border-b border-line p-5 last:border-b-0 sm:grid-cols-[1fr_auto] sm:gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-semibold leading-snug">{j.title}</h3>
              {fresh && <span className="rounded-full bg-azure/20 px-2 py-0.5 text-xs font-medium text-azure">New</span>}
              {j.is_demo && <Demo />}</div>
            <p className="mt-1 text-sm text-ink/60">{j.company} · {j.location}{j.remote ? " (remote)" : ""}{j.posted_at && ` · posted ${ago(j.posted_at)}`}</p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
              {j.salary && <span className="rounded-full border border-mint/40 px-2.5 py-0.5 text-mint">{j.salary}</span>}
              <span className="rounded-full border border-cyan/40 px-2.5 py-0.5 text-cyan">{j.remote ? "Remote" : j.job_type}</span>
              {j.flags.map((x: any) => <Flag key={x.text} {...x} />)}</div>
            <details className="mt-3 text-sm"><summary className="cursor-pointer font-medium">Why this score</summary>
              <ul className="mt-1 list-disc pl-5">{j.match.reasons.map((r: string) => <li key={r}>{r}</li>)}{j.match.gaps.map((r: string) => <li key={r} className="text-signal">{r}</li>)}</ul></details>
            <p className="mt-2 text-xs text-ink/50">Source: {label(j.source)}{j.source === "remotive" && " (remotive.com)"}</p></div>
          <div className="flex items-center gap-4 sm:flex-col sm:items-end">
            <Gauge key={j.id + "-" + j.match.score} value={j.match.score} size={64} label="Match" />
            <div className="flex gap-2 sm:flex-col"><button className="btn" onClick={() => track(j.id)}>Shortlist</button>
              {j.url && <a className="btn-ghost" href={j.url} target="_blank" rel="noopener noreferrer">View listing</a>}</div></div>
        </article>; })}
    </section>}</div>);
}

/** Knowledge-universe style summary above the match map. */
function UniverseStats({ jobs }: { jobs: any[] }) {
  const s: number[] = jobs.map(j => j.match.score);
  const strong = s.filter(n => n >= 75).length, fair = s.filter(n => n >= 50 && n < 75).length, weak = s.length - strong - fair;
  const avg = s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : 0;
  const tiles: [string, number, string][] = [["Total jobs", s.length, "#ECEBF8"], ["Strong, 75%+", strong, "#34D399"], ["Fair, 50–74%", fair, "#38BDF8"], ["Weak", weak, "#F5B544"]];
  return <div className="mb-3 space-y-3"><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
    {tiles.map(([l, v, c]) => <div key={l} className="rounded-xl border border-line bg-sky/50 p-3"><p className="text-xs text-ink/60">{l}</p><p className="text-2xl font-semibold" style={{ color: c }}>{v}</p></div>)}</div>
    <div><p className="mb-1 flex justify-between text-xs text-ink/60"><span>Average match</span><span>{avg}%</span></p>
    <Bar value={avg} max={100} color="#8B5CF6" /></div></div>;
}

const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function PlatformLinks({ prof }: { prof: any }) {
  const q = (prof?.preferred_roles?.[0] || (prof?.skills || []).slice(0, 2).join(" ") || "").trim();
  if (!q) return null;
  const loc = prof?.preferred_locations?.[0] || "India", e = encodeURIComponent;
  const links: [string, string][] = [
    ["LinkedIn", `https://www.linkedin.com/jobs/search/?keywords=${e(q)}&location=${e(loc)}`],
    ["Naukri", `https://www.naukri.com/${slug(q)}-jobs`],
    ["Indeed", `https://in.indeed.com/jobs?q=${e(q)}&l=${e(loc)}`],
    ["Internshala", `https://internshala.com/internships/keywords-${slug(q)}/`],
    ["Google Jobs", `https://www.google.com/search?q=${e(q + " jobs " + loc)}&ibp=htl;jobs`],
  ];
  return <Card><h3 className="font-medium">Search “{q}” on other platforms</h3>
    <p className="mb-3 text-sm text-ink/70">These open each site's own results in a new tab. ApplyPilot does not read or automate them, and the layouts there can change.</p>
    <div className="flex flex-wrap gap-2">{links.map(([n, u]) => <a key={n} className="btn-ghost" href={u} target="_blank" rel="noopener noreferrer">{n}</a>)}</div></Card>;
}

function Tracker() {
  const [q, setQ] = useState(""); const [st, setSt] = useState("");
  const { data, loading, reload, err } = useLoad<any[]>(`/applications?q=${encodeURIComponent(q)}&status=${st}`);
  const [e2, setE2] = useState(""); const [copied, setCopied] = useState(0);
  async function setStatus(id: number, status: string) { try { setE2(""); await api(`/applications/${id}`, json("PATCH", { status })); reload(); } catch (e: any) { setE2(e.message); } }
  return (<div className="space-y-4"><h2 className="text-2xl font-semibold tracking-tight">Applications</h2>
    <p className="text-sm text-ink/70">“Submitted confirmed” means you reported it. ApplyPilot cannot submit or verify applications.</p>
    <div className="flex flex-wrap gap-2"><input aria-label="Search" className="input max-w-xs" placeholder="Search" value={q} onChange={e => setQ(e.target.value)} />
      <select aria-label="Status" className="input max-w-xs" value={st} onChange={e => setSt(e.target.value)}><option value="">All statuses</option>{STATUSES.map(s => <option key={s} value={s}>{label(s)}</option>)}</select>
      <a className="btn-ghost" href="/api/applications.csv"><Download size={16} />Export CSV</a></div>
    <Err msg={err || e2} />{loading && <Skeleton />}
    {!loading && data?.length === 0 && <Card><p>Nothing tracked yet. Shortlist a job to start.</p></Card>}
    {data?.map(a => <Card key={a.id} tilt className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="font-medium">{a.title} {a.is_demo && <Demo />}</p><p className="text-sm text-ink/70">{a.company} · updated {new Date(a.updated_at).toLocaleDateString()}{a.confirmation_source && ` · ${label(a.confirmation_source)}`}</p>
          <p className="mt-1 text-sm">Status: <strong>{label(a.status)}</strong></p></div>
        <div className="flex gap-2"><select aria-label={`Status for ${a.title}`} className="input" value={a.status} onChange={e => setStatus(a.id, e.target.value)}>{STATUSES.map(s => <option key={s} value={s}>{label(s)}</option>)}</select>
          <button className="btn-ghost" aria-label="Remove" onClick={async () => { await api(`/applications/${a.id}`, { method: "DELETE" }); reload(); }}><Trash2 size={16} /></button></div></div>
      {a.cover_letter && <details className="text-sm"><summary className="cursor-pointer font-medium">Cover letter draft</summary>
        <p className="mt-2 whitespace-pre-wrap rounded-lg bg-cloud p-3">{a.cover_letter}</p>
        <button className="btn-ghost mt-2" onClick={() => { navigator.clipboard.writeText(a.cover_letter); setCopied(a.id); }}><Copy size={14} />{copied === a.id ? "Copied" : "Copy letter"}</button></details>}
      {a.url ? <a className="btn-ghost" href={a.url} target="_blank" rel="noopener noreferrer">Open listing</a> : a.is_demo && <span className="text-xs text-ink/60">Demo job: no real listing</span>}</Card>)}</div>);
}

function Chat() {
  const [msgs, setMsgs] = useState<{ role: string; text: string }[]>([{ role: "bot", text: "Ask me to find jobs, explain a match, or review your resume." }]);
  const [t, setT] = useState(""); const [busy, setBusy] = useState(false);
  async function send() {
    if (!t.trim()) return; const m = t; setT(""); setBusy(true); setMsgs(x => [...x, { role: "me", text: m }]);
    try { const r = await api("/chat", json("POST", { message: m })); setMsgs(x => [...x, { role: "bot", text: r.reply }]); }
    catch (e: any) { setMsgs(x => [...x, { role: "bot", text: "Error: " + e.message }]); } finally { setBusy(false); }
  }
  return (<div className="space-y-4"><h2 className="text-2xl font-semibold tracking-tight">Assistant</h2>
    <Card className="min-h-[300px]"><div aria-live="polite" className="space-y-3">{msgs.map((m, i) => <p key={i} className={`whitespace-pre-wrap rounded-xl p-3 text-sm ${m.role === "me" ? "ml-10 bg-azure text-white" : "mr-10 bg-cloud"}`}>{m.text}</p>)}</div></Card>
    <div className="flex gap-2"><input aria-label="Message" className="input" value={t} onChange={e => setT(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Find remote internships" />
      <button className="btn" disabled={busy} onClick={send}><Send size={16} />Send</button></div></div>);
}

const CSV_FIELDS: [string, string][] = [["skills", "Skills"], ["preferred_roles", "Preferred roles"], ["preferred_locations", "Preferred locations"]];
function Profile() {
  const { data, loading, err } = useLoad<any>("/profile"); const [p, setP] = useState<any>(null); const [msg, setMsg] = useState("");
  useEffect(() => { if (data) setP(data); }, [data]);
  if (loading || !p) return err ? <Err msg={err} /> : <Skeleton h="h-40" />;
  const save = async () => { try { await api("/profile", json("PUT", p)); setMsg("Saved."); } catch (e: any) { setMsg(e.message); } };
  return (<div className="space-y-4"><h2 className="text-2xl font-semibold tracking-tight">Profile and preferences</h2>
    <p className="text-sm text-ink/70">Extracted from your resume. Correct anything that looks wrong: matching only uses what is here. Set your years of experience honestly, since senior roles are scored against it.</p>
    <Card className="grid gap-4 sm:grid-cols-2">
      {[["name", "Name"], ["email", "Email"], ["phone", "Phone"]].map(([k, l]) => <label key={k} className="text-sm">{l}<input className="input mt-1" value={p[k]} onChange={e => setP({ ...p, [k]: e.target.value })} /></label>)}
      <label className="text-sm">Years of experience<input type="number" min={0} step={0.5} className="input mt-1" value={p.experience_years} onChange={e => setP({ ...p, experience_years: Number(e.target.value) })} /></label>
      {CSV_FIELDS.map(([k, l]) => <label key={k} className="text-sm sm:col-span-2">{l} (comma separated)<input className="input mt-1" value={p[k].join(", ")} onChange={e => setP({ ...p, [k]: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })} /></label>)}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.remote_ok} onChange={e => setP({ ...p, remote_ok: e.target.checked })} />Open to remote work</label></Card>
    <Card><h3 className="mb-3 font-medium">Your skills in 3D</h3><SkillCloud skills={p.skills} /></Card>
    <button className="btn" onClick={save}>Save profile</button><span role="status" className="ml-3 text-sm">{msg}</span>
    <Card><h3 className="font-medium">Your data</h3><p className="mb-3 text-sm text-ink/70">Deletes your resume, profile and tracked applications.</p>
      <button className="btn-ghost" onClick={async () => { if (confirm("Delete all your data? This cannot be undone.")) { await api("/account-data", { method: "DELETE" }); location.reload(); } }}><Trash2 size={16} />Delete all my data</button></Card></div>);
}
