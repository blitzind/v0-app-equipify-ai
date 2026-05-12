import type { BlitzpayDeferredRecognitionFrequency } from "@/lib/blitzpay/blitzpay-general-ledger"

export type DeferredScheduleRow = {
  id: string
  remaining_amount_cents: number
  recognized_amount_cents: number
  original_amount_cents: number
  recognition_frequency: BlitzpayDeferredRecognitionFrequency
  next_recognition_date: string | null
  start_date: string
  end_date: string | null
  status: string
}

/** Bounded, deterministic slice to recognize on a run (does not mutate DB). */
export function computeNextRecognitionAmountCents(row: DeferredScheduleRow, asOfDateIso: string): number {
  if (row.status !== "active") return 0
  const remaining = Math.max(0, Math.round(Number(row.remaining_amount_cents)))
  if (remaining <= 0) return 0
  const asOf = asOfDateIso.slice(0, 10)
  if (row.next_recognition_date && asOf < row.next_recognition_date) return 0

  if (row.recognition_frequency === "milestone") {
    return remaining
  }

  if (row.recognition_frequency === "daily") {
    return Math.min(remaining, Math.max(0, Math.floor(remaining / 30)))
  }

  if (row.recognition_frequency === "weekly") {
    return Math.min(remaining, Math.max(1, Math.floor(remaining / 8)))
  }

  // monthly — equal-ish slices from start to end
  if (!row.end_date) {
    return Math.min(remaining, Math.max(1, Math.floor(remaining / 12)))
  }
  const start = new Date(`${row.start_date}T12:00:00.000Z`).getTime()
  const end = new Date(`${row.end_date}T12:00:00.000Z`).getTime()
  const months = Math.max(1, Math.round((end - start) / (30.44 * 86400000)))
  return Math.min(remaining, Math.max(1, Math.floor(remaining / months)))
}

export function applyRecognitionToScheduleState(
  row: DeferredScheduleRow,
  recognizeCents: number,
  asOfDateIso: string,
): { recognized_amount_cents: number; remaining_amount_cents: number; next_recognition_date: string | null; status: string } {
  const rec = Math.max(0, Math.round(recognizeCents))
  const rem0 = Math.max(0, Math.round(Number(row.remaining_amount_cents)))
  const applied = Math.min(rec, rem0)
  const newRem = rem0 - applied
  const newRecog = Math.round(Number(row.recognized_amount_cents)) + applied
  let next: string | null = row.next_recognition_date
  if (newRem <= 0) {
    return { recognized_amount_cents: newRecog, remaining_amount_cents: 0, next_recognition_date: null, status: "completed" }
  }
  const d = new Date(`${asOfDateIso.slice(0, 10)}T12:00:00.000Z`)
  if (row.recognition_frequency === "monthly") d.setUTCMonth(d.getUTCMonth() + 1)
  else if (row.recognition_frequency === "weekly") d.setUTCDate(d.getUTCDate() + 7)
  else if (row.recognition_frequency === "daily") d.setUTCDate(d.getUTCDate() + 1)
  else next = row.next_recognition_date
  if (row.recognition_frequency !== "milestone") {
    next = d.toISOString().slice(0, 10)
  }
  return { recognized_amount_cents: newRecog, remaining_amount_cents: newRem, next_recognition_date: next, status: "active" }
}
