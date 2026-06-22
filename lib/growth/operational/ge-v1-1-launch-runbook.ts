/** GE-v1-1 — "How to Launch an Equipify Campaign" operator runbook (client-safe). */

export const GE_V1_1_LAUNCH_RUNBOOK_QA_MARKER = "ge-v1-1-launch-runbook-v1" as const

export type GeV11LaunchRunbookStep = {
  order: number
  title: string
  detail: string
  href: string
  hrefLabel: string
}

export const GE_V1_1_LAUNCH_RUNBOOK_STEPS: GeV11LaunchRunbookStep[] = [
  {
    order: 1,
    title: "Run prospect search",
    detail: "Discover medical equipment service companies. Use filters for industry, keywords, and verified contact data.",
    href: "/growth/leads/prospect-search/discover",
    hrefLabel: "Prospect Search",
  },
  {
    order: 2,
    title: "Save search",
    detail: "Save the search with the ICP naming convention (ICP · Medical · …) so the audience can refresh from the same criteria.",
    href: "/growth/leads/prospect-search",
    hrefLabel: "Saved searches",
  },
  {
    order: 3,
    title: "Create audience",
    detail: "Create an audience from the saved search. Audiences live under Growth → Audiences.",
    href: "/growth/audiences",
    hrefLabel: "Audiences",
  },
  {
    order: 4,
    title: "Refresh snapshot",
    detail: "Run a manual snapshot refresh so member counts and enrollment preview reflect current search results.",
    href: "/growth/audiences",
    hrefLabel: "Refresh snapshot",
  },
  {
    order: 5,
    title: "Create personalized page",
    detail: "Use the Equipify Demo template or duplicate an existing published page. Attach variables for company and contact.",
    href: "/growth/videos/personalized/new",
    hrefLabel: "New personalized page",
  },
  {
    order: 6,
    title: "Attach video",
    detail: "Upload or select a demo video asset. Placeholder video is OK for v1 — replace when the canonical recording is ready.",
    href: "/growth/videos/library",
    hrefLabel: "Media library",
  },
  {
    order: 7,
    title: "Launch campaign",
    detail: "Run the launch wizard: audience → sequence → sender identity → page → preview → enroll. Nothing sends automatically.",
    href: "/growth/videos/personalized/launch",
    hrefLabel: "Launch wizard",
  },
  {
    order: 8,
    title: "Approve sends",
    detail: "Review pending_approval jobs on Sequence Execution. Approve AI drafts, then approve transport for each job.",
    href: "/growth/campaigns/sequences",
    hrefLabel: "Pending approvals",
  },
  {
    order: 9,
    title: "Monitor engagement",
    detail: "Track page views, video progress, and CTA clicks on the Engagement dashboard.",
    href: "/growth/engagement",
    hrefLabel: "Engagement",
  },
  {
    order: 10,
    title: "Book demos",
    detail: "When prospects book via equipify-demo, confirm calendar events and log meetings on the lead timeline.",
    href: "/growth/meetings",
    hrefLabel: "Meetings",
  },
]
