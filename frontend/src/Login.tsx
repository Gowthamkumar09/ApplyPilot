import { lazy, Suspense, useState } from "react";
import { api, json } from "./api";
import { Err, Logo3D, Tilt } from "./ui";

const Globe = lazy(() => import("./Globe"));

export default function Login({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true); setErr("");
    try { await api("/auth/login", json("POST", { password: pw })); onDone(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0b0b16]">
      <div className="absolute inset-0 opacity-90"><Suspense fallback={null}><Globe zoom={3.9} /></Suspense></div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0b0b16] via-transparent to-[#0b0b16]/60" />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-5 py-10 text-white" style={{ perspective: 1200 }}>
        <div className="mb-8 text-center">
          <div className="mb-3 flex items-center justify-center gap-3 text-white/70"><Logo3D /><span className="text-sm tracking-[0.3em]">YOUR JOB-SEARCH COPILOT</span></div>
          <h1 className="text-5xl font-semibold tracking-tight md:text-7xl" aria-label="ApplyPilot AI">
            {"ApplyPilot AI".split("").map((c, i) => <span key={i} className="letter" style={{ ["--i" as any]: i }} aria-hidden="true">{c === " " ? "\u00A0" : c}</span>)}
          </h1>
        </div>
        <div className="rise w-full max-w-sm"><Tilt max={8}>
          <div className="glass rounded-2xl p-6 shadow-2xl">
            <h2 className="text-lg font-semibold">Sign in</h2>
            <p className="mb-4 mt-1 text-sm text-white/65">Enter the password set for this server.</p>
            <label className="text-sm font-medium">Password
              <input type="password" autoFocus value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()}
                className="mt-1 w-full rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-white placeholder-white/40 focus:border-signal" /></label>
            <div className="mt-3"><Err msg={err} /></div>
            <button className="btn mt-4 w-full" disabled={busy || !pw} onClick={submit}>{busy ? "Signing in…" : "Sign in"}</button>
          </div></Tilt></div>
      </div>
    </div>);
}
