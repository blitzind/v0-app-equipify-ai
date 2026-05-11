/**
 * Pure trigger label for `blitzpay_reminder_runs.trigger` (no server-only deps).
 */

export function blitzpayReminderDispatchTrigger(opts?: {
  dryRun?: boolean
  manual?: boolean
}): "cron" | "manual" | "dry_run" {
  const dryRun = Boolean(opts?.dryRun)
  return dryRun ? "dry_run" : opts?.manual ? "manual" : "cron"
}
