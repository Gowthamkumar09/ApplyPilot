import { ReactNode, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { tone, use3D } from "./ui";

type Ctx = { scene: THREE.Scene; camera: THREE.PerspectiveCamera; group: THREE.Group; canvas: HTMLCanvasElement; tick: (f: (t: number) => void) => void };

/** Shared 3D stage: lights, drag-to-orbit, auto-rotate, resize, cleanup, reduced-motion and on/off switch. */
function Stage({ build, deps, hint, label, children }: { build: (c: Ctx) => void | (() => void); deps: unknown[]; hint: string; label: string; children?: ReactNode }) {
  const ref = useRef<HTMLCanvasElement>(null); const [on] = use3D();
  useEffect(() => {
    const canvas = ref.current; if (!on || !canvas) return;
    let renderer: THREE.WebGLRenderer; try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch { return; }
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100), group = new THREE.Group();
    camera.position.set(0, 3.5, 10); camera.lookAt(0, 0, 0);
    const sun = new THREE.DirectionalLight(0xffffff, 1.2); sun.position.set(4, 8, 6);
    scene.add(group, new THREE.AmbientLight(0xffffff, 0.75), sun);
    const ticks: ((t: number) => void)[] = [];
    const off = build({ scene, camera, group, canvas, tick: f => ticks.push(f) });
    const box = canvas.parentElement!;
    const draw = () => renderer.render(scene, camera);
    const ro = new ResizeObserver(() => { renderer.setSize(box.clientWidth, box.clientHeight, false); camera.aspect = box.clientWidth / Math.max(box.clientHeight, 1); camera.updateProjectionMatrix(); if (reduce) draw(); });
    ro.observe(box);
    let drag = false, raf = 0; const t0 = performance.now();
    const down = () => { drag = true; }, up = () => { drag = false; };
    const move = (e: PointerEvent) => { if (drag) { group.rotation.y += e.movementX * 0.01; group.rotation.x = Math.max(-0.5, Math.min(0.5, group.rotation.x + e.movementY * 0.005)); } };
    canvas.addEventListener("pointerdown", down); addEventListener("pointerup", up); canvas.addEventListener("pointermove", move);
    const loop = () => { const t = (performance.now() - t0) / 1000; if (!drag) group.rotation.y += 0.0025; ticks.forEach(f => f(t)); draw(); raf = requestAnimationFrame(loop); };
    if (reduce) { ticks.forEach(f => f(99)); draw(); } else loop();
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); off?.();
      canvas.removeEventListener("pointerdown", down); removeEventListener("pointerup", up); canvas.removeEventListener("pointermove", move);
      scene.traverse((o: any) => { o.geometry?.dispose?.(); (Array.isArray(o.material) ? o.material : [o.material]).forEach((m: any) => { m?.map?.dispose?.(); m?.dispose?.(); }); });
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, ...deps]);
  if (!on) return <p className="rounded-xl bg-sky p-4 text-sm text-ink/70">3D views are switched off. Use the “3D effects” switch to turn them on.</p>;
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-b from-[#14142a] to-[#0b0b16]">
      <canvas ref={ref} role="img" aria-label={label} className="block h-72 w-full cursor-grab touch-pan-y" />
      {children}<p className="pointer-events-none absolute bottom-2 left-3 text-xs text-white/50">{hint}</p>
    </div>);
}

function textSprite(v: string, l: string) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 112; const x = c.getContext("2d")!;
  x.textAlign = "center"; x.fillStyle = "#fff"; x.font = "700 54px system-ui, sans-serif"; x.fillText(v, 128, 54);
  x.fillStyle = "#9fb8d6"; x.font = "26px system-ui, sans-serif"; x.fillText(l, 128, 96);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false })); s.scale.set(2.2, 0.96, 1); return s;
}

/** Your real pipeline numbers as growing 3D columns. */
export function Pipeline3D({ stats }: { stats: [string, number][] }) {
  const short = ["Discovered", "Matching", "Prepared", "Awaiting", "Confirmed", "Interviews"], col = [0x1e6fd9, 0x2e9e7a, 0x3d7fe0, 0xc98a0b, 0x2e9e7a, 0xffc247];
  const max = Math.max(1, ...stats.map(s => s[1]));
  return <Stage deps={[stats]} label={"Application pipeline: " + stats.map(([k, v]) => `${k} ${v}`).join(", ")} hint="Drag to rotate" build={({ group, tick }) => {
    const floor = new THREE.GridHelper(10, 10, 0x3d7fe0, 0x1b3452); floor.position.y = -2; group.add(floor);
    stats.forEach(([, v], i) => {
      const h = Math.max(0.12, (v / max) * 3.6), x = (i - (stats.length - 1) / 2) * 1.5;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1, 0.95), new THREE.MeshStandardMaterial({ color: col[i % 6], metalness: 0.2, roughness: 0.4 }));
      const s = textSprite(String(v), short[i] ?? ""); group.add(bar, s);
      tick(t => { const p = Math.min(1, Math.max(0, t - i * 0.12)), hh = Math.max(0.001, h * (1 - Math.pow(1 - p, 3)));
        bar.scale.y = hh; bar.position.set(x, -2 + hh / 2, 0); s.position.set(x, -2 + hh + 0.7, 0); });
    });
  }} />;
}

/** Every job as a planet: closer to the core = better match. Hover for details, click to filter the list. */
export function MatchMap({ jobs, onPick }: { jobs: any[]; onPick: (title: string) => void }) {
  const [tip, setTip] = useState("");
  return <Stage deps={[jobs]} label={`Match map of ${jobs.length} jobs`} hint="Drag to rotate · closer to the core = better match · click a planet to filter" build={({ group, camera, canvas, tick }) => {
    const ray = new THREE.Raycaster(), m = new THREE.Vector2(), meshes: THREE.Mesh[] = []; let hov: THREE.Mesh | null = null, sx = 0;
    group.add(new THREE.Mesh(new THREE.SphereGeometry(0.35, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffc247 })));
    [1.5, 3, 4.5].forEach(r => { const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.01, r + 0.01, 96), new THREE.MeshBasicMaterial({ color: 0x3d7fe0, transparent: true, opacity: 0.35, side: THREE.DoubleSide })); ring.rotation.x = Math.PI / 2; group.add(ring); });
    jobs.slice(0, 60).forEach((j, i) => {
      const s = j.match.score, a = i * 2.39996, r = 0.8 + ((100 - s) / 100) * 4.2, c = new THREE.Color(tone(s));
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.1 + (s / 100) * 0.16, 20, 14), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.35 }));
      mesh.position.set(Math.cos(a) * r, ((s - 50) / 50) * 1.2, Math.sin(a) * r); mesh.userData = { j }; group.add(mesh); meshes.push(mesh);
    });
    const move = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); m.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(m, camera);
      hov = (ray.intersectObjects(meshes)[0]?.object as THREE.Mesh) ?? null; canvas.style.cursor = hov ? "pointer" : "grab";
      setTip(hov ? `${hov.userData.j.title} · ${hov.userData.j.company} · ${hov.userData.j.match.score}%` : ""); };
    const down = (e: PointerEvent) => { sx = e.clientX; }, up = (e: PointerEvent) => { if (hov && Math.abs(e.clientX - sx) < 4) onPick(hov.userData.j.title); };
    canvas.addEventListener("pointermove", move); canvas.addEventListener("pointerdown", down); canvas.addEventListener("pointerup", up);
    tick(() => meshes.forEach(x => x.scale.lerp(new THREE.Vector3().setScalar(x === hov ? 1.8 : 1), 0.2)));
    return () => { canvas.removeEventListener("pointermove", move); canvas.removeEventListener("pointerdown", down); canvas.removeEventListener("pointerup", up); setTip(""); };
  }}>{tip && <div className="pointer-events-none absolute left-3 top-3 max-w-[90%] rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white backdrop-blur">{tip}</div>}</Stage>;
}
