import { PointerEvent as PE, ReactNode, useEffect, useRef, useState } from "react";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function useCountUp(target: number, ms = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (reduced()) { setV(target); return; }
    let raf = 0; const t0 = performance.now();
    const tick = (t: number) => { const p = Math.min(1, (t - t0) / ms); setV(Math.round(target * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

const K3 = "ap3d";
export function use3D(): [boolean, (v: boolean) => void] {
  const read = () => { try { return localStorage.getItem(K3) !== "off"; } catch { return true; } };
  const [on, setOn] = useState(read);
  useEffect(() => { const h = () => setOn(read()); window.addEventListener("ap-3d", h); return () => window.removeEventListener("ap-3d", h); }, []);
  return [on, v => { try { localStorage.setItem(K3, v ? "on" : "off"); } catch { /* ignore */ } window.dispatchEvent(new Event("ap-3d")); }];
}
export function Toggle3D({ dark = true }: { dark?: boolean }) {
  const [on, set] = use3D();
  return <button role="switch" aria-checked={on} onClick={() => set(!on)} className={`flex w-full items-center justify-between gap-3 text-sm ${dark ? "text-white/65 hover:text-white" : "text-ink"}`}>
    3D effects<span className={`relative h-5 w-9 rounded-full transition-colors ${on ? "bg-signal" : dark ? "bg-white/20" : "bg-line"}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-card transition-all ${on ? "left-[18px]" : "left-0.5"}`} /></span></button>;
}
/** Skills on a rotating sphere (pure CSS 3D). Falls back to plain chips when 3D is off. */
export function SkillCloud({ skills }: { skills: string[] }) {
  const [on] = use3D(); const list = skills.slice(0, 36), R = 125;
  if (!list.length) return <p className="text-sm text-ink/70">No skills yet. Upload a resume to fill this in.</p>;
  if (!on) return <div className="flex flex-wrap gap-1.5">{list.map(s => <span key={s} className="rounded-md bg-sky px-2 py-0.5 text-sm">{s}</span>)}</div>;
  return <div style={{ perspective: 800 }} className="relative h-72 overflow-hidden rounded-xl bg-gradient-to-b from-[#14142a] to-[#0b0b16]">
    <ul className="sr-only">{list.map(s => <li key={s}>{s}</li>)}</ul>
    <div aria-hidden="true" className="cloud absolute left-1/2 top-1/2 h-0 w-0">{list.map((s, i) => {
      const y = 1 - (2 * (i + 0.5)) / list.length, r = Math.sqrt(1 - y * y), a = i * 2.399963;
      return <span key={s} className="skill" style={{ transform: `translate3d(${Math.cos(a) * r * R}px,${y * R}px,${Math.sin(a) * r * R}px)` }}><span className="skill-in">{s}</span></span>;
    })}</div></div>;
}

export const tone = (n: number) => (n >= 75 ? "#34D399" : n >= 50 ? "#38BDF8" : "#F5B544");

/** Instrument-style dial: 270° arc that sweeps to the value, with tick marks on large sizes. */
export function Gauge({ value, size = 200, label }: { value: number; size?: number; label?: string }) {
  const big = size >= 120, sw = big ? 12 : 6, r = size / 2 - sw - (big ? 14 : 2), c = 2 * Math.PI * r, arc = c * 0.75, cx = size / 2;
  const [go, setGo] = useState(false);
  useEffect(() => { const t = setTimeout(() => setGo(true), 80); return () => clearTimeout(t); }, []);
  const n = useCountUp(value);
  const ticks = big ? Array.from({ length: 28 }, (_, i) => {
    const a = ((135 + (i * 270) / 27) * Math.PI) / 180, long = i % 3 === 0, r1 = r + sw / 2 + 6, r2 = r1 + (long ? 8 : 4);
    return <line key={i} x1={cx + r1 * Math.cos(a)} y1={cx + r1 * Math.sin(a)} x2={cx + r2 * Math.cos(a)} y2={cx + r2 * Math.sin(a)} stroke="#3A3A5C" strokeWidth={long ? 2 : 1} />;
  }) : null;
  return (
    <div className={`relative shrink-0 ${big ? "float3d" : ""}`} style={{ width: size, height: size }} role="img" aria-label={`${label ?? "Score"}: ${value} out of 100`}>
      <svg width={size} height={size}>
        {ticks}
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="#2A2A45" strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${arc} ${c}`} transform={`rotate(135 ${cx} ${cx})`} />
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={tone(value)} strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${arc} ${c}`}
          strokeDashoffset={go ? arc * (1 - value / 100) : arc} transform={`rotate(135 ${cx} ${cx})`}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.2,.8,.2,1)" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-semibold leading-none ${big ? "text-5xl" : "text-base"}`}>{n}{!big && "%"}</span>
        {big && <span className="mt-1 text-xs text-ink/60">{label ?? "out of 100"}</span>}
      </div>
    </div>
  );
}

export function Bar({ value, max, color = "#38BDF8" }: { value: number; max: number; color?: string }) {
  const [go, setGo] = useState(false);
  useEffect(() => { const t = setTimeout(() => setGo(true), 80); return () => clearTimeout(t); }, []);
  return <div className="h-2 rounded-full bg-sky"><div className="h-2 rounded-full" style={{ width: go ? `${(value / max) * 100}%` : 0, background: color, transition: "width 1s cubic-bezier(.2,.8,.2,1)" }} /></div>;
}

export function Tilt({ children, max = 5, className = "" }: { children: ReactNode; max?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: PE<HTMLDivElement>) => {
    if (reduced() || e.pointerType === "touch" || !ref.current) return;
    const r = ref.current.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    ref.current.style.setProperty("--gx", `${e.clientX - r.left}px`); ref.current.style.setProperty("--gy", `${e.clientY - r.top}px`);
    ref.current.style.transform = `perspective(900px) rotateX(${-y * max}deg) rotateY(${x * max}deg)`;
  };
  return <div ref={ref} className={`tilt rounded-xl ${className}`} onPointerMove={move} onPointerLeave={() => { if (ref.current) ref.current.style.transform = ""; }}>{children}</div>;
}

export function Logo3D() {
  const faces = ["rotateY(0deg)", "rotateY(90deg)", "rotateY(180deg)", "rotateY(-90deg)", "rotateX(90deg)", "rotateX(-90deg)"];
  return <span aria-hidden="true" style={{ perspective: 200, display: "inline-block" }}><span className="cube">{faces.map(f => <i key={f} style={{ transform: `${f} translateZ(10px)` }} />)}</span></span>;
}

export function Card({ children, className = "", tilt = false }: { children: ReactNode; className?: string; tilt?: boolean }) {
  const el = <section className={`rounded-xl border border-line bg-card p-5 ${className}`}>{children}</section>;
  return tilt ? <Tilt max={3}>{el}</Tilt> : el;
}
export const Err = ({ msg }: { msg: string }) => msg ? <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{msg}</p> : null;
export const Skeleton = ({ h = "h-24" }: { h?: string }) => <div className={`shimmer ${h}`} />;
export const Demo = () => <span className="rounded bg-sky px-1.5 py-0.5 text-xs font-medium text-ink/70">Demo data</span>;
export function Flag({ level, text }: { level: string; text: string }) {
  const c = level === "danger" ? "bg-red-50 text-red-800" : level === "warn" ? "bg-amber-50 text-signal" : "bg-sky text-ink/70";
  return <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${c}`}>{text}</span>;
}
export function Stat({ label, value }: { label: string; value: number | string }) {
  const n = useCountUp(typeof value === "number" ? value : 0);
  return <Tilt max={9}><div className="rounded-xl border border-line bg-card p-4"><p className="text-sm text-ink/70">{label}</p>
    <p className="mt-1 text-3xl font-semibold">{typeof value === "number" ? n : value}</p></div></Tilt>;
}
