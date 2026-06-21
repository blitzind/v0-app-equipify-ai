/** GS-SENDR-6C — Operator builder UX (client-safe). */

export const GROWTH_SENDR_BUILDER_UX_QA_MARKER = "growth-sendr-builder-ux-gs-sendr-6c-v1" as const

export type GrowthSendrBuilderPreviewDevice = "desktop" | "tablet" | "mobile"

export const GROWTH_SENDR_BUILDER_PREVIEW_SCALES = [0.5, 0.75, 1] as const

export type GrowthSendrBuilderPreviewScale = (typeof GROWTH_SENDR_BUILDER_PREVIEW_SCALES)[number]

export const GROWTH_SENDR_BUILDER_PREVIEW_DEVICE_WIDTHS: Record<GrowthSendrBuilderPreviewDevice, number | null> = {
  desktop: null,
  tablet: 768,
  mobile: 390,
}
