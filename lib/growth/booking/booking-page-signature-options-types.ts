/** GS-GROWTH-SIGNATURES-BOOKING-1D — signature booking picker types (client-safe). */

export const GROWTH_SIGNATURE_BOOKING_OPTIONS_QA_MARKER =
  "growth-signatures-booking-1d-v1" as const

export type GrowthSignatureBookingOptionType = "booking_page" | "calendar" | "meeting_link"

export type GrowthSignatureBookingOption = {
  id: string
  label: string
  url: string
  type: GrowthSignatureBookingOptionType
  ownerName?: string
}

export type GrowthSignatureBookingOptionsResponse = {
  ok: true
  options: GrowthSignatureBookingOption[]
  qa_marker: typeof GROWTH_SIGNATURE_BOOKING_OPTIONS_QA_MARKER
}

export function buildGrowthBookingPagePublicUrl(origin: string, slug: string): string {
  return `${origin.trim().replace(/\/+$/, "")}/book/${slug}`
}

export function normalizeSignatureBookingUrl(url: string): string {
  return url.trim().replace(/\/+$/, "")
}

export function findSignatureBookingOptionByUrl(
  bookingUrl: string,
  options: GrowthSignatureBookingOption[],
): GrowthSignatureBookingOption | null {
  const normalized = normalizeSignatureBookingUrl(bookingUrl)
  if (!normalized) return null
  return (
    options.find((option) => normalizeSignatureBookingUrl(option.url) === normalized) ?? null
  )
}

export function resolveSignatureBookingSourceFromUrl(
  bookingUrl: string,
  options: GrowthSignatureBookingOption[],
): { source: "manual" | "existing"; pageId: string | null; customUrl: boolean } {
  const match = findSignatureBookingOptionByUrl(bookingUrl, options)
  if (!match) {
    return { source: bookingUrl.trim() ? "manual" : "manual", pageId: null, customUrl: false }
  }
  const customUrl = normalizeSignatureBookingUrl(bookingUrl) !== normalizeSignatureBookingUrl(match.url)
  return { source: "existing", pageId: match.id, customUrl }
}

export function formatSignatureBookingOptionLabel(input: {
  pageTitle: string | null
  name: string
  ownerName?: string | null
}): string {
  const title = (input.pageTitle?.trim() || input.name.trim()).trim()
  const owner = input.ownerName?.trim()
  return owner ? `${title} / ${owner}` : title
}
