import type { TaxLineClassification, TaxableLineForEngine } from "@/lib/tax/types"

const LABOR_HINTS = /\b(labor|labour|service hours|tech time|hourly|installation labor)\b/i
const PARTS_HINTS = /\b(part|material|supply|sku|hardware|consumable)\b/i

export function classifyLineForSalesTax(line: TaxableLineForEngine): TaxLineClassification {
  const cat = (line.tax_category ?? "").toLowerCase()
  if (cat.includes("labor") || cat.includes("service")) return "labor"
  if (cat.includes("part") || cat.includes("material") || cat.includes("equipment")) return "parts"
  const ref = (line.source_ref ?? "").toLowerCase()
  if (ref.includes("labor")) return "labor"
  if (ref.includes("material") || ref.includes("part")) return "parts"
  if (line.source_ref && LABOR_HINTS.test(line.source_ref)) return "labor"
  if (line.source_ref && PARTS_HINTS.test(line.source_ref)) return "parts"
  return "other"
}

export function lineCountsTowardTaxableBase(
  line: TaxableLineForEngine,
  classification: TaxLineClassification,
  opts: { taxableLabor: boolean; taxableParts: boolean },
): boolean {
  if (line.taxable === false) return false
  if (classification === "labor") return opts.taxableLabor
  if (classification === "parts") return opts.taxableParts
  // services / uncategorized — follow materials toggle (common field-service default)
  return opts.taxableParts
}
