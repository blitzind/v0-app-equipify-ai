/** Display + dedupe helpers for customer_locations (service sites). */

export type CustomerLocationAddressParts = {
  name: string
  address_line1: string
  address_line2?: string | null
  city: string
  state: string
  postal_code: string
}

export function normalizeAddressFingerprint(parts: {
  address_line1: string
  address_line2?: string | null
  city: string
  state: string
  postal_code: string
}): string {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ")
  return [
    norm(parts.address_line1),
    norm(parts.address_line2 ?? ""),
    norm(parts.city),
    norm(parts.state),
    norm(parts.postal_code),
  ].join("|")
}

/** Single-line label: site name + full mailing line (for selects and headers). */
export function formatCustomerLocationSelectLabel(loc: CustomerLocationAddressParts): string {
  const line2 = loc.address_line2?.trim()
  const street = [loc.address_line1.trim(), line2].filter(Boolean).join(", ")
  const cityLine = `${loc.city.trim()}, ${loc.state.trim()} ${loc.postal_code.trim()}`
  return `${loc.name.trim()} — ${street}, ${cityLine}`
}

/** Shorter line for equipment.location_label when tied to a site (room / area stays separate). */
export function shortSiteLabel(loc: Pick<CustomerLocationAddressParts, "name" | "city" | "state">): string {
  return `${loc.name.trim()} · ${loc.city.trim()}, ${loc.state.trim()}`
}
