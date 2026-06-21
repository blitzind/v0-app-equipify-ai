/** GS-SENDR-6C — Operator builder UX (client-safe). */

import type { GrowthSendrLandingPageSectionType } from "@/lib/growth/sendr/growth-sendr-config"

export const GROWTH_SENDR_BUILDER_UX_QA_MARKER = "growth-sendr-builder-ux-gs-sendr-6c-v1" as const

export type GrowthSendrBuilderPreviewDevice = "desktop" | "tablet" | "mobile"

export const GROWTH_SENDR_BUILDER_PREVIEW_SCALES = [0.5, 0.75, 1] as const

export type GrowthSendrBuilderPreviewScale = (typeof GROWTH_SENDR_BUILDER_PREVIEW_SCALES)[number]

export const GROWTH_SENDR_BUILDER_PREVIEW_DEVICE_WIDTHS: Record<GrowthSendrBuilderPreviewDevice, number | null> = {
  desktop: null,
  tablet: 768,
  mobile: 390,
}

export type GrowthSendrPageTemplateSection = {
  sectionType: GrowthSendrLandingPageSectionType
  content: Record<string, unknown>
}

export type GrowthSendrPageTemplate = {
  id: string
  label: string
  description: string
  industry?: string
  suggestedTitle: string
  sections: GrowthSendrPageTemplateSection[]
}

export const GROWTH_SENDR_PAGE_TEMPLATES: GrowthSendrPageTemplate[] = [
  {
    id: "equipment_service_demo",
    label: "Equipment Service Demo",
    description: "Standard demo for commercial equipment service teams.",
    industry: "equipment service",
    suggestedTitle: "{{company_name}} — Equipment Service Demo",
    sections: [
      {
        sectionType: "hero",
        content: {
          headline: "A personalized walkthrough for {{company_name}}",
          body: "Hi {{first_name}} — here is how Equipify helps equipment service teams dispatch smarter, schedule faster, and keep customers in the loop.",
          trustLine: "Trusted by service businesses nationwide.",
        },
      },
      {
        sectionType: "text",
        content: {
          presentationKind: "benefits",
          headline: "Why teams choose Equipify",
          items: [
            { title: "Dispatch & routing" },
            { title: "Scheduling & capacity" },
            { title: "Customer portal" },
            { title: "Equipment tracking" },
          ],
        },
      },
      {
        sectionType: "calendar",
        content: { label: "Schedule Demo", href: "{{meeting_link}}" },
      },
      {
        sectionType: "faq",
        content: {
          headline: "Questions",
          items: [
            {
              question: "How long is the demo?",
              answer: "About 30 minutes — tailored to your workflow with time for Q&A.",
            },
            {
              question: "Do I need to prepare anything?",
              answer: "Just bring your current process — we will map Equipify to your team.",
            },
          ],
        },
      },
    ],
  },
  {
    id: "roofing_restoration_demo",
    label: "Roofing / Restoration Demo",
    description: "For roofing and restoration contractors.",
    industry: "roofing",
    suggestedTitle: "{{company_name}} — Roofing Operations Walkthrough",
    sections: [
      {
        sectionType: "hero",
        content: {
          headline: "Built for teams like {{company_name}}",
          body: "See how leading roofing and restoration companies streamline estimates, crews, and customer updates in one place.",
        },
      },
      {
        sectionType: "text",
        content: {
          presentationKind: "benefits",
          headline: "What you will see",
          items: [
            { title: "Job scheduling & crew dispatch" },
            { title: "Photo documentation & approvals" },
            { title: "Customer communication portal" },
          ],
        },
      },
      { sectionType: "calendar", content: { label: "Book a walkthrough", href: "{{meeting_link}}" } },
    ],
  },
  {
    id: "hvac_service_demo",
    label: "HVAC Service Demo",
    description: "HVAC install, service, and maintenance workflows.",
    industry: "hvac",
    suggestedTitle: "{{company_name}} — HVAC Service Platform Tour",
    sections: [
      {
        sectionType: "hero",
        content: {
          headline: "{{first_name}}, a quick tour for {{company_name}}",
          body: "Watch a personalized walkthrough showing how HVAC teams reduce no-shows, track assets, and grow service revenue.",
        },
      },
      {
        sectionType: "text",
        content: {
          presentationKind: "benefits",
          headline: "Highlights for HVAC teams",
          items: [
            { title: "Maintenance plan automation" },
            { title: "Technician mobile workflows" },
            { title: "Parts & inventory visibility" },
          ],
        },
      },
      { sectionType: "cta", content: { label: "Schedule Demo", href: "{{meeting_link}}" } },
    ],
  },
  {
    id: "general_field_service",
    label: "General Field Service Demo",
    description: "Flexible template for any field service business.",
    suggestedTitle: "{{company_name}} — Field Service Walkthrough",
    sections: [
      {
        sectionType: "hero",
        content: {
          headline: "Your personalized Equipify walkthrough",
          body: "Hi {{first_name}} — press play when you are ready. When it resonates, book time with our team.",
        },
      },
      {
        sectionType: "text",
        content: {
          presentationKind: "resources",
          headline: "Resources",
          items: [
            { title: "Platform overview", description: "How Equipify fits field service operations." },
            { title: "Customer stories", description: "See how similar teams scale with Equipify." },
          ],
        },
      },
      { sectionType: "calendar", content: { label: "Schedule Demo", href: "{{meeting_link}}" } },
    ],
  },
  {
    id: "follow_up_after_call",
    label: "Follow-up After Call",
    description: "Short follow-up page after an initial conversation.",
    suggestedTitle: "Great speaking with you, {{first_name}}",
    sections: [
      {
        sectionType: "hero",
        content: {
          headline: "Thanks for your time, {{first_name}}",
          body: "As promised — here is the walkthrough we discussed for {{company_name}}. Book a deeper dive when you are ready.",
        },
      },
      { sectionType: "cta", content: { label: "Continue the conversation", href: "{{meeting_link}}" } },
    ],
  },
  {
    id: "re_engagement",
    label: "Re-engagement Page",
    description: "Win back stalled opportunities with a fresh angle.",
    suggestedTitle: "{{company_name}} — still interested?",
    sections: [
      {
        sectionType: "hero",
        content: {
          headline: "Still thinking it over, {{first_name}}?",
          body: "We put together a refreshed walkthrough for {{company_name}} — no pressure, just clarity on what Equipify could unlock.",
        },
      },
      {
        sectionType: "text",
        content: {
          presentationKind: "testimonials",
          headline: "What customers say",
          items: [
            {
              quote: "Equipify helped us cut dispatch chaos and respond to customers faster.",
              author: "Operations Director",
              company: "Regional service company",
            },
          ],
        },
      },
      { sectionType: "calendar", content: { label: "Pick a time", href: "{{meeting_link}}" } },
    ],
  },
]

export function getGrowthSendrPageTemplate(id: string): GrowthSendrPageTemplate | null {
  return GROWTH_SENDR_PAGE_TEMPLATES.find((t) => t.id === id) ?? null
}
