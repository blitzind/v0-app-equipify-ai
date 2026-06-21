import type {
  GrowthSendrBookingAsset,
  GrowthSendrLandingPage,
  GrowthSendrLandingPageSection,
  GrowthSendrPersonalizationPreviewResult,
  GrowthSendrPublicPagePayload,
  GrowthSendrVideoAsset,
} from "@/lib/growth/sendr/growth-sendr-types"

function applyPreviewVariables(text: string, resolved: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, key: string) => resolved[key] ?? `{{${key}}}`)
}

function mapSections(sections: GrowthSendrLandingPageSection[]): GrowthSendrPublicPagePayload["sections"] {
  return sections
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((section) => ({
      type: section.sectionType,
      sortOrder: section.sortOrder,
      content: section.content,
    }))
}

export function buildGrowthSendrPagePreviewPayload(input: {
  page: GrowthSendrLandingPage
  sections: GrowthSendrLandingPageSection[]
  videoAsset?: GrowthSendrVideoAsset | null
  bookingAsset?: GrowthSendrBookingAsset | null
  personalizationPreview?: GrowthSendrPersonalizationPreviewResult | null
  prospectMode?: boolean
}): GrowthSendrPublicPagePayload {
  const resolved = input.personalizationPreview?.resolved ?? {}
  const sections = mapSections(input.sections).map((section) => {
    const content = { ...section.content }
    for (const key of ["headline", "body", "label", "personalizationLabel", "trustLine"] as const) {
      if (typeof content[key] === "string") {
        content[key] = applyPreviewVariables(content[key], resolved)
      }
    }
    return { ...section, content }
  })

  const hasPersonalizationPreview = Boolean(input.personalizationPreview)
  const personalizationApplied =
    input.prospectMode === true
      ? hasPersonalizationPreview && (input.personalizationPreview?.missing.length ?? 0) === 0
      : hasPersonalizationPreview

  return {
    title: applyPreviewVariables(input.page.title, resolved),
    publishedVersion: input.page.publishedVersion ?? 1,
    publishedAt: input.page.publishedAt ?? new Date().toISOString(),
    sections,
    video: input.videoAsset
      ? {
          sourceUrl: input.videoAsset.sourceUrl,
          posterUrl: input.videoAsset.posterUrl,
          durationSeconds: input.videoAsset.durationSeconds,
        }
      : null,
    booking: input.bookingAsset
      ? {
          meetingLink: input.bookingAsset.meetingLink,
          meetingType: input.bookingAsset.meetingType,
          durationMinutes: input.bookingAsset.durationMinutes,
          timezone: input.bookingAsset.timezone,
        }
      : null,
    personalization: {
      applied: personalizationApplied,
      mode: hasPersonalizationPreview ? "lead" : "anonymous",
    },
  }
}
