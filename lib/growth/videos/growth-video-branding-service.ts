/** Growth Engine B2 — Branding preview helpers (reuses Share Page theme defaults). */

import { DEFAULT_GROWTH_SHARE_PAGE_THEME } from "@/lib/growth/share-pages/share-page-types"
import type {
  GrowthVideoOverlayBrandingPreview,
  GrowthVideoPageBranding,
} from "@/lib/growth/videos/growth-video-types"

export function buildGrowthVideoBrandingPreview(
  pageBranding: GrowthVideoPageBranding,
  overlayBranding?: GrowthVideoOverlayBrandingPreview | null,
): GrowthVideoOverlayBrandingPreview {
  const primary =
    overlayBranding?.primaryColor?.trim() ||
    pageBranding.primaryColor?.trim() ||
    DEFAULT_GROWTH_SHARE_PAGE_THEME.brandColor

  return {
    logoUrl: overlayBranding?.logoUrl ?? pageBranding.logoUrl ?? null,
    primaryColor: primary,
    accentColor:
      overlayBranding?.accentColor?.trim() ||
      pageBranding.primaryColor?.trim() ||
      DEFAULT_GROWTH_SHARE_PAGE_THEME.accentColor,
    buttonLabelOverride:
      overlayBranding?.buttonLabelOverride ?? pageBranding.buttonLabelOverride ?? null,
  }
}

export function buildGrowthVideoSharePageThemePreview(input: {
  pageBranding: GrowthVideoPageBranding
  overlayBranding?: GrowthVideoOverlayBrandingPreview | null
}) {
  const preview = buildGrowthVideoBrandingPreview(input.pageBranding, input.overlayBranding)
  return {
    brandColor: preview.primaryColor ?? DEFAULT_GROWTH_SHARE_PAGE_THEME.brandColor,
    accentColor: preview.accentColor ?? DEFAULT_GROWTH_SHARE_PAGE_THEME.accentColor,
    logoUrl: preview.logoUrl ?? null,
    heroImageUrl: null,
    publicThemeMode: DEFAULT_GROWTH_SHARE_PAGE_THEME.publicThemeMode,
    footerNote: null,
  }
}
