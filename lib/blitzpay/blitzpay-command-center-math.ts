import type { BlitzpayForecastHorizonsCents } from "@/lib/blitzpay/blitzpay-revenue-forecast-math"

export type CombinedArApCashForecast = {
  expectedInflow7Cents: number
  expectedInflow30Cents: number
  expectedInflow60Cents: number
  apOutflow7Cents: number
  apOutflow30Cents: number
  apOutflow60Cents: number
  /** Conservative cash leaving (Stripe in-flight + upcoming transfer heuristic). */
  payoutPressureCents: number
  netCashPosition7Cents: number
  netCashPosition30Cents: number
  netCashPosition60Cents: number
  riskNotes: string[]
}

/**
 * AR/AP combined view: expected BlitzPay-side inflows from schedules/installments/recovery/deposit pipeline
 * minus open vendor payables due in each horizon and a single payout-pressure term (not double-counted per horizon).
 */
export function buildCombinedArApCashForecast(input: {
  forecastHorizons: BlitzpayForecastHorizonsCents
  apDue7OpenCents: number
  apDue30OpenCents: number
  apDue60OpenCents: number
  /** `max(pending payout totals, estimate upcoming transfer)` style aggregate (caller supplies cents). */
  payoutPressureCents: number
}): CombinedArApCashForecast {
  const f = input.forecastHorizons
  const ap7 = Math.max(0, Math.round(input.apDue7OpenCents))
  const ap30 = Math.max(0, Math.round(input.apDue30OpenCents))
  const ap60 = Math.max(0, Math.round(input.apDue60OpenCents))
  const payout = Math.max(0, Math.round(input.payoutPressureCents))

  const in7 = Math.max(0, Math.round(f.next7DaysExpectedCents))
  const in30 = Math.max(0, Math.round(f.next30DaysExpectedCents))
  const in60 = Math.max(0, Math.round(f.next60DaysExpectedCents))

  const net7 = in7 - ap7 - payout
  const net30 = in30 - ap30 - payout
  const net60 = in60 - ap60 - payout

  const riskNotes: string[] = []
  if (net7 < 0) riskNotes.push("Next 7 days: expected inflows may not cover near-term payables plus payout pressure.")
  if (net30 < 0 && net7 >= 0) riskNotes.push("Next 30 days: cumulative payables and payout pressure exceed the AR forecast band.")
  if (ap7 > in7 && in7 > 0) riskNotes.push("Vendor obligations due within 7 days exceed the 7-day collections forecast.")
  if (payout > in30 && in30 > 0) riskNotes.push("Payout / transfer pressure is large relative to the 30-day collections forecast.")
  if (ap60 > in60 && in60 > 0) riskNotes.push("60-day vendor obligations exceed the 60-day AR forecast — review scheduling and terms.")

  return {
    expectedInflow7Cents: in7,
    expectedInflow30Cents: in30,
    expectedInflow60Cents: in60,
    apOutflow7Cents: ap7,
    apOutflow30Cents: ap30,
    apOutflow60Cents: ap60,
    payoutPressureCents: payout,
    netCashPosition7Cents: net7,
    netCashPosition30Cents: net30,
    netCashPosition60Cents: net60,
    riskNotes,
  }
}
