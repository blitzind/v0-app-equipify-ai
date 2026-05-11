/**
 * Bounded, deterministic renewal / cadence forecasting (Phase 2W). Pure functions — no I/O.
 */

export type RenewalCadenceKind = "monthly" | "quarterly" | "yearly" | "weekly" | "custom" | "unknown"

export function inferRenewalCadenceFromMaintenanceInterval(
  intervalUnit: string | null | undefined,
  intervalValue: number | null | undefined,
): RenewalCadenceKind {
  const u = String(intervalUnit || "").toLowerCase()
  const v = Math.max(1, Math.round(Number(intervalValue) || 1))
  if (u === "month" && v === 1) return "monthly"
  if (u === "month" && v === 3) return "quarterly"
  if (u === "year" && v === 1) return "yearly"
  if (u === "week" && v === 1) return "weekly"
  if (u === "day" || u === "week" || u === "month" || u === "year") return "custom"
  return "unknown"
}

/** Approximate months per maintenance interval for MRR-style weighting (deterministic). */
export function maintenanceIntervalMonthsEquivalent(intervalUnit: string | null | undefined, intervalValue: number | null | undefined): number {
  const u = String(intervalUnit || "").toLowerCase()
  const v = Math.max(1, Math.round(Number(intervalValue) || 1))
  if (u === "day") return Math.max(1 / 30, v / 30)
  if (u === "week") return Math.max(1 / 4, v / 4)
  if (u === "month") return v
  if (u === "year") return v * 12
  return 1
}

export function countMaintenancePlansDueWithinDays(
  plans: Array<{ status: string; nextDueYmd: string | null; isArchived?: boolean }>,
  todayYmd: string,
  horizonDays: number,
): number {
  const t0 = Date.parse(`${todayYmd.slice(0, 10)}T00:00:00.000Z`)
  if (!Number.isFinite(t0)) return 0
  const t1 = t0 + horizonDays * 86400_000
  let n = 0
  for (const p of plans) {
    if (p.isArchived) continue
    if (String(p.status || "").toLowerCase() !== "active") continue
    const d = p.nextDueYmd?.slice(0, 10)
    if (!d) continue
    const ms = Date.parse(`${d}T00:00:00.000Z`)
    if (!Number.isFinite(ms) || ms < t0 || ms > t1) continue
    n += 1
  }
  return n
}

export function countContractsExpiringBetween(
  contracts: Array<{ status: string; endYmd: string | null }>,
  startYmd: string,
  endYmd: string,
): number {
  const a = startYmd.slice(0, 10)
  const b = endYmd.slice(0, 10)
  let n = 0
  for (const c of contracts) {
    if (String(c.status || "").toLowerCase() !== "active") continue
    const e = c.endYmd?.slice(0, 10)
    if (!e) continue
    if (e >= a && e <= b) n += 1
  }
  return n
}

/** Heuristic “still receiving service” risk: active status but past end date (data hygiene). */
export function countExpiredStatusRiskContracts(
  contracts: Array<{ status: string; endYmd: string | null }>,
  todayYmd: string,
): number {
  const t = todayYmd.slice(0, 10)
  let n = 0
  for (const c of contracts) {
    if (String(c.status || "").toLowerCase() !== "active") continue
    const e = c.endYmd?.slice(0, 10)
    if (e && e < t) n += 1
  }
  return n
}

export function projectedRenewalInflowNextDaysCents(args: {
  scheduledPendingCents: number
  installmentDueCents: number
  /** Optional uplift for maintenance-heavy orgs (caller supplies bounded cents). */
  maintenanceCadenceUpliftCents: number
}): number {
  const s = Math.max(0, Math.round(args.scheduledPendingCents))
  const i = Math.max(0, Math.round(args.installmentDueCents))
  const u = Math.max(0, Math.round(args.maintenanceCadenceUpliftCents))
  return s + i + u
}
