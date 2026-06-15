import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { resolveSharePageBookingRenderModel } from "@/lib/growth/share-pages/share-page-booking-service"
import { validateSharePagePublicRouteToken } from "@/lib/growth/share-pages/share-page-public-access"
import { lookupSharePageByPreviewToken, lookupSharePageByPublicToken } from "@/lib/growth/share-pages/share-page-repository"
import { mapSharePageToRenderModel, readSharePagePersonalizationSnapshot } from "@/lib/growth/share-pages/share-page-render-model"
import type {
  GrowthSharePagePublicAccessReason,
  GrowthSharePagePublicAccessResult,
  GrowthSharePageRenderModel,
} from "@/lib/growth/share-pages/share-page-types"

export { mapSharePageToRenderModel } from "@/lib/growth/share-pages/share-page-render-model"

export async function buildSharePageRenderModel(
  admin: SupabaseClient,
  page: Parameters<typeof mapSharePageToRenderModel>[0],
  input: { previewMode: boolean; publicToken?: string | null },
): Promise<GrowthSharePageRenderModel> {
  const lead = await fetchGrowthLeadById(admin, page.leadId)
  const snapshot = readSharePagePersonalizationSnapshot(page.personalizationSnapshot)
  const booking = await resolveSharePageBookingRenderModel(admin, page, {
    previewMode: input.previewMode,
  })

  return mapSharePageToRenderModel(page, {
    prospectName: lead?.contactName?.trim() || snapshot?.prospectName || "there",
    companyName: lead?.companyName?.trim() || snapshot?.companyName || "your company",
    previewMode: input.previewMode,
    publicToken: input.publicToken ?? null,
    booking,
  })
}

export function validateSharePageRouteToken(rawToken: string | undefined): GrowthSharePagePublicAccessReason | "invalid_format" {
  return validateSharePagePublicRouteToken(rawToken)
}

export async function resolveSharePagePublicRoute(
  admin: SupabaseClient,
  rawToken: string,
): Promise<GrowthSharePagePublicAccessResult> {
  const format = validateSharePageRouteToken(rawToken)
  if (format === "invalid_format" || format === "not_found") {
    return { access: "not_found", page: null }
  }
  return lookupSharePageByPublicToken(admin, rawToken)
}

export async function resolveSharePagePreviewRoute(
  admin: SupabaseClient,
  rawToken: string,
): Promise<GrowthSharePagePublicAccessResult> {
  const format = validateSharePageRouteToken(rawToken)
  if (format === "invalid_format" || format === "not_found") {
    return { access: "not_found", page: null }
  }
  return lookupSharePageByPreviewToken(admin, rawToken)
}

export const GROWTH_SHARE_PAGE_UNAVAILABLE_COPY: Record<
  Exclude<GrowthSharePagePublicAccessReason, "granted">,
  { title: string; message: string }
> = {
  not_found: {
    title: "Page not found",
    message: "This link is invalid or may have been removed.",
  },
  invalid_token: {
    title: "Page not found",
    message: "This link is invalid or may have been removed.",
  },
  unpublished: {
    title: "Page not available",
    message: "This personalized page is not published yet.",
  },
  expired: {
    title: "Link expired",
    message: "This personalized page link has expired. Please contact your Equipify representative for an updated link.",
  },
  revoked: {
    title: "Link revoked",
    message: "This personalized page is no longer available.",
  },
  archived: {
    title: "Page archived",
    message: "This personalized page has been archived and is no longer accessible.",
  },
}
