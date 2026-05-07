/**
 * Leads + Follow-Up Phase 1 — pure formatting helpers.
 *
 * No React, no Supabase, no DOM access — usable from server components,
 * client components, and tests. Keep all UI strings here so they stay in
 * sync between filters, drawers, and notifications.
 */

import type {
  FollowUpBucket,
  ProspectStatus,
} from "@/lib/prospects/types"

const STATUS_LABELS: Record<ProspectStatus, string> = {
  new: "New",
  contacted: "Contacted",
  follow_up: "Follow-up",
  quoted: "Quoted",
  won: "Won",
  lost: "Lost",
}

export function formatProspectStatus(status: ProspectStatus | string): string {
  if (status in STATUS_LABELS) return STATUS_LABELS[status as ProspectStatus]
  return status.replace(/_/g, " ")
}

/** Tailwind chip classes per status. Designed to read in dark mode too. */
export function prospectStatusBadgeClasses(status: ProspectStatus | string): string {
  switch (status) {
    case "new":
      return "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300"
    case "contacted":
      return "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300"
    case "follow_up":
      return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
    case "quoted":
      return "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300"
    case "won":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    case "lost":
      return "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300"
    default:
      return "border-border bg-muted/40 text-muted-foreground"
  }
}

/**
 * Bucket a follow-up timestamp into a stable enum used by the list filter,
 * KPI tiles, and the dashboard widget. `null` follow-ups land in `"none"`.
 * Cutoffs are computed in the browser's local timezone so "today" /
 * "this week" reflect the user's working week, not UTC.
 *
 * Buckets:
 *   - `overdue`   — past due (anything before start of today)
 *   - `today`     — between start-of-today and end-of-today
 *   - `this_week` — tomorrow through end of the current ISO week (Sunday)
 *   - `upcoming`  — anything later than this week
 *   - `none`      — no follow-up scheduled
 */
export function followUpBucketFor(
  iso: string | null | undefined,
  now: Date = new Date(),
): FollowUpBucket {
  if (!iso) return "none"
  const ts = Date.parse(iso)
  if (!Number.isFinite(ts)) return "none"

  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const endOfToday = new Date(startOfToday)
  endOfToday.setDate(endOfToday.getDate() + 1)
  // End of "this week" = the start of the day *after* the upcoming Sunday.
  // getDay() returns 0..6 with 0 = Sunday; daysUntilSunday rolls Sunday
  // forward to "next Sunday" so today's Sunday still has at least one day
  // of "this week" headroom.
  const daysUntilSunday = (7 - startOfToday.getDay()) % 7 || 7
  const endOfThisWeek = new Date(startOfToday)
  endOfThisWeek.setDate(endOfThisWeek.getDate() + daysUntilSunday + 1)

  if (ts < startOfToday.getTime()) return "overdue"
  if (ts < endOfToday.getTime()) return "today"
  if (ts < endOfThisWeek.getTime()) return "this_week"
  return "upcoming"
}

export function formatFollowUpBucket(bucket: FollowUpBucket): string {
  switch (bucket) {
    case "overdue":
      return "Overdue"
    case "today":
      return "Due today"
    case "this_week":
      return "This week"
    case "upcoming":
      return "Upcoming"
    case "none":
      return "No follow-up"
    case "all":
    default:
      return "All"
  }
}

/** "$1,234" or "—" when no value. Cents in, dollars out. */
export function formatEstimatedValue(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(Number(cents))) return "—"
  const dollars = Number(cents) / 100
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(dollars)
}

/** Compact `Apr 30, 3:42 PM` formatting for follow-up dates. */
export function formatFollowUpStamp(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  const sameYear = d.getFullYear() === new Date().getFullYear()
  const yearChunk = sameYear ? "" : `, ${d.getFullYear()}`
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  return `${date}${yearChunk} · ${time}`
}

export function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}
