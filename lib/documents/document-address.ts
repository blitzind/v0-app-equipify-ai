import type { BillingAddress, ServiceAddress } from "@/lib/customers/hierarchy"
import type { BillingAddressParts } from "@/lib/billing/invoice-financial-display"

export type AddressBlockParts = {
  name?: string | null
  line1?: string | null
  line2?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  country?: string | null
}

/** Multi-line address block for PDFs and print views (null-safe). */
export function formatAddressBlockLines(parts: AddressBlockParts): string {
  const lines: string[] = []
  if (parts.name?.trim()) lines.push(parts.name.trim())
  if (parts.line1?.trim()) lines.push(parts.line1.trim())
  if (parts.line2?.trim()) lines.push(parts.line2.trim())
  const cityState = [parts.city?.trim(), parts.state?.trim()].filter(Boolean).join(", ")
  const cityStateZip = [cityState, parts.postalCode?.trim()].filter(Boolean).join(" ").trim()
  if (cityStateZip) lines.push(cityStateZip)
  if (parts.country?.trim()) lines.push(parts.country.trim())
  return lines.join("\n")
}

export function formatBillingAddressPartsBlock(parts: BillingAddressParts, name?: string | null): string {
  return formatAddressBlockLines({
    name,
    line1: parts.billing_address_line1,
    line2: parts.billing_address_line2,
    city: parts.billing_city,
    state: parts.billing_state,
    postalCode: parts.billing_postal_code,
    country: parts.billing_country,
  })
}

export function formatServiceAddressBlock(
  service: ServiceAddress | null,
  displayName?: string | null,
): string | null {
  if (!service) return null
  const block = formatAddressBlockLines({
    name: displayName?.trim() || service.name,
    line1: service.line1,
    line2: service.line2,
    city: service.city,
    state: service.state,
    postalCode: service.postalCode,
  })
  return block.trim() || null
}

export function formatBillingAddressBlock(
  billing: BillingAddress | null,
  displayName?: string | null,
): string | null {
  if (!billing) return null
  const block = formatAddressBlockLines({
    name: displayName?.trim() || billing.billingName,
    line1: billing.line1,
    line2: billing.line2,
    city: billing.city,
    state: billing.state,
    postalCode: billing.postalCode,
    country: billing.country,
  })
  return block.trim() || null
}

/** Split a stored line description into a primary title and optional detail block. */
export function splitLineItemDescription(description: string): { title: string; detail: string | null } {
  const trimmed = description.trim()
  if (!trimmed) return { title: "Line item", detail: null }
  const parts = trimmed.split(/\n+/).map((p) => p.trim()).filter(Boolean)
  if (parts.length <= 1) return { title: trimmed, detail: null }
  return { title: parts[0], detail: parts.slice(1).join("\n") || null }
}

export function formatTaxedIndicator(taxable: boolean | undefined): string | null {
  if (taxable === false) return "No"
  if (taxable === true) return "Yes"
  return null
}
