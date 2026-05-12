/**
 * Contractor cash-advance modeling (Phase 3D) — planning math only; not an offer of credit.
 */

export function estimateAdvancePaybackCents(advanceCents: number, impliedFeeBps: number): number {
  const a = Math.max(0, Math.round(advanceCents))
  const bps = Math.max(0, Math.min(50_000, Math.round(impliedFeeBps)))
  const fee = Math.round((a * bps) / 10_000)
  return Math.min(Number.MAX_SAFE_INTEGER, a + fee)
}

export function advanceExposureFromModelsCents(
  models: ReadonlyArray<{ model_status: string; estimated_advance_amount_cents: number }>,
  cap: number,
): number {
  let sum = 0
  let n = 0
  for (const m of models) {
    if (n >= cap) break
    if (m.model_status !== "active") continue
    sum += Math.max(0, Math.round(Number(m.estimated_advance_amount_cents)))
    n += 1
  }
  return sum
}
