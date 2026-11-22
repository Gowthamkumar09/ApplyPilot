export async function api<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch("/api" + path, opts);
  if (res.status === 401 && !path.startsWith("/auth")) window.dispatchEvent(new Event("ap-unauth"));
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try { const j = await res.json(); msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail); } catch {}
    throw new Error(msg);
  }
  return res.json();
}
export const json = (method: string, body: unknown): RequestInit => ({
  method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
export const STATUSES = ["discovered","shortlisted","application_prepared","awaiting_approval","submission_in_progress",
  "submitted_confirmed","submission_failed","interview","assessment","offer","rejected","withdrawn"];
export const label = (s: string) => s.replace(/_/g, " ").replace(/^./, c => c.toUpperCase());
export function ago(iso?: string | null): string {
  if (!iso) return "";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d <= 0 ? "today" : d === 1 ? "1 day ago" : `${d} days ago`;
}
