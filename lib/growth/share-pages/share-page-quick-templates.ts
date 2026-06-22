/** GS-SHARE-7B — Quick-start Share Page templates (client-safe). */

export type SharePageQuickTemplate = {
  id: string
  label: string
  description: string
  headline: string
  heroMessage: string
  whyReachingOut: string
  companyObservations: string[]
  ctaLabel: string
  footerNote?: string
}

export const GROWTH_SHARE_PAGE_QUICK_TEMPLATES: SharePageQuickTemplate[] = [
  {
    id: "equipment_service_demo",
    label: "Equipment Service Demo",
    description: "Demo outreach for commercial equipment service teams.",
    headline: "A personalized walkthrough for {{company.name}}",
    heroMessage:
      "Hi {{lead.first_name}} — I put together a short overview of how Equipify helps equipment service teams dispatch smarter and keep customers informed.",
    whyReachingOut: "Your team likely juggles dispatch, scheduling, and customer updates across multiple tools.",
    companyObservations: ["Dispatch & routing", "Scheduling & capacity", "Customer portal", "Equipment tracking"],
    ctaLabel: "Schedule Demo",
  },
  {
    id: "roofing_restoration",
    label: "Roofing & Restoration",
    description: "For roofing and restoration operators.",
    headline: "How {{company.name}} can streamline field operations",
    heroMessage:
      "Hi {{lead.first_name}} — here's a tailored look at how service businesses like yours coordinate crews, photos, and customer updates in one place.",
    whyReachingOut: "Restoration teams need fast coordination between estimators, crews, and homeowners.",
    companyObservations: ["Job documentation", "Crew coordination", "Customer updates", "Photo capture"],
    ctaLabel: "Book a walkthrough",
  },
  {
    id: "hvac_service_demo",
    label: "HVAC Service Demo",
    description: "HVAC install and service workflows.",
    headline: "Equipify for {{company.name}}",
    heroMessage:
      "Hi {{lead.first_name}} — this page summarizes how HVAC teams use Equipify for scheduling, dispatch, and customer communication.",
    whyReachingOut: "Seasonal demand makes capacity planning and technician routing especially important.",
    companyObservations: ["Technician routing", "Maintenance plans", "Customer notifications", "Job costing"],
    ctaLabel: "Schedule Demo",
  },
  {
    id: "general_field_service",
    label: "General Field Service Demo",
    description: "Default field service outreach page.",
    headline: "Personalized overview for {{company.name}}",
    heroMessage:
      "Hi {{lead.first_name}} — I recorded a quick overview of how Equipify helps field service teams run day-to-day operations.",
    whyReachingOut: "Most teams we talk to want fewer spreadsheets and clearer customer communication.",
    companyObservations: ["Dispatch", "Scheduling", "Invoicing handoff", "Customer portal"],
    ctaLabel: "Schedule a call",
  },
  {
    id: "proposal_follow_up",
    label: "Proposal Follow-Up",
    description: "Follow up after sending a proposal or quote.",
    headline: "Following up on your Equipify overview",
    heroMessage:
      "Hi {{lead.first_name}} — wanted to share a concise recap and answer any questions about the proposal we discussed.",
    whyReachingOut: "Happy to clarify pricing, rollout, or how your team would adopt the platform.",
    companyObservations: ["Implementation timeline", "Team training", "Integrations", "Support"],
    ctaLabel: "Book follow-up",
  },
  {
    id: "re_engagement",
    label: "Re-engagement",
    description: "Re-open a stalled conversation.",
    headline: "Checking back in with {{company.name}}",
    heroMessage:
      "Hi {{lead.first_name}} — sharing an updated overview in case timing is better now for a quick conversation.",
    whyReachingOut: "No pressure — this page is here whenever your team is ready to revisit operations software.",
    companyObservations: ["What's changed since we last spoke", "New product updates", "Customer stories"],
    ctaLabel: "Pick a time",
  },
  {
    id: "customer_portal_walkthrough",
    label: "Customer Portal Walkthrough",
    description: "Highlight customer-facing portal capabilities.",
    headline: "Customer portal walkthrough for {{company.name}}",
    heroMessage:
      "Hi {{lead.first_name}} — here's how your customers would experience scheduling, updates, and service history through Equipify.",
    whyReachingOut: "A modern portal reduces phone tag and improves customer satisfaction.",
    companyObservations: ["Self-service scheduling", "Job status updates", "Document sharing", "Branded experience"],
    ctaLabel: "See it live",
  },
  {
    id: "meeting_follow_up",
    label: "Meeting Follow-Up",
    description: "Recap after a discovery call or demo.",
    headline: "Recap from our conversation",
    heroMessage:
      "Hi {{lead.first_name}} — thanks for the time today. Here's a recap of what we covered and suggested next steps for {{company.name}}.",
    whyReachingOut: "Let me know if you'd like to involve additional stakeholders on a follow-up call.",
    companyObservations: ["Key takeaways", "Open questions", "Recommended next steps", "Resources"],
    ctaLabel: "Schedule next steps",
  },
]

export function getSharePageQuickTemplate(id: string): SharePageQuickTemplate | null {
  return GROWTH_SHARE_PAGE_QUICK_TEMPLATES.find((template) => template.id === id) ?? null
}
