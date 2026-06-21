import type { LucideIcon } from "lucide-react"
import {
  CalendarDays,
  CircleHelp,
  FileText,
  LayoutTemplate,
  MousePointerClick,
  Sparkles,
  Video,
} from "lucide-react"
import type { GrowthSendrLandingPageSection } from "@/lib/growth/sendr/growth-sendr-types"
import {
  isPresentationBenefitsSection,
  parsePresentationResources,
  parsePresentationTestimonials,
} from "@/lib/growth/sendr/growth-sendr-presentation-content"

export type GrowthSendrBuilderSectionMeta = {
  label: string
  description: string
  icon: LucideIcon
  accentClass: string
}

const BASE_META: Record<string, GrowthSendrBuilderSectionMeta> = {
  hero: {
    label: "Hero",
    description: "Opening headline and narrative for your prospect",
    icon: Sparkles,
    accentClass: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  video: {
    label: "Video",
    description: "Personalized walkthrough playback",
    icon: Video,
    accentClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  avatar_video: {
    label: "Avatar video",
    description: "AI avatar walkthrough section",
    icon: Video,
    accentClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  text: {
    label: "Content",
    description: "Supporting copy, benefits, or structured blocks",
    icon: FileText,
    accentClass: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  },
  cta: {
    label: "Call to action",
    description: "Primary next step for your prospect",
    icon: MousePointerClick,
    accentClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  calendar: {
    label: "Booking",
    description: "Schedule a demo or meeting",
    icon: CalendarDays,
    accentClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  faq: {
    label: "FAQ",
    description: "Answer common questions before they book",
    icon: CircleHelp,
    accentClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  custom_html: {
    label: "Resources",
    description: "Custom HTML or downloadable resources",
    icon: LayoutTemplate,
    accentClass: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  },
}

export function getGrowthSendrBuilderSectionMeta(sectionType: string): GrowthSendrBuilderSectionMeta {
  return (
    BASE_META[sectionType] ?? {
      label: sectionType.replace(/_/g, " "),
      description: "Page section",
      icon: FileText,
      accentClass: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
    }
  )
}

export function summarizeGrowthSendrSection(section: GrowthSendrLandingPageSection): string {
  const content = section.content
  const kind = typeof content.presentationKind === "string" ? content.presentationKind : null

  if (kind === "testimonials" || parsePresentationTestimonials(content).length > 0) {
    const count = parsePresentationTestimonials(content).length
    return count > 0 ? `${count} testimonial${count === 1 ? "" : "s"}` : "Testimonials block"
  }
  if (kind === "resources" || kind === "downloads" || parsePresentationResources(content).length > 0) {
    const count = parsePresentationResources(content).length
    return count > 0 ? `${count} resource${count === 1 ? "" : "s"}` : "Resources block"
  }
  if (isPresentationBenefitsSection(content)) {
    const items = Array.isArray(content.items) ? content.items.length : 0
    return items > 0 ? `Benefits · ${items} item${items === 1 ? "" : "s"}` : "Benefits section"
  }
  if (typeof content.headline === "string" && content.headline.trim()) {
    return content.headline.trim().slice(0, 100)
  }
  if (typeof content.label === "string" && content.label.trim()) {
    return content.label.trim().slice(0, 100)
  }
  if (typeof content.body === "string" && content.body.trim()) {
    return content.body.trim().slice(0, 100)
  }
  if (content.videoPlayback && typeof content.videoPlayback === "object") {
    return "Video attached"
  }
  if (Array.isArray(content.items) && content.items.length > 0) {
    return `${content.items.length} item${content.items.length === 1 ? "" : "s"}`
  }
  return "Configure content in section editor"
}

export function getGrowthSendrBuilderSectionDisplayLabel(section: GrowthSendrLandingPageSection): string {
  const meta = getGrowthSendrBuilderSectionMeta(section.sectionType)
  const content = section.content
  const kind = typeof content.presentationKind === "string" ? content.presentationKind : null

  if (kind === "testimonials" || parsePresentationTestimonials(content).length > 0) return "Testimonials"
  if (kind === "resources" || kind === "downloads" || parsePresentationResources(content).length > 0) {
    return "Resources"
  }
  if (isPresentationBenefitsSection(content)) return "Benefits"
  return meta.label
}
