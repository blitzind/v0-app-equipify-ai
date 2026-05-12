/**
 * Pure helpers for AP/AR/treasury reconciliation signals against GL balances (foundations only).
 * Stripe settlement remains authoritative for cash timing; these are internal control checks.
 */

export type ArApBalanceCheck = {
  arGlCents: number
  apGlCents: number
  internalOpenArProxyCents: number
  internalOpenApProxyCents: number
  arDeltaCents: number
  apDeltaCents: number
  arBalanced: boolean
  apBalanced: boolean
}

export function compareArApToOperationalProxies(input: {
  arGlCents: number
  apGlCents: number
  /** e.g. overdue AR heuristic from ops snapshot (already bounded upstream). */
  openArProxyCents: number
  openApProxyCents: number
  toleranceCents: number
}): ArApBalanceCheck {
  const arGl = Math.round(input.arGlCents)
  const apGl = Math.round(input.apGlCents)
  const arP = Math.round(input.openArProxyCents)
  const apP = Math.round(input.openApProxyCents)
  const tol = Math.max(0, Math.round(input.toleranceCents))
  const arDelta = arGl - arP
  const apDelta = apGl - apP
  return {
    arGlCents: arGl,
    apGlCents: apGl,
    internalOpenArProxyCents: arP,
    internalOpenApProxyCents: apP,
    arDeltaCents: arDelta,
    apDeltaCents: apDelta,
    arBalanced: Math.abs(arDelta) <= tol,
    apBalanced: Math.abs(apDelta) <= tol,
  }
}

export type TreasuryGlCheck = {
  cashGlCents: number
  treasuryOperatingProxyCents: number
  deltaCents: number
  aligned: boolean
}

export function compareCashGlToTreasuryProxy(input: {
  cashGlCents: number
  treasuryOperatingProxyCents: number
  toleranceCents: number
}): TreasuryGlCheck {
  const cash = Math.round(input.cashGlCents)
  const tro = Math.round(input.treasuryOperatingProxyCents)
  const tol = Math.max(0, Math.round(input.toleranceCents))
  const delta = cash - tro
  return {
    cashGlCents: cash,
    treasuryOperatingProxyCents: tro,
    deltaCents: delta,
    aligned: Math.abs(delta) <= tol,
  }
}
