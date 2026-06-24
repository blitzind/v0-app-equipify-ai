import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildGrowthBookingPagePublicUrl,
  formatSignatureBookingOptionLabel,
  GROWTH_SIGNATURE_BOOKING_OPTIONS_QA_MARKER,
  type GrowthSignatureBookingOption,
} from "@/lib/growth/booking/booking-page-signature-options-types"
import { listGrowthBookingPagesForOwner } from "@/lib/growth/booking/booking-page-repository"

async function resolveOwnerDisplayName(
  admin: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle()
  const name = typeof data?.full_name === "string" ? data.full_name.trim() : ""
  return name || null
}

export async function listGrowthSignatureBookingOptions(
  admin: SupabaseClient,
  input: { ownerUserId: string; origin: string },
): Promise<GrowthSignatureBookingOption[]> {
  const ownerName = await resolveOwnerDisplayName(admin, input.ownerUserId)
  const pages = await listGrowthBookingPagesForOwner(admin, input.ownerUserId)
  const options: GrowthSignatureBookingOption[] = []

  for (const page of pages) {
    options.push({
      id: page.id,
      type: "booking_page",
      url: buildGrowthBookingPagePublicUrl(input.origin, page.slug),
      label: formatSignatureBookingOptionLabel({
        pageTitle: page.pageTitle,
        name: page.name,
        ownerName,
      }),
      ownerName: ownerName ?? undefined,
    })

    const manualUrl = page.manualMeetingUrl?.trim()
    if (manualUrl) {
      options.push({
        id: `${page.id}:meeting_link`,
        type: "meeting_link",
        url: manualUrl,
        label: `${formatSignatureBookingOptionLabel({
          pageTitle: page.pageTitle,
          name: page.name,
          ownerName,
        })} (direct link)`,
        ownerName: ownerName ?? undefined,
      })
    }
  }

  return options.sort((a, b) => a.label.localeCompare(b.label))
}

export { GROWTH_SIGNATURE_BOOKING_OPTIONS_QA_MARKER }
