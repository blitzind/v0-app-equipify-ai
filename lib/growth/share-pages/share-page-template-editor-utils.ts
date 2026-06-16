/** Growth Engine S1-C — Share Page Template editor helpers (client-safe). */

import type {
  GrowthSharePageTemplateBlock,
  GrowthSharePageTemplateBlockType,
  GrowthSharePageTemplateTestimonialEntry,
} from "@/lib/growth/share-pages/share-page-template-block-types"
import { createDefaultVideoOverlaySpec } from "@/lib/growth/media/media-video-overlay-utils"
import { DEFAULT_GROWTH_SHARE_PAGE_THEME } from "@/lib/growth/share-pages/share-page-types"

export const GROWTH_SHARE_PAGE_TEMPLATE_EDITOR_QA_MARKER = "growth-share-page-template-editor-s1c-v1" as const

export { GROWTH_SHARE_PAGE_TEMPLATE_SAMPLE_CONTEXT } from "@/lib/growth/share-pages/share-page-template-preview-context"

export const GROWTH_SHARE_PAGE_TEMPLATE_BLOCK_LABELS: Record<GrowthSharePageTemplateBlockType, string> = {
  hero: "Hero",
  text: "Text",
  image: "Image",
  cta: "CTA",
  calendar: "Calendar",
  testimonials: "Testimonials",
  custom: "Custom",
  video_placeholder: "Video Placeholder",
  voice_placeholder: "Voice Placeholder",
  media_cta_placeholder: "Media CTA Placeholder",
}

function newBlockId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `block-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export type GrowthSharePageTemplateSortKey = "updated_at" | "name" | "status"

export type GrowthSharePageTemplateEditorMetadata = {
  name: string
  description: string
  category: string
  tags: string[]
  previewImageUrl: string | null
}

export type GrowthSharePageTemplateEditorDraft = {
  metadata: GrowthSharePageTemplateEditorMetadata
  blocks: GrowthSharePageTemplateBlock[]
  theme: typeof DEFAULT_GROWTH_SHARE_PAGE_THEME
  defaultBookingPageId: string | null
}

export function createDefaultTemplateEditorDraft(
  input?: Partial<GrowthSharePageTemplateEditorMetadata>,
): GrowthSharePageTemplateEditorDraft {
  return {
    metadata: {
      name: input?.name ?? "Untitled template",
      description: input?.description ?? "",
      category: input?.category ?? "general",
      tags: input?.tags ?? [],
      previewImageUrl: input?.previewImageUrl ?? null,
    },
    blocks: [createTemplateBlock("hero")],
    theme: { ...DEFAULT_GROWTH_SHARE_PAGE_THEME },
    defaultBookingPageId: null,
  }
}

export function createTemplateBlock(type: GrowthSharePageTemplateBlockType, order = 0): GrowthSharePageTemplateBlock {
  const base = { id: newBlockId(), type, order, enabled: true }

  switch (type) {
    case "hero":
      return {
        ...base,
        type: "hero",
        headline: "",
        subheadline: null,
        heroMessage: "",
        showLogo: true,
        heroMediaType: "none",
        heroMediaUrl: null,
        heroMediaThumbnailUrl: null,
      }
    case "text":
      return { ...base, type: "text", heading: null, body: "" }
    case "image":
      return { ...base, type: "image", imageUrl: null, altText: "", caption: null }
    case "cta":
      return {
        ...base,
        type: "cta",
        label: "Book a meeting",
        kind: "primary",
        action: "book_meeting",
        destinationUrl: null,
        trackingKey: "primary_cta",
      }
    case "calendar":
      return { ...base, type: "calendar", heading: "Schedule time", bookingPageId: null, embedMode: "inline" }
    case "testimonials":
      return {
        ...base,
        type: "testimonials",
        heading: "What customers say",
        items: [createTestimonialEntry()],
      }
    case "custom":
      return { ...base, type: "custom", htmlSafeText: "" }
    case "video_placeholder":
      return {
        ...base,
        type: "video_placeholder",
        heading: "Personalized video",
        placeholderLabel: "Video personalization placeholder",
        videoAssetId: null,
        mediaAssetRef: null,
        layout: "wide",
        settings: {
          overlaySpec: createDefaultVideoOverlaySpec(),
          aiVideo: {
            enabled: false,
            avatarId: null,
            scriptTemplate: "Hi {{prospect.name}}, this is {{sender.name}} from {{sender.company}}.",
            mergeFieldsUsed: ["prospect.name", "sender.name", "sender.company"],
            voiceClone: {
              enabled: false,
              voiceId: null,
              scriptTemplate: "Hi {{prospect.name}}, this is {{sender.name}} from {{sender.company}}.",
              mergeFieldsUsed: ["prospect.name", "sender.name", "sender.company"],
            },
            conversationalAgent: {
              enabled: false,
              agentId: null,
              qualificationGoal: "meeting_readiness",
              systemPromptTemplate:
                "You are speaking with {{prospect.name}} at {{company.name}} on behalf of {{sender.company}}.",
              mergeFieldsUsed: ["prospect.name", "company.name", "sender.company"],
              aiQa: {
                enabled: false,
                policyId: "qa-policy-safe-default",
                questionPromptTemplate: "What would {{prospect.name}} like to know about {{sender.company}}?",
                fallbackResponse:
                  "Thanks for your question. A member of our team will follow up with a precise answer shortly.",
                knowledgeSourceRefs: [
                  { sourceType: "share_page_template", sourceId: null, label: "Template content", enabled: true },
                ],
                mergeFieldsUsed: ["prospect.name", "sender.company"],
                bookingHandoffEnabled: true,
              },
              bookingHandoff: {
                enabled: false,
                readinessTier: "not_ready",
                readinessScore: 0,
                recommendedMeetingType: null,
                recommendedDurationMinutes: null,
                recommendedAttendees: [],
                bookingRecommendation: null,
                agendaTemplate:
                  "Intro for {{prospect.name}} at {{company.name}} · goals · fit · next steps",
                nextSteps: [],
              },
            },
          },
        },
      }
    case "voice_placeholder":
      return {
        ...base,
        type: "voice_placeholder",
        heading: "Voice note",
        placeholderLabel: "Voice personalization placeholder",
        mediaAssetRef: null,
        showTranscript: true,
      }
    case "media_cta_placeholder":
      return {
        ...base,
        type: "media_cta_placeholder",
        heading: "Media CTA",
        placeholderLabel: "Media CTA placeholder",
        ctaLabel: "Watch and book",
        mediaAssetRef: null,
        linkedBlockId: null,
      }
  }
}

export function createTestimonialEntry(): GrowthSharePageTemplateTestimonialEntry {
  return {
    id: newBlockId(),
    quote: "",
    authorName: "",
    authorTitle: null,
    companyName: null,
  }
}

export function normalizeTemplateBlockOrder(blocks: GrowthSharePageTemplateBlock[]): GrowthSharePageTemplateBlock[] {
  return blocks
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((block, index) => ({ ...block, order: index }))
}

export function moveTemplateBlock(
  blocks: GrowthSharePageTemplateBlock[],
  blockId: string,
  direction: -1 | 1,
): GrowthSharePageTemplateBlock[] {
  const sorted = normalizeTemplateBlockOrder(blocks)
  const index = sorted.findIndex((block) => block.id === blockId)
  if (index < 0) return sorted
  const target = index + direction
  if (target < 0 || target >= sorted.length) return sorted
  const next = sorted.slice()
  const [removed] = next.splice(index, 1)
  if (!removed) return sorted
  next.splice(target, 0, removed)
  return normalizeTemplateBlockOrder(next)
}

export function removeTemplateBlock(
  blocks: GrowthSharePageTemplateBlock[],
  blockId: string,
): GrowthSharePageTemplateBlock[] {
  return normalizeTemplateBlockOrder(blocks.filter((block) => block.id !== blockId))
}

export function updateTemplateBlock(
  blocks: GrowthSharePageTemplateBlock[],
  blockId: string,
  updater: (block: GrowthSharePageTemplateBlock) => GrowthSharePageTemplateBlock,
): GrowthSharePageTemplateBlock[] {
  return blocks.map((block) => (block.id === blockId ? updater(block) : block))
}

export function isTemplateBlockEnabled(block: GrowthSharePageTemplateBlock): boolean {
  return block.enabled !== false
}

export function sortTemplates<T extends { name: string; status: string; updatedAt: string }>(
  items: T[],
  sortKey: GrowthSharePageTemplateSortKey,
): T[] {
  const copy = items.slice()
  if (sortKey === "name") {
    return copy.sort((a, b) => a.name.localeCompare(b.name))
  }
  if (sortKey === "status") {
    return copy.sort((a, b) => a.status.localeCompare(b.status) || b.updatedAt.localeCompare(a.updatedAt))
  }
  return copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}
