/** A brain made of tiny triangles: two folded hemispheres, temporal lobes, cerebellum and brain stem. Up is -Y (canvas space). */
export type BP = { x: number; y: number; z: number; c: string; o: boolean; a: number; m: boolean; s: number; dim: number };
export type Turn = (X: number, Y: number, Z: number) => { X: number; Y: number; Z: number };

const CER = ["139,92,246", "236,72,153", "56,189,248", "236,235,248", "139,92,246"], CBL = ["245,181,68", "236,235,248", "245,181,68"], STEM = ["56,189,248", "236,235,248"];
const fib = (i: number, n: number): [number, number, number] => { const y = 1 - (2 * (i + 0.5)) / n, r = Math.sqrt(1 - y * y), t = i * 2.399963; return [Math.cos(t) * r, y, Math.sin(t) * r]; };
const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];
const RX = 1, RY = 0.68, RZ = 0.5, C = 0.13;
const inside = (x: number, y: number, z: number, s: number) => (x / RX) ** 2 + (y / RY) ** 2 + ((z - s * C) / RZ) ** 2;

export function makeBrain() {
  const pts: BP[] = [];
  const add = (x: number, y: number, z: number, c: string, dim = 1, m = false) => { pts.push({ x, y: -y, z, c, o: !m && Math.random() < 0.6, a: Math.random() * 6.28, m, s: Math.random() * 6.28, dim }); };
  const n = 3400;
  for (let i = 0; i < n; i++) {
    const [dx, dy, dz] = fib(i, n), s = dz >= 0 ? 1 : -1;
    const ux = RX * dx, uy = RY * dy, uz = s * C + RZ * dz;
    if (inside(ux, uy, uz, -s) < 1.0) continue; // leaves the groove between the hemispheres
    const g = Math.sin(6.5 * ux + 2.2 * Math.sin(4.5 * uy + 1.3 * uz)) * Math.sin(5.8 * uy + 2 * Math.sin(3.7 * uz + ux * 2.1)), a = Math.abs(g);
    const sul = a < 0.2 ? 1 - a / 0.2 : 0, d = 1 - 0.09 * sul;
    add(RX * dx * d, RY * dy * d, s * C + RZ * dz * d, pick(CER), sul > 0 ? 0.35 : 1, Math.random() < 0.02);
  }
  const cerebrum = pts.length;
  for (const s of [1, -1]) for (let i = 0; i < 800; i++) {
    const [dx, dy, dz] = fib(i, 800), x = 0.12 + 0.5 * dx, y = -0.4 + 0.2 * dy, z = s * 0.44 + 0.2 * dz;
    if (inside(x, y, z, s) < 1.02 || inside(x, y, z, -s) < 1.02) continue;
    add(x, y, z, pick(CER));
  }
  for (let i = 0; i < 760; i++) {
    const [dx, dy, dz] = fib(i, 760), f = 1 + 0.05 * Math.sin(dy * 22);
    const x = -0.62 + 0.34 * dx * f, y = -0.55 + 0.22 * dy * f, z = 0.36 * dz * f;
    if (inside(x, y, z, 1) < 1.0 || inside(x, y, z, -1) < 1.0) continue;
    add(x, y, z, pick(CBL));
  }
  for (let i = 0; i < 240; i++) { const u = Math.random(), th = Math.random() * 6.28; add(-0.2 - 0.1 * u + 0.12 * Math.cos(th), -0.58 - 0.38 * u, 0.12 * Math.sin(th), pick(STEM)); }
  const links: [number, number, number][] = []; let tries = 0;
  while (links.length < 44 && tries++ < 5000) {
    const i = Math.floor(Math.random() * cerebrum), j = Math.floor(Math.random() * cerebrum), A = pts[i], B = pts[j], d = Math.hypot(A.x - B.x, A.y - B.y, A.z - B.z);
    if (d > 0.35 && d < 0.8) links.push([i, j, Math.random()]);
  }
  return { pts, links };
}

export function drawBrain(x: CanvasRenderingContext2D, brain: { pts: BP[]; links: [number, number, number][] }, t: number, alpha: number, turn: Turn, cx: number, cy: number, R: number, w: number, h: number) {
  const { pts, links } = brain;
  const fz = (Z: number) => Math.min(1, Math.max(0, (Z + 1.1) / 2.2));
  const q = pts.map(p => { const k = p.m ? 1 + 0.06 * Math.sin(t * 0.002 + p.s) : 1; return { ...turn(p.x * k, p.y * k, p.z * k), p }; }).sort((u, v) => u.Z - v.Z);
  for (const { X, Y, Z, p } of q) {
    const f = fz(Z), r = p.m ? 5 : 1.5 + 3.8 * f, px = cx + X * R, py = cy + Y * R, ang = p.a + t * 0.0003, al = (0.12 + 0.85 * f) * alpha * p.dim;
    if (px < -20 || px > w + 20 || py < -20 || py > h + 20) continue;
    x.beginPath();
    for (let i = 0; i < 3; i++) { const aa = ang + (i * 2 * Math.PI) / 3, qx = px + Math.cos(aa) * r, qy = py + Math.sin(aa) * r; i ? x.lineTo(qx, qy) : x.moveTo(qx, qy); }
    x.closePath();
    if (p.o && !p.m) { x.strokeStyle = `rgba(${p.c},${al})`; x.lineWidth = 1.1; x.stroke(); }
    else { x.fillStyle = `rgba(${p.m ? "56,189,248" : p.c},${p.m ? 0.95 * alpha : al})`; x.shadowColor = p.m ? "rgba(56,189,248,0.9)" : "transparent"; x.shadowBlur = p.m ? 14 : 0; x.fill(); x.shadowBlur = 0; }
  }
  // neurons firing: faint links with a light pulse travelling along each
  for (const [i, j, ph] of links) {
    const A = turn(pts[i].x, pts[i].y, pts[i].z), B = turn(pts[j].x, pts[j].y, pts[j].z);
    if (A.Z < -0.1 && B.Z < -0.1) continue;
    const f = (fz(A.Z) + fz(B.Z)) / 2, ax = cx + A.X * R, ay = cy + A.Y * R, bx = cx + B.X * R, by = cy + B.Y * R, u = (t * 0.0003 + ph) % 1;
    x.strokeStyle = `rgba(160,210,255,${0.1 * f * alpha})`; x.lineWidth = 1; x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, by); x.stroke();
    x.fillStyle = `rgba(255,255,255,${0.9 * f * alpha})`; x.shadowColor = "rgba(120,200,255,0.9)"; x.shadowBlur = 10;
    x.beginPath(); x.arc(ax + (bx - ax) * u, ay + (by - ay) * u, 2.2, 0, 6.2832); x.fill(); x.shadowBlur = 0;
  }
}
