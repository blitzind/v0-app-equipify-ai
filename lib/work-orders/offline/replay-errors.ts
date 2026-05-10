/** User-facing wording for common replay / RLS failures (no extra telemetry). */
export function formatWorkOrderOfflineReplayError(raw: string): string {
  const m = raw.toLowerCase()
  if (
    m.includes("jwt") ||
    m.includes("permission denied") ||
    m.includes("row-level security") ||
    m.includes("rls") ||
    m.includes("not authorized") ||
    m.includes("unauthorized")
  ) {
    return "Your session or assignment may have changed, so this job could not be updated. This draft stays on this device — sign in again or confirm you are still assigned, then tap Sync now. If the job was reassigned, discard this draft after copying anything you need."
  }
  if (m.includes("work order not found") || m.includes("access denied")) {
    return "This work order was not found or you no longer have access. The local draft remains on this device until you discard it — ask a dispatcher if the job moved orgs or your assignment changed."
  }
  return raw
}
