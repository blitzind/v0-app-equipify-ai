"use client"

import type {
  GrowthSendrBookingAsset,
  GrowthSendrLandingPage,
  GrowthSendrLandingPageSection,
  GrowthSendrPersonalizationPreviewResult,
  GrowthSendrVideoAsset,
} from "@/lib/growth/sendr/growth-sendr-types"
import { GrowthSendrBuilderLivePreview } from "@/components/growth/sendr/builder/growth-sendr-builder-live-preview"
import { cn } from "@/lib/utils"

type Props = {
  page: GrowthSendrLandingPage
  sections: GrowthSendrLandingPageSection[]
  videoAsset?: GrowthSendrVideoAsset | null
  bookingAsset?: GrowthSendrBookingAsset | null
  personalizationPreview?: GrowthSendrPersonalizationPreviewResult | null
  sticky?: boolean
  className?: string
}

/** @deprecated Use GrowthSendrBuilderLivePreview directly — kept for cert/back-compat. */
export function GrowthSendrPagePreviewPanel({
  page,
  sections,
  videoAsset,
  bookingAsset,
  personalizationPreview,
  sticky = false,
  className,
}: Props) {
  return (
    <GrowthSendrBuilderLivePreview
      page={page}
      sections={sections}
      videoAsset={videoAsset}
      bookingAsset={bookingAsset}
      personalizationPreview={personalizationPreview}
      sticky={sticky}
      className={cn(className)}
    />
  )
}
