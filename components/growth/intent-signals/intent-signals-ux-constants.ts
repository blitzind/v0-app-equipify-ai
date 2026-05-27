/** Client-safe UX constants for Intent Signals dashboard (Layout v2). */

export const GROWTH_INTENT_SIGNALS_LAYOUT_V2_QA_MARKER = "growth-intent-signals-layout-v2" as const

export const GROWTH_INTENT_SIGNALS_NEWS_TAB_QA_MARKER = "growth-intent-signals-news-v1" as const

export const GROWTH_INTENT_SIGNALS_JOBS_TAB_QA_MARKER = "growth-intent-signals-jobs-v1" as const

export const GROWTH_INTENT_SIGNALS_HIRES_TAB_QA_MARKER = "growth-intent-signals-hires-v1" as const

export const GROWTH_INTENT_SIGNALS_WATCHLISTS_QA_MARKER = "growth-signal-watchlists-v1" as const

export const GROWTH_INTENT_SIGNALS_SETUP_DRAWER_QA_MARKER =
  "growth-intent-signals-setup-drawer-v1" as const

export const INTENT_SIGNAL_TAB_IDS = [
  "website-visitors",
  "job-changes",
  "promotions",
  "hires",
  "jobs",
  "news",
  "tech",
  "funds",
] as const

export type IntentSignalTabId = (typeof INTENT_SIGNAL_TAB_IDS)[number]

export type IntentSignalTableColumn = {
  key: string
  label: string
}

export type IntentSignalSampleRow = Record<string, string>

export type IntentSignalTabMeta = {
  id: IntentSignalTabId
  label: string
  implemented: boolean
  filters: readonly string[]
  columns: readonly IntentSignalTableColumn[]
  emptyState: {
    title: string
    description: string
    ctaLabel: string
  }
  sampleMetrics: {
    total: number
    h24: number
    d7: number
    d30: number
  }
  sampleRows: readonly IntentSignalSampleRow[]
}

export const INTENT_SIGNAL_PREVIEW_BANNER =
  "Preview: You're looking at sample signal data. Triggers and real-time tracking are coming soon."

export const INTENT_SIGNAL_TABS: readonly IntentSignalTabMeta[] = [
  {
    id: "website-visitors",
    label: "Website Visitors",
    implemented: true,
    filters: ["Company", "People", "Company size", "Industry", "Location", "More filters"],
    columns: [
      { key: "person", label: "Person/Company" },
      { key: "company", label: "Company" },
      { key: "jobTitle", label: "Job title" },
      { key: "country", label: "Country" },
      { key: "intent", label: "Intent" },
      { key: "date", label: "Date" },
    ],
    emptyState: {
      title: "See who visits your website",
      description:
        "Resolve anonymous traffic to companies and contacts. Filter by page, time on site, or visit frequency and route high-intent visitors to your team.",
      ctaLabel: "Install the tracker",
    },
    sampleMetrics: { total: 1247, h24: 144, d7: 1200, d30: 8400 },
    sampleRows: [
      {
        person: "Sample visitor A",
        company: "Sample Co",
        jobTitle: "—",
        country: "US",
        intent: "High",
        date: "3 min ago",
      },
      {
        person: "Sample visitor B",
        company: "Example Inc",
        jobTitle: "—",
        country: "US",
        intent: "Medium",
        date: "12 min ago",
      },
      {
        person: "Sample visitor C",
        company: "Demo Corp",
        jobTitle: "—",
        country: "CA",
        intent: "Low",
        date: "28 min ago",
      },
    ],
  },
  {
    id: "job-changes",
    label: "Job Changes",
    implemented: false,
    filters: ["Job Title", "Seniority", "Company", "Industry", "More filters"],
    columns: [
      { key: "person", label: "Person" },
      { key: "newRole", label: "New role" },
      { key: "newCompany", label: "New company" },
      { key: "country", label: "Country" },
      { key: "previousRole", label: "Previous role" },
      { key: "date", label: "Date" },
    ],
    emptyState: {
      title: "Catch job changes as they happen",
      description:
        "Get notified when decision-makers move roles so you can reach out at the right moment.",
      ctaLabel: "Track job changes",
    },
    sampleMetrics: { total: 892, h24: 38, d7: 412, d30: 2890 },
    sampleRows: [
      {
        person: "Sample Contact A",
        newRole: "VP Operations",
        newCompany: "Sample Industries",
        country: "US",
        previousRole: "Director of Ops",
        date: "1 hr ago",
      },
      {
        person: "Sample Contact B",
        newRole: "Head of Service",
        newCompany: "Example Services",
        country: "US",
        previousRole: "Service Manager",
        date: "3 hr ago",
      },
    ],
  },
  {
    id: "promotions",
    label: "Promotions",
    implemented: false,
    filters: ["Job Title", "Seniority", "Company", "Industry", "More filters"],
    columns: [
      { key: "person", label: "Person" },
      { key: "newTitle", label: "New title" },
      { key: "company", label: "Company" },
      { key: "country", label: "Country" },
      { key: "previousTitle", label: "Previous title" },
      { key: "date", label: "Date" },
    ],
    emptyState: {
      title: "Know when contacts get promoted",
      description: "Spot internal promotions at target accounts and adjust your outreach timing.",
      ctaLabel: "Track promotions",
    },
    sampleMetrics: { total: 534, h24: 22, d7: 198, d30: 1420 },
    sampleRows: [
      {
        person: "Sample Contact C",
        newTitle: "Senior Director",
        company: "Sample Co",
        country: "US",
        previousTitle: "Director",
        date: "2 hr ago",
      },
    ],
  },
  {
    id: "hires",
    label: "Hires",
    implemented: true,
    filters: ["Company", "Department", "Hiring intensity", "Geography", "More filters"],
    columns: [
      { key: "company", label: "Company" },
      { key: "activeHiring", label: "Active Hiring" },
      { key: "departments", label: "Departments" },
      { key: "velocity", label: "Velocity" },
      { key: "spike", label: "Hiring Spike" },
      { key: "geography", label: "Geography" },
      { key: "score", label: "Signal Score" },
      { key: "date", label: "Date" },
      { key: "actions", label: "Actions" },
    ],
    emptyState: {
      title: "No aggregate hiring signals yet",
      description:
        "Hiring activity signals are derived from ingested job postings and will appear here after job data is processed.",
      ctaLabel: "Add hiring signal",
    },
    sampleMetrics: { total: 0, h24: 0, d7: 0, d30: 0 },
    sampleRows: [],
  },
  {
    id: "jobs",
    label: "Jobs",
    implemented: true,
    filters: ["Company", "Department", "Location", "Employment type", "More filters"],
    columns: [
      { key: "company", label: "Company" },
      { key: "role", label: "Role" },
      { key: "department", label: "Department" },
      { key: "location", label: "Location" },
      { key: "employmentType", label: "Employment Type" },
      { key: "intensity", label: "Hiring Intensity" },
      { key: "score", label: "Signal Score" },
      { key: "date", label: "Date" },
      { key: "actions", label: "Actions" },
    ],
    emptyState: {
      title: "No hiring signals yet",
      description: "Job posting signals will appear here after hiring activity is ingested.",
      ctaLabel: "Add hiring signal",
    },
    sampleMetrics: { total: 0, h24: 0, d7: 0, d30: 0 },
    sampleRows: [],
  },
  {
    id: "news",
    label: "News",
    implemented: true,
    filters: ["Company", "Industry", "News Category", "Company size", "More filters"],
    columns: [
      { key: "company", label: "Company" },
      { key: "headline", label: "Headline" },
      { key: "source", label: "Source" },
      { key: "geography", label: "Country/Region" },
      { key: "category", label: "Category" },
      { key: "score", label: "Signal score" },
      { key: "date", label: "Date" },
      { key: "actions", label: "Actions" },
    ],
    emptyState: {
      title: "No news signals yet",
      description: "News signals will appear here after public company news is ingested.",
      ctaLabel: "Add news signal",
    },
    sampleMetrics: { total: 0, h24: 0, d7: 0, d30: 0 },
    sampleRows: [],
  },
  {
    id: "tech",
    label: "Tech",
    implemented: false,
    filters: ["Company", "Technology", "Industry", "Company size", "More filters"],
    columns: [
      { key: "company", label: "Company" },
      { key: "technology", label: "Technology" },
      { key: "changeType", label: "Change type" },
      { key: "country", label: "Country" },
      { key: "method", label: "Method" },
      { key: "date", label: "Date" },
    ],
    emptyState: {
      title: "Detect technology installs and removals",
      description: "Know when target accounts adopt or drop tools relevant to your ICP.",
      ctaLabel: "Track tech changes",
    },
    sampleMetrics: { total: 445, h24: 18, d7: 132, d30: 980 },
    sampleRows: [
      {
        company: "Sample Co",
        technology: "Sample CRM",
        changeType: "Added",
        country: "US",
        method: "DNS",
        date: "1 day ago",
      },
    ],
  },
  {
    id: "funds",
    label: "Funds",
    implemented: false,
    filters: ["Company", "Funding Stage", "Industry", "Company size", "More filters"],
    columns: [
      { key: "company", label: "Company" },
      { key: "stage", label: "Stage" },
      { key: "amount", label: "Amount" },
      { key: "country", label: "Country" },
      { key: "leadInvestor", label: "Lead investor" },
      { key: "date", label: "Date" },
    ],
    emptyState: {
      title: "Track funding rounds",
      description: "Catch Series A–D and growth rounds at companies in your target market.",
      ctaLabel: "Track funding",
    },
    sampleMetrics: { total: 312, h24: 9, d7: 67, d30: 540 },
    sampleRows: [
      {
        company: "Example Inc",
        stage: "Series B",
        amount: "$24M",
        country: "US",
        leadInvestor: "Sample Ventures",
        date: "2 days ago",
      },
    ],
  },
] as const

export function getIntentSignalTabMeta(tabId: IntentSignalTabId): IntentSignalTabMeta {
  const tab = INTENT_SIGNAL_TABS.find((t) => t.id === tabId)
  if (!tab) return INTENT_SIGNAL_TABS[0]!
  return tab
}

export function formatIntentSignalCount(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—"
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`
  return String(value)
}
