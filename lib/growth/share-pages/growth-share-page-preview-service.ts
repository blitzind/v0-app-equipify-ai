/** Growth Engine SP-UX-2 — Operator workspace preview assembly (server-only). */

import "server-only"

import type { GrowthSharePage, GrowthSharePagePersonalizationContext } from "@/lib/growth/share-pages/share-page-types"
import type { GrowthSharePageOperatorPreviewModel } from "@/lib/growth/share-pages/growth-share-page-operator-workspace-types"
import type { GrowthSharePagePreviewModel } from "@/components/growth/share-pages/growth-share-page-preview-card"

function asPersonalizationContext(
  snapshot: GrowthSharePagePersonalizationContext | Record<string, unknown>,
): GrowthSharePagePersonalizationContext | null {
  if (!snapshot || typeof snapshot !== "object") return null
  if ("headline" in snapshot && "personalizedMessage" in snapshot) {
    return snapshot as GrowthSharePagePersonalizationContext
  }
  return null
}

export function buildGrowthSharePageOperatorPreviewModel(input: {
  page: GrowthSharePage
  contactName: string | null
  companyName: string
  previewUrl: string | null
  publicUrl: string | null
}): GrowthSharePageOperatorPreviewModel {
  const context = asPersonalizationContext(input.page.personalizationSnapshot)
  const primaryCta = input.page.ctaConfig[0] ?? context?.suggestedCta ?? null
  const theme = input.page.theme

  const model: GrowthSharePagePreviewModel = {
    logoUrl: theme.logoUrl ?? "",
    heroImageUrl: theme.heroImageUrl ?? input.page.heroMediaUrl ?? "",
    headline: input.page.headline || context?.headline || "",
    introCopy: input.page.heroMessage || context?.personalizedMessage || "",
    ctaText: primaryCta?.label ?? "",
    ctaUrl: primaryCta?.destinationUrl ?? "",
    calendarUrl: context?.bookingLink ?? primaryCta?.destinationUrl ?? "",
    footerText: theme.footerNote ?? "",
    primaryColor: theme.brandColor,
    accentColor: theme.accentColor,
    recipientName: context?.prospectName ?? input.contactName ?? "",
    companyName: context?.companyName ?? input.companyName,
  }

  return {
    previewUrl: input.previewUrl,
    publicUrl: input.publicUrl,
    model,
  }
}
