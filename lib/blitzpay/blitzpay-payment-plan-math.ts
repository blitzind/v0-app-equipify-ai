/**
 * Pure installment / staged payment math (Phase 2O).
 * Rounding: last row absorbs remainder so sums match totalTargetCents.
 */

export type StagedPercentRow = { title: string; bps: number }

export type PlanInstallmentDraft = {
  sequence: number
  title: string
  targetCents: number
  percentBps: number | null
  dueOn: string | null
}

function distributeByBps(totalCents: number, rows: StagedPercentRow[]): PlanInstallmentDraft[] {
  const sumBps = rows.reduce((s, r) => s + r.bps, 0)
  if (sumBps <= 0 || sumBps !== 10_000) {
    return []
  }
  const floors = rows.map((r) => Math.floor((totalCents * r.bps) / 10_000))
  const assigned = floors.reduce((s, c) => s + c, 0)
  const remainder = totalCents - assigned
  return rows.map((r, idx) => {
    const isLast = idx === rows.length - 1
    const target = floors[idx] + (isLast ? remainder : 0)
    return {
      sequence: idx + 1,
      title: r.title,
      targetCents: Math.max(0, target),
      percentBps: r.bps,
      dueOn: null,
    }
  })
}

/** Classic 25% / 50% / 25% progress schedule. */
export function buildTwentyFiveFiftyTwentyFivePlan(totalCents: number): PlanInstallmentDraft[] {
  const t = Math.max(0, Math.round(totalCents))
  if (t < 1) return []
  return distributeByBps(t, [
    { title: "Deposit / upfront", bps: 2500 },
    { title: "Mid-project", bps: 5000 },
    { title: "Completion", bps: 2500 },
  ])
}

/** N equal installments (e.g. monthly). */
export function buildEqualInstallmentPlan(totalCents: number, count: number): PlanInstallmentDraft[] {
  const t = Math.max(0, Math.round(totalCents))
  const n = Math.round(count)
  if (t < 1 || n < 1) return []
  const base = Math.floor(t / n)
  let rem = t - base * n
  const out: PlanInstallmentDraft[] = []
  for (let i = 0; i < n; i++) {
    const extra = rem > 0 ? 1 : 0
    if (rem > 0) rem -= 1
    out.push({
      sequence: i + 1,
      title: n === 1 ? "Full balance" : `Payment ${i + 1} of ${n}`,
      targetCents: base + extra,
      percentBps: null,
      dueOn: null,
    })
  }
  return out
}

export function sumInstallmentTargetsCents(rows: PlanInstallmentDraft[]): number {
  return rows.reduce((s, r) => s + Math.max(0, r.targetCents), 0)
}

export function installmentTargetsMatchTotal(
  rows: PlanInstallmentDraft[],
  totalCents: number,
  toleranceCents = 1,
): boolean {
  const t = Math.max(0, Math.round(totalCents))
  const s = sumInstallmentTargetsCents(rows)
  return Math.abs(s - t) <= toleranceCents
}
