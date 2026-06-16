/** Growth Engine S1-C — Share Page Template editor helpers (client-safe). */

import type {
  GrowthSharePageTemplateBlock,
  GrowthSharePageTemplateBlockType,
  GrowthSharePageTemplateTestimonialEntry,
} from "@/lib/growth/share-pages/share-page-template-block-types"
import { DEFAULT_GROWTH_SHARE_PAGE_THEME } from "@/lib/growth/share-pages/share-page-types"

export const GROWTH_SHARE_PAGE_TEMPLATE_EDITOR_QA_MARKER = "growth-share-page-template-editor-s1c-v1" as const

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

export const GROWTH_SHARE_PAGE_TEMPLATE_SAMPLE_CONTEXT = {
  prospectName: "Alex Rivera",
  companyName: "Summit Field Services",
} as const

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
        mediaAssetRef: null,
        layout: "wide",
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
