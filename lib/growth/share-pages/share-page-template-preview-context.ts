/** Growth Engine S1-F — sample preview context for template renderer (client-safe, no persistence). */

import { buildSharePageTemplateMergeValues } from "@/lib/growth/share-pages/share-page-template-instantiation-compile"

export const GROWTH_SHARE_PAGE_TEMPLATE_PREVIEW_QA_MARKER =
  "growth-share-page-template-preview-s1f-v1" as const

export type GrowthSharePageTemplatePreviewViewport = "desktop" | "tablet" | "mobile"

export const GROWTH_SHARE_PAGE_TEMPLATE_PREVIEW_VIEWPORT_WIDTH: Record<
  GrowthSharePageTemplatePreviewViewport,
  string
> = {
  desktop: "max-w-5xl",
  tablet: "max-w-3xl",
  mobile: "max-w-sm",
}

export type GrowthSharePageTemplatePreviewContext = {
  prospectName: string
  companyName: string
  senderName: string
  senderCompany: string
  bookingLinkOverride: string
  customMergeValues: Record<string, string>
  /** S2-D — template preview disables playback analytics emission by default. */
  analyticsPreviewMode: boolean
  /** S2-F — template preview disables AI video generation execution by default. */
  aiVideoPreviewMode: boolean
  /** S2-G — template preview disables voice clone generation execution by default. */
  voiceClonePreviewMode: boolean
  /** S2-H — template preview disables conversational agent execution by default. */
  conversationalAgentPreviewMode: boolean
  /** S2-I — template preview disables AI Q&A execution by default. */
  aiQaPreviewMode: boolean
  /** S2-J — template preview disables booking handoff execution by default. */
  bookingHandoffPreviewMode: boolean
}

export const DEFAULT_GROWTH_SHARE_PAGE_TEMPLATE_PREVIEW_CONTEXT: GrowthSharePageTemplatePreviewContext =
  {
    prospectName: "Alex Rivera",
    companyName: "Summit Field Services",
    senderName: "Jordan Lee",
    senderCompany: "Equipify",
    bookingLinkOverride: "",
    customMergeValues: {},
    analyticsPreviewMode: true,
    aiVideoPreviewMode: true,
    voiceClonePreviewMode: true,
    conversationalAgentPreviewMode: true,
    aiQaPreviewMode: true,
    bookingHandoffPreviewMode: true,
  }

/** @deprecated Use DEFAULT_GROWTH_SHARE_PAGE_TEMPLATE_PREVIEW_CONTEXT */
export const GROWTH_SHARE_PAGE_TEMPLATE_SAMPLE_CONTEXT = {
  prospectName: DEFAULT_GROWTH_SHARE_PAGE_TEMPLATE_PREVIEW_CONTEXT.prospectName,
  companyName: DEFAULT_GROWTH_SHARE_PAGE_TEMPLATE_PREVIEW_CONTEXT.companyName,
} as const

export function buildSharePageTemplatePreviewMergeValues(
  context: GrowthSharePageTemplatePreviewContext,
): Record<string, string> {
  const bookingLink = context.bookingLinkOverride.trim()
  return {
    ...buildSharePageTemplateMergeValues({
      prospectName: context.prospectName,
      companyName: context.companyName,
      bookingLink: bookingLink || null,
    }),
    "sender.name": context.senderName,
    "sender.company": context.senderCompany,
    ...context.customMergeValues,
  }
}

export function parseSharePageTemplateCustomMergeField(input: string): Record<string, string> {
  const trimmed = input.trim()
  if (!trimmed) return {}
  const [key, ...rest] = trimmed.split("=")
  const normalizedKey = key?.trim()
  const value = rest.join("=").trim()
  if (!normalizedKey) return {}
  return { [normalizedKey]: value }
}
