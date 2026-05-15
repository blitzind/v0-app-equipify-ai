import "server-only"

/** Stage diagnostics for equipment scan (stdout only; no secrets or file contents). */
export function equipmentScanServerLog(
  stage: string,
  fields: Record<string, string | number | boolean | null | undefined> = {},
): void {
  try {
    const line = `[equipment_scan_server] ${JSON.stringify({ stage, ...fields })}\n`
    process.stdout.write(line)
  } catch {
    /* ignore */
  }
}
