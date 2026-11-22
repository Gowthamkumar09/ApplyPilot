import { useEffect, useRef } from "react";
import { makeBrain, drawBrain } from "./brain";
type Lab = { text: string; score: number };

/**
 * Fixed full-screen background with two scenes that cross-fade when you change page:
 *  - Home: a Dala-style brain made of tiny triangles, with neurons firing and your best job names floating around it.
 *  - Every other page: a Vexel-style dome of glowing cyan dashes in concentric rings with a scalloped lower edge.
 */
export default function World({ index, labels = [] }: { index: number; labels?: Lab[] }) {
  const ref = useRef<HTMLCanvasElement>(null); const box = useRef<HTMLDivElement>(null);
  const idx = useRef(index); idx.current = index;
  const lab = useRef(labels); lab.current = labels;
  const draw = useRef<((t: number) => void) | null>(null);
  const reduce = useRef(false);

  useEffect(() => {
    const cv = ref.current!; const x = cv.getContext("2d"); if (!x) return;
    reduce.current = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const still = reduce.current;
    const brain = makeBrain();
    let w = 0, h = 0, mix = idx.current === 0 ? 0 : 1, mx = 0, my = 0, tx = 0, ty = 0, raf = 0;
    const resize = () => { const d = Math.min(devicePixelRatio, 2); w = innerWidth; h = innerHeight; cv.width = w * d; cv.height = h * d; x.setTransform(d, 0, 0, d, 0, 0); };
    const mv = (e: PointerEvent) => { tx = (e.clientX / innerWidth - 0.5) * 0.9; ty = (e.clientY / innerHeight - 0.5) * 0.6; };
    resize(); addEventListener("resize", resize); addEventListener("pointermove", mv);

    /* ---- Vexel dome ---- */
    const dome = (t: number, alpha: number) => {
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#00306e"); g.addColorStop(1, "#00091c");
      x.globalAlpha = alpha; x.fillStyle = g; x.fillRect(0, 0, w, h);
      const cx = w / 2 + mx * 50, cy = -h * 0.04 + my * 30, Rmax = Math.min(w * 0.62, h * 0.95), Rin = Math.max(110, w * 0.1), K = 34, sp = (Rmax - Rin) / K;
      const glow = x.createRadialGradient(cx, cy + Rmax * 0.5, 10, cx, cy + Rmax * 0.5, Rmax * 0.9); glow.addColorStop(0, "rgba(56,189,248,0.22)"); glow.addColorStop(1, "rgba(56,189,248,0)");
      x.fillStyle = glow; x.fillRect(0, 0, w, h);
      for (let k = 0; k < K; k++) {
        const r = Rin + k * sp, cnt = Math.floor((Math.PI * r) / 12), sc = 0.8 + 0.9 * (k / K), off = (k % 2) * 0.5;
        for (let j = 0; j < cnt; j++) {
          const th = ((j + 0.5 + off) / (cnt + 0.5)) * Math.PI, edge = Rmax * (0.84 + 0.16 * Math.abs(Math.cos(4 * th)));
          if (r > edge) continue;
          const wave = 0.5 + 0.5 * Math.sin(k * 0.45 - t * 0.0018 + th * 3);
          x.fillStyle = `rgba(${wave > 0.7 ? "190,235,255" : "92,200,250"},${(0.35 + 0.6 * wave) * alpha})`;
          x.beginPath(); x.ellipse(cx + r * Math.cos(th), cy + r * Math.sin(th), 4.4 * sc, 1.9 * sc, th, 0, 6.2832); x.fill();
        }
      }
      x.globalAlpha = 1;
    };

    const frame = (t: number) => {
      const home = idx.current === 0, target = home ? 0 : 1;
      mix = still ? target : mix + (target - mix) * 0.07; mx += (tx - mx) * 0.04; my += (ty - my) * 0.04;
      const a = -0.4 + (still ? 0 : 0.6 * Math.sin(t * 0.00025)) + mx * 0.8, b = 0.02 + my * 0.5, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
      const turn = (X: number, Y: number, Z: number) => { const X2 = X * ca + Z * sa, Z2 = -X * sa + Z * ca; return { X: X2, Y: Y * cb - Z2 * sb, Z: Y * sb + Z2 * cb }; };
      const R = Math.min(w * 0.25, h * 0.46), cx = w * 0.78, cy = h * 0.5;
      x.clearRect(0, 0, w, h);
      if (mix > 0.01) dome(t, mix);
      if (mix < 0.99) drawBrain(x, brain, t, 1 - mix, turn, cx, cy, R, w, h);
      const L = lab.current, kids = box.current?.children;
      if (kids) for (let i = 0; i < kids.length; i++) {
        const el = kids[i] as HTMLElement, n = Math.max(L.length, 1);
        const y = 0.84 - (1.68 * (i + 0.5)) / n, rr = Math.sqrt(Math.max(1 - y * y, 0)), th = i * 2.399963;
        const v = turn(Math.cos(th) * rr * 1.12, y * 0.74, Math.sin(th) * rr * 0.8), f = (v.Z + 1.4) / 2.8;
        el.style.transform = `translate(${(cx + v.X * R).toFixed(1)}px, ${(cy + v.Y * R).toFixed(1)}px) translate(-50%, -50%) scale(${(0.8 + 0.4 * f).toFixed(2)})`;
        el.style.opacity = v.Z > -0.15 ? String(Math.min(1, 0.45 + f) * (1 - mix)) : "0";
        el.style.zIndex = String(Math.round(f * 10));
      }
      if (!still) raf = requestAnimationFrame(frame);
    };
    draw.current = frame;
    raf = requestAnimationFrame(frame);
    return () => { draw.current = null; cancelAnimationFrame(raf); removeEventListener("resize", resize); removeEventListener("pointermove", mv); };
  }, []);

  // With "reduce motion" there is no animation loop, so repaint once when the page or the job list changes.
  useEffect(() => { if (reduce.current) draw.current?.(0); }, [index, labels.length]);

  return <>
    <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 h-full w-full" />
    <div ref={box} aria-hidden="true" className="pointer-events-none fixed inset-0 -z-[5] overflow-hidden">
      {labels.map(l => <span key={l.text} className="absolute left-0 top-0 whitespace-nowrap rounded-full border border-white/20 bg-[#0b0b16]/70 px-3 py-1 text-xs font-medium text-white shadow-[0_0_24px_rgba(139,92,246,0.5)] backdrop-blur-md">
        <b className={l.score >= 75 ? "text-mint" : l.score >= 50 ? "text-cyan" : "text-signal"}>{l.score}%</b> {l.text}</span>)}
    </div></>;
}
