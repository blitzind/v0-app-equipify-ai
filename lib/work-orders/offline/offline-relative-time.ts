/** Short relative label for local draft timestamps (client-only; no new backend fields). */
export function formatOfflineRelativeUpdated(iso: string, nowMs: number = Date.now()): string {
  try {
    const t = new Date(iso).getTime()
    if (Number.isNaN(t)) return ""
    const sec = Math.max(0, Math.round((nowMs - t) / 1000))
    if (sec < 10) return "just now"
    if (sec < 60) return `${sec}s ago`
    const min = Math.floor(sec / 60)
    if (min < 60) return `${min}m ago`
    const hr = Math.floor(min / 60)
    if (hr < 24) return `${hr}h ago`
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  } catch {
    return ""
  }
}
