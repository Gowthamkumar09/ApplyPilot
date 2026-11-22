import { useEffect, useRef } from "react";
import * as THREE from "three";

// [lat, lon]: Hyderabad, Bengaluru, Delhi, London, Singapore, San Francisco, Dubai, Sydney
const CITIES: [number, number][] = [[17.4, 78.5], [12.97, 77.6], [28.6, 77.2], [51.5, -0.12], [1.35, 103.8], [37.8, -122.4], [25.2, 55.3], [-33.9, 151.2]];
const ROUTES: [number, number][] = [[0, 3], [0, 5], [0, 4], [1, 6], [2, 7], [3, 5]];
const R = 1.4;
const ll = (lat: number, lon: number, r: number) => {
  const phi = ((90 - lat) * Math.PI) / 180, th = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
};

/** Wireframe globe with animated flight arcs. Falls back to nothing if WebGL is unavailable. */
export default function Globe({ zoom = 4.2, interactive = true }: { zoom?: number; interactive?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch { return; }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100); camera.position.set(0, 0, zoom);
    const group = new THREE.Group(); group.rotation.x = 0.35; group.rotation.z = 0.12; scene.add(group);

    group.add(new THREE.Mesh(new THREE.SphereGeometry(R * 0.985, 48, 32), new THREE.MeshBasicMaterial({ color: 0x0b1b2b })));
    group.add(new THREE.Mesh(new THREE.IcosahedronGeometry(R, 3), new THREE.MeshBasicMaterial({ color: 0x3d7fe0, wireframe: true, transparent: true, opacity: 0.38 })));
    group.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(CITIES.map(([a, b]) => ll(a, b, R * 1.005))), new THREE.PointsMaterial({ color: 0xffc247, size: 0.075 })));

    const planes: { m: THREE.Mesh; c: THREE.QuadraticBezierCurve3; t: number; s: number }[] = [];
    ROUTES.forEach(([i, j], k) => {
      const a = ll(...CITIES[i], R), b = ll(...CITIES[j], R);
      const mid = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(R * (1.3 + a.distanceTo(b) * 0.12));
      const c = new THREE.QuadraticBezierCurve3(a, mid, b);
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(c.getPoints(64)), new THREE.LineBasicMaterial({ color: 0xe8a317, transparent: true, opacity: 0.75 })));
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      group.add(m); planes.push({ m, c, t: k / ROUTES.length, s: 0.0022 + k * 0.0004 });
    });

    const stars: THREE.Vector3[] = [];
    for (let n = 0; n < 380; n++) stars.push(new THREE.Vector3().randomDirection().multiplyScalar(6 + Math.random() * 6));
    scene.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(stars), new THREE.PointsMaterial({ color: 0x9fb8d6, size: 0.03 })));

    const resize = () => {
      const p = canvas.parentElement!, w = p.clientWidth, h = p.clientHeight;
      renderer.setSize(w, h, false); camera.aspect = w / Math.max(h, 1); camera.updateProjectionMatrix();
      if (reduce) renderer.render(scene, camera);
    };
    const ro = new ResizeObserver(resize); ro.observe(canvas.parentElement!); resize();

    let tx = 0, ty = 0, raf = 0;
    const onMove = (e: PointerEvent) => { tx = (e.clientY / window.innerHeight - 0.5) * 0.5; ty = (e.clientX / window.innerWidth - 0.5) * 0.9; };
    if (interactive) window.addEventListener("pointermove", onMove);
    const loop = () => {
      group.rotation.y += 0.0016;
      group.rotation.x += (0.35 + tx - group.rotation.x) * 0.03;
      camera.position.x += (ty - camera.position.x) * 0.03; camera.lookAt(0, 0, 0);
      planes.forEach(p => { p.t = (p.t + p.s) % 1; p.m.position.copy(p.c.getPoint(p.t)); });
      renderer.render(scene, camera); raf = requestAnimationFrame(loop);
    };
    if (!reduce) loop();

    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener("pointermove", onMove);
      scene.traverse((o: any) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
      renderer.dispose();
    };
  }, [zoom, interactive]);
  return <canvas ref={ref} className="block h-full w-full" aria-hidden="true" />;
}
