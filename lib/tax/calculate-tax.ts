import { calculateTaxSubtotals } from "@/lib/billing/tax-framework"
import { classifyLineForSalesTax, lineCountsTowardTaxableBase } from "@/lib/tax/line-classification"
import type {
  MatchedTaxComponent,
  SalesTaxCalculationResult,
  TaxAddressInput,
  TaxBasis,
  TaxableLineForEngine,
} from "@/lib/tax/types"

function roundMoney2(n: number): number {
  return Math.round(n * 100) / 100
}

function splitTaxableBaseByApplies(
  lines: TaxableLineForEngine[],
  opts: { taxableLabor: boolean; taxableParts: boolean },
): { all: number; labor: number; parts: number; services: number } {
  let labor = 0
  let parts = 0
  let services = 0
  for (const line of lines) {
    const cls = classifyLineForSalesTax(line)
    if (!lineCountsTowardTaxableBase(line, cls, opts)) continue
    const amt = Math.max(0, (Number(line.qty) || 0) * (Number(line.unit) || 0))
    if (cls === "labor") labor += amt
    else if (cls === "parts") parts += amt
    else services += amt
  }
  const all = labor + parts + services
  return { all, labor, parts, services }
}

function taxableSliceForApplies(
  applies: string,
  split: { all: number; labor: number; parts: number; services: number },
): number {
  switch (applies) {
    case "labor":
      return split.labor
    case "parts":
      return split.parts
    case "services":
      return split.labor + split.services
    case "all":
    default:
      return split.all
  }
}

/**
 * Deterministic stacked-rate engine (major currency units).
 */
export function calculateStackedSalesTax(args: {
  lines: TaxableLineForEngine[]
  components: MatchedTaxComponent[]
  taxableLabor: boolean
  taxableParts: boolean
  fallbackRatePercent: number
}): Pick<SalesTaxCalculationResult, "taxableSubtotal" | "nonTaxableSubtotal" | "taxAmount" | "combinedRatePercent"> {
  const subs = calculateTaxSubtotals(
    args.lines.map((l) => ({ qty: l.qty, unit: l.unit, taxable: l.taxable })),
  )
  const split = splitTaxableBaseByApplies(args.lines, {
    taxableLabor: args.taxableLabor,
    taxableParts: args.taxableParts,
  })
  const totalAllLines = roundMoney2(subs.taxableSubtotal + subs.nonTaxableSubtotal)
  const nonTaxable = roundMoney2(Math.max(0, totalAllLines - split.all))

  let tax = 0
  let effectiveCombined = 0
  if (args.components.length === 0) {
    const fb = Math.max(0, Number(args.fallbackRatePercent) || 0)
    effectiveCombined = fb
    tax = roundMoney2(split.all * (fb / 100))
  } else {
    for (const c of args.components) {
      const slice = taxableSliceForApplies(c.appliesTo, split)
      tax += roundMoney2(slice * (c.ratePercent / 100))
    }
    const baseForCombined = split.all > 0 ? split.all : 0
    effectiveCombined =
      baseForCombined > 0 ? roundMoney2((tax / baseForCombined) * 100) : roundMoney2(args.components.reduce((s, c) => s + c.ratePercent, 0))
  }

  return {
    taxableSubtotal: roundMoney2(split.all),
    nonTaxableSubtotal: nonTaxable,
    taxAmount: roundMoney2(tax),
    combinedRatePercent: effectiveCombined,
  }
}

export function buildSalesTaxSnapshot(args: {
  address: TaxAddressInput
  basis: TaxBasis
  components: MatchedTaxComponent[]
  result: Pick<SalesTaxCalculationResult, "taxableSubtotal" | "nonTaxableSubtotal" | "taxAmount" | "combinedRatePercent" | "status">
  customerExempt: boolean
  overrideUsed: boolean
}): Record<string, unknown> {
  return {
    engine: "equipify_native_v1",
    generatedAt: new Date().toISOString(),
    taxBasis: args.basis,
    address: {
      countryCode: args.address.countryCode,
      regionCode: args.address.regionCode,
      countyName: args.address.countyName ?? null,
      cityName: args.address.cityName ?? null,
      postalCode: args.address.postalCode ?? null,
    },
    customerExempt: args.customerExempt,
    customerOverride: args.overrideUsed,
    components: args.components.map((c) => ({
      code: c.jurisdictionCode,
      type: c.jurisdictionType,
      name: c.displayName,
      ratePercent: c.ratePercent,
      appliesTo: c.appliesTo,
      source: c.source,
    })),
    totals: {
      taxableSubtotal: args.result.taxableSubtotal,
      nonTaxableSubtotal: args.result.nonTaxableSubtotal,
      taxAmount: args.result.taxAmount,
      combinedRatePercent: args.result.combinedRatePercent,
    },
    status: args.result.status,
  }
}

export function summarizeJurisdictions(components: MatchedTaxComponent[]): string {
  if (!components.length) return "No matching jurisdiction rows — fallback rate may apply."
  return components.map((c) => `${c.displayName} (${c.ratePercent}%)`).join(" + ")
}
