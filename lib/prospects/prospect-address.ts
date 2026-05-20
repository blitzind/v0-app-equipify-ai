import type { ProspectRow } from "@/lib/prospects/types"

export function prospectHasResolvableAddress(prospect: Pick<
  ProspectRow,
  "address_line1" | "city" | "state"
>): boolean {
  const line1 = prospect.address_line1?.trim()
  const city = prospect.city?.trim()
  const state = prospect.state?.trim()
  return Boolean(line1 || (city && state))
}

export function formatProspectAddressSummary(
  prospect: Pick<
    ProspectRow,
    "company_name" | "address_line1" | "address_line2" | "city" | "state" | "postal_code" | "country"
  >,
): string | null {
  const lines: string[] = []
  const line1 = prospect.address_line1?.trim()
  const line2 = prospect.address_line2?.trim()
  const city = prospect.city?.trim()
  const state = prospect.state?.trim()
  const postal = prospect.postal_code?.trim()
  const country = prospect.country?.trim()

  if (line1) lines.push(line1)
  if (line2) lines.push(line2)
  const cityStatePostal = [city, state].filter(Boolean).join(", ")
  const cityLine = [cityStatePostal, postal].filter(Boolean).join(" ").trim()
  if (cityLine) lines.push(cityLine)
  if (country) lines.push(country)

  if (lines.length === 0) return null
  return lines.join("\n")
}
