/** Growth Engine S1-F — preview renderer + sample context certification (client-safe). */

import { randomUUID } from "node:crypto"
import { GROWTH_SHARE_PAGE_TEMPLATE_BLOCK_TYPES } from "@/lib/growth/share-pages/share-page-template-block-types"
import { createTemplateBlock } from "@/lib/growth/share-pages/share-page-template-editor-utils"
import {
  addVideoOverlayToSpec,
  createDefaultVideoOverlaySpec,
  resolveVideoOverlayItems,
  validateVideoOverlaySpec,
} from "@/lib/growth/media/media-video-overlay-utils"
import { GROWTH_MEDIA_VIDEO_OVERLAY_SAFETY_FLAGS } from "@/lib/growth/media/media-video-overlay-types"
import {
  buildSharePageTemplatePreviewMergeValues,
  DEFAULT_GROWTH_SHARE_PAGE_TEMPLATE_PREVIEW_CONTEXT,
  GROWTH_SHARE_PAGE_TEMPLATE_PREVIEW_QA_MARKER,
  GROWTH_SHARE_PAGE_TEMPLATE_PREVIEW_VIEWPORT_WIDTH,
  type GrowthSharePageTemplatePreviewContext,
  type GrowthSharePageTemplatePreviewViewport,
} from "@/lib/growth/share-pages/share-page-template-preview-context"
import { mapTemplateEditorToRenderModel } from "@/lib/growth/share-pages/share-page-template-render-model"
import { DEFAULT_GROWTH_SHARE_PAGE_THEME } from "@/lib/growth/share-pages/share-page-types"

export type GrowthSharePageTemplatePreviewDiagnosticsCheck = {
  id: string
  ok: boolean
  detail: string
}

export type GrowthSharePageTemplatePreviewDiagnosticsReport = {
  ok: boolean
  qa_marker: typeof GROWTH_SHARE_PAGE_TEMPLATE_PREVIEW_QA_MARKER
  checks: GrowthSharePageTemplatePreviewDiagnosticsCheck[]
}

function pushCheck(
  checks: GrowthSharePageTemplatePreviewDiagnosticsCheck[],
  id: string,
  ok: boolean,
  detail: string,
): void {
  checks.push({ id, ok, detail })
}

function buildCertPreviewBlocks() {
  const hero = createTemplateBlock("hero")
  hero.headline = "Hi {{lead.contact_name}} from {{sender.name}} at {{sender.company}}"
  hero.subheadline = "Built for {{company.name}}"
  hero.heroMessage = "Booking: {{booking.link}}"

  const text = createTemplateBlock("text", 1)
  text.heading = "Why {{company.name}}"
  text.body = "Custom tier: {{account.tier}}"

  const image = createTemplateBlock("image", 2)
  image.imageUrl = "https://example.com/preview.jpg"
  image.altText = "Fleet photo"
  image.caption = "Sample image block"

  const cta = createTemplateBlock("cta", 3)
  cta.label = "Book with {{sender.name}}"

  const calendar = createTemplateBlock("calendar", 4)
  calendar.heading = "Pick a time"

  const testimonials = createTemplateBlock("testimonials", 5)
  testimonials.items = [
    {
      id: randomUUID(),
      quote: "Great partner for {{company.name}}",
      authorName: "Taylor",
      authorTitle: "Ops lead",
      companyName: "Northwind",
    },
  ]

  const custom = createTemplateBlock("custom", 6)
  custom.htmlSafeText = "Custom HTML-safe copy for {{lead.contact_name}}"

  const video = createTemplateBlock("video_placeholder", 7)
  video.layout = "wide"
  video.settings = {
    overlaySpec: addVideoOverlayToSpec(createDefaultVideoOverlaySpec(), "lower_third"),
  }
  if (video.type === "video_placeholder" && video.settings?.overlaySpec) {
    video.settings.overlaySpec.overlays[0].textTemplate = "Hi {{prospect.name}} from {{sender.name}}"
  }

  const voice = createTemplateBlock("voice_placeholder", 8)
  voice.showTranscript = true

  const mediaCta = createTemplateBlock("media_cta_placeholder", 9)
  mediaCta.ctaLabel = "Watch demo"

  return [hero, text, image, cta, calendar, testimonials, custom, video, voice, mediaCta]
}

function certifyViewportTokens(checks: GrowthSharePageTemplatePreviewDiagnosticsCheck[]): void {
  for (const viewport of ["desktop", "tablet", "mobile"] as const) {
    pushCheck(
      checks,
      `preview_viewport_${viewport}`,
      Boolean(GROWTH_SHARE_PAGE_TEMPLATE_PREVIEW_VIEWPORT_WIDTH[viewport]),
      `${viewport} viewport width token present.`,
    )
  }
}

function certifyPreviewContext(
  checks: GrowthSharePageTemplatePreviewDiagnosticsCheck[],
  context: GrowthSharePageTemplatePreviewContext,
): void {
  const mergeValues = buildSharePageTemplatePreviewMergeValues(context)
  pushCheck(
    checks,
    "preview_merge_prospect",
    mergeValues["lead.contact_name"] === context.prospectName,
    "Prospect merge values resolve.",
  )
  pushCheck(
    checks,
    "preview_merge_sender",
    mergeValues["sender.name"] === context.senderName &&
      mergeValues["sender.company"] === context.senderCompany,
    "Sender merge values resolve.",
  )
  pushCheck(
    checks,
    "preview_merge_booking_override",
    mergeValues["booking.link"] === context.bookingLinkOverride,
    "Booking link override resolves.",
  )
  pushCheck(
    checks,
    "preview_merge_custom",
    mergeValues["account.tier"] === context.customMergeValues["account.tier"],
    "Custom merge values resolve.",
  )
}

export function executeSharePageTemplatePreviewDiagnostics(): GrowthSharePageTemplatePreviewDiagnosticsReport {
  const checks: GrowthSharePageTemplatePreviewDiagnosticsCheck[] = []
  certifyViewportTokens(checks)

  const previewContext: GrowthSharePageTemplatePreviewContext = {
    ...DEFAULT_GROWTH_SHARE_PAGE_TEMPLATE_PREVIEW_CONTEXT,
    bookingLinkOverride: "https://preview.equipify.test/book/demo",
    customMergeValues: { "account.tier": "Enterprise" },
  }
  certifyPreviewContext(checks, previewContext)

  const blocks = buildCertPreviewBlocks()
  pushCheck(
    checks,
    "preview_block_coverage",
    GROWTH_SHARE_PAGE_TEMPLATE_BLOCK_TYPES.every((type) => blocks.some((block) => block.type === type)),
    "Cert fixture includes all template block types.",
  )

  const preview = mapTemplateEditorToRenderModel({
    blocks,
    theme: {
      ...DEFAULT_GROWTH_SHARE_PAGE_THEME,
      brandColor: "#0044aa",
      accentColor: "#ff6600",
      footerNote: "Preview footer",
    },
    previewContext,
    defaultBookingPageId: "00000000-0000-4000-8000-000000000001",
  })

  pushCheck(checks, "preview_hero_render", preview.renderModel.headline.includes("Alex Rivera"), "Hero merge fields render.")
  pushCheck(
    checks,
    "preview_sender_render",
    preview.renderModel.headline.includes("Jordan Lee") && preview.renderModel.headline.includes("Equipify"),
    "Sender merge fields render in hero.",
  )
  pushCheck(
    checks,
    "preview_text_render",
    preview.renderModel.heroMessage.includes("Enterprise"),
    "Text block merge fields render.",
  )
  pushCheck(checks, "preview_cta_render", preview.renderModel.ctaConfig.length >= 1, "CTA block maps to render model.")
  pushCheck(
    checks,
    "preview_calendar_render",
    preview.renderModel.booking?.disabled === true && Boolean(preview.renderModel.booking?.bookingUrl),
    "Calendar block maps to disabled booking preview.",
  )
  pushCheck(
    checks,
    "preview_testimonials_render",
    preview.renderModel.companyObservations.some((entry) => entry.includes("Summit Field Services")),
    "Testimonials block maps to observations.",
  )
  pushCheck(
    checks,
    "preview_theme_render",
    preview.renderModel.theme.brandColor === "#0044aa" &&
      preview.renderModel.theme.accentColor === "#ff6600",
    "Theme values apply to render model.",
  )
  pushCheck(
    checks,
    "preview_booking_override",
    preview.renderModel.booking?.bookingUrl === previewContext.bookingLinkOverride,
    "Booking link override applies to preview booking URL.",
  )
  pushCheck(
    checks,
    "preview_no_public_token",
    preview.renderModel.publicToken == null && preview.renderModel.previewMode === true,
    "Preview remains tokenless with previewMode guard.",
  )

  const placeholderTypes = new Set(
    preview.extraBlocks.map((block) => block.type),
  )
  pushCheck(
    checks,
    "preview_image_panel",
    preview.extraBlocks.some((block) => block.type === "image"),
    "Image block surfaces in preview panels.",
  )
  pushCheck(
    checks,
    "preview_custom_panel",
    preview.extraBlocks.some((block) => block.type === "custom"),
    "Custom block surfaces in preview panels.",
  )
  pushCheck(
    checks,
    "preview_video_placeholder",
    placeholderTypes.has("video_placeholder") &&
      preview.extraBlocks.some(
        (block) =>
          block.type === "video_placeholder" &&
          block.layout === "wide" &&
          Boolean(block.overlaySpec?.overlays?.length),
      ),
    "Video placeholder includes overlay preview metadata.",
  )
  pushCheck(
    checks,
    "preview_voice_placeholder",
    placeholderTypes.has("voice_placeholder") &&
      preview.extraBlocks.some((block) => block.type === "voice_placeholder" && block.showTranscript === true),
    "Voice placeholder includes transcript preview metadata.",
  )
  pushCheck(
    checks,
    "preview_media_cta_placeholder",
    placeholderTypes.has("media_cta_placeholder") &&
      preview.extraBlocks.some((block) => block.type === "media_cta_placeholder" && block.ctaLabel === "Watch demo"),
    "Media CTA placeholder includes CTA preview metadata.",
  )

  const mergeValues = buildSharePageTemplatePreviewMergeValues(previewContext)
  const videoBlock = blocks.find((block) => block.type === "video_placeholder")
  const overlayValidation = validateVideoOverlaySpec({
    spec: videoBlock?.type === "video_placeholder" ? videoBlock.settings?.overlaySpec : null,
    allowedMergeKeys: new Set(Object.keys(mergeValues)),
  })
  pushCheck(
    checks,
    "preview_video_overlay_validation",
    overlayValidation.valid,
    "Video overlay spec passes merge-field validation.",
  )

  const overlayPreview = resolveVideoOverlayItems(
    videoBlock?.type === "video_placeholder" ? videoBlock.settings?.overlaySpec : null,
    mergeValues,
  )
  pushCheck(
    checks,
    "preview_video_overlay_render",
    overlayPreview.some((item) => item.resolvedText.includes(previewContext.prospectName)),
    "Video overlay preview resolves merge fields.",
  )
  pushCheck(
    checks,
    "preview_video_overlay_safety",
    GROWTH_MEDIA_VIDEO_OVERLAY_SAFETY_FLAGS.no_rendered_video === true &&
      GROWTH_MEDIA_VIDEO_OVERLAY_SAFETY_FLAGS.no_playback === true,
    "Video overlay preview preserves no-render/no-playback guards.",
  )

  for (const viewport of ["desktop", "tablet", "mobile"] as GrowthSharePageTemplatePreviewViewport[]) {
    const viewportPreview = mapTemplateEditorToRenderModel({
      blocks,
      theme: DEFAULT_GROWTH_SHARE_PAGE_THEME,
      previewContext,
    })
    pushCheck(
      checks,
      `preview_render_${viewport}`,
      viewportPreview.renderModel.headline.length > 0,
      `${viewport} preview render model builds successfully.`,
    )
  }

  const failed = checks.filter((check) => !check.ok)
  return {
    ok: failed.length === 0,
    qa_marker: GROWTH_SHARE_PAGE_TEMPLATE_PREVIEW_QA_MARKER,
    checks,
  }
}

export const GROWTH_SHARE_PAGE_TEMPLATE_PLATFORM_ROUTE_PATHS = [
  "app/api/platform/growth/share-pages/templates/route.ts",
  "app/api/platform/growth/share-pages/templates/[id]/route.ts",
  "app/api/platform/growth/share-pages/templates/[id]/versions/route.ts",
  "app/api/platform/growth/share-pages/templates/[id]/publish/route.ts",
  "app/api/platform/growth/share-pages/templates/[id]/unpublish/route.ts",
  "app/api/platform/growth/share-pages/templates/[id]/duplicate/route.ts",
  "app/api/platform/growth/share-pages/templates/[id]/instantiate/route.ts",
  "app/api/platform/growth/share-pages/templates/[id]/versions/[versionId]/restore/route.ts",
  "app/api/platform/growth/share-pages/templates/[id]/versions/[versionId]/duplicate/route.ts",
] as const

export const GROWTH_SHARE_PAGE_TEMPLATE_ADMIN_ROUTE_PATHS = [
  "app/(admin)/admin/growth/share-pages/templates/page.tsx",
  "app/(admin)/admin/growth/share-pages/templates/new/page.tsx",
  "app/(admin)/admin/growth/share-pages/templates/[id]/page.tsx",
  "app/(admin)/admin/growth/share-pages/templates/[id]/preview/page.tsx",
] as const

export const GROWTH_SHARE_PAGE_TEMPLATE_UI_MODULE_PATHS = [
  "components/growth/share-pages/templates/growth-share-page-template-library.tsx",
  "components/growth/share-pages/templates/growth-share-page-template-editor.tsx",
  "components/growth/share-pages/templates/growth-share-page-template-publish-dialog.tsx",
  "components/growth/share-pages/templates/growth-share-page-template-version-timeline.tsx",
  "components/growth/share-pages/templates/growth-share-page-template-instantiate-dialog.tsx",
  "components/growth/share-pages/templates/growth-share-page-template-preview-renderer.tsx",
  "components/growth/share-pages/templates/growth-share-page-template-preview-page.tsx",
  "components/growth/share-pages/templates/growth-share-page-template-preview-context-panel.tsx",
  "components/growth/share-pages/templates/growth-share-page-template-placeholder-panel.tsx",
] as const
