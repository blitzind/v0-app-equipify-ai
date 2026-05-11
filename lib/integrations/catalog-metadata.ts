/**
 * Phase 61.3 — Single source for integration catalog readiness labels and marketing entries.
 * UI maps these to existing design-system badges (`ds-badge-*`); do not fork parallel badge systems.
 */

export type IntegrationCatalogReadiness =
  | "live"
  | "beta"
  | "limited"
  | "planned"
  | "coming_soon"
  | "internal"
  | "enterprise"

/** Badge label + Tailwind classes (matches patterns in dashboard integration cards). */
export const INTEGRATION_READINESS_BADGE: Record<
  IntegrationCatalogReadiness,
  { label: string; className: string }
> = {
  live: { label: "Live", className: "ds-badge-success border" },
  beta: { label: "Beta", className: "ds-badge-info border" },
  limited: { label: "Limited", className: "ds-badge-info border" },
  planned: { label: "Planned", className: "ds-badge-warning border" },
  coming_soon: { label: "Coming Soon", className: "ds-badge-warning border" },
  internal: { label: "Internal", className: "border border-border text-muted-foreground" },
  enterprise: { label: "Enterprise", className: "ds-badge-info border" },
}

export type MarketingCatalogCta =
  | { kind: "link"; href: string; label: string }
  | { kind: "external"; href: string; label: string }
  | { kind: "interest_modal" }

export interface MarketingCatalogEntry {
  id: string
  name: string
  description: string
  category: string
  logoLetter: string
  logoColor: string
  readiness: IntegrationCatalogReadiness
  cta: MarketingCatalogCta
  featured?: boolean
  featuredDescription?: string
}

/**
 * Product Integrations page (`/integrations`) — informational catalog aligned with backend reality.
 * QuickBooks: live OAuth + sync. Stripe: billing/Checkout only (no tenant “Stripe Connect” card).
 * Fuzor: external partner (no Equipify OAuth).
 */
export const MARKETING_INTEGRATION_CATALOG: MarketingCatalogEntry[] = [
  {
    id: "quickbooks",
    name: "QuickBooks Online",
    description:
      "OAuth connection, customer/catalog sync, invoice export, and optional invoice auto-sync — configure under Settings → Integrations.",
    category: "Core Business",
    logoLetter: "Q",
    logoColor: "#2ca01c",
    readiness: "live",
    cta: { kind: "link", href: "/settings/integrations/quickbooks", label: "Open in Settings" },
  },
  {
    id: "stripe",
    name: "Stripe (billing)",
    description:
      "Subscription plans and Checkout are live under Billing. This is platform billing — not a generic “connect your Stripe account” integration.",
    category: "Core Business",
    logoLetter: "S",
    logoColor: "#635bff",
    readiness: "limited",
    cta: { kind: "link", href: "/settings/billing", label: "Open billing" },
  },
  {
    id: "fuzor",
    name: "Fuzor",
    description:
      "CRM-style automation partner. Link opens Fuzor’s site — there is no OAuth connector inside Equipify for Fuzor yet.",
    category: "Core Business",
    logoLetter: "F",
    logoColor: "#0f7ae5",
    readiness: "beta",
    cta: { kind: "external", href: "https://fuzor.io", label: "Visit Fuzor" },
    featured: true,
    featuredDescription:
      "Partner CRM and automation workflows. Use Fuzor alongside Equipify; connector work inside Equipify is not implied by this link.",
  },
  {
    id: "xero",
    name: "Xero",
    description: "Cloud accounting — not implemented; no OAuth or sync in Equipify today.",
    category: "Core Business",
    logoLetter: "X",
    logoColor: "#13b5ea",
    readiness: "planned",
    cta: { kind: "interest_modal" },
  },
  {
    id: "twilio",
    name: "Twilio",
    description: "SMS reminders and messaging — planned; no Twilio tenant connection in app code today.",
    category: "Communication",
    logoLetter: "T",
    logoColor: "#f22f46",
    readiness: "planned",
    cta: { kind: "interest_modal" },
  },
  {
    id: "gmail",
    name: "Gmail",
    description:
      "Future: optional staff mailbox workflows. Customer invoices, quotes, and system email use Resend — Gmail does not replace that path unless explicitly scoped later.",
    category: "Communication",
    logoLetter: "G",
    logoColor: "#ea4335",
    readiness: "planned",
    cta: { kind: "interest_modal" },
  },
  {
    id: "microsoft365",
    name: "Microsoft 365",
    description: "Email and Outlook workflow sync — planned; not connected in Equipify today.",
    category: "Communication",
    logoLetter: "M",
    logoColor: "#d83b01",
    readiness: "planned",
    cta: { kind: "interest_modal" },
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Technician schedule sync — planned; no Google Calendar OAuth in app today.",
    category: "Scheduling",
    logoLetter: "G",
    logoColor: "#4285f4",
    readiness: "planned",
    cta: { kind: "interest_modal" },
  },
  {
    id: "outlook-calendar",
    name: "Outlook Calendar",
    description: "Calendar sync for Microsoft environments — planned.",
    category: "Scheduling",
    logoLetter: "O",
    logoColor: "#0078d4",
    readiness: "planned",
    cta: { kind: "interest_modal" },
  },
  {
    id: "zapier",
    name: "Zapier",
    description: "No-code app connections — planned; no Zapier app or OAuth for tenants today.",
    category: "Automation",
    logoLetter: "Z",
    logoColor: "#ff4a00",
    readiness: "planned",
    cta: { kind: "interest_modal" },
  },
  {
    id: "make",
    name: "Make",
    description: "Visual automation — planned.",
    category: "Automation",
    logoLetter: "M",
    logoColor: "#7d2ae8",
    readiness: "planned",
    cta: { kind: "interest_modal" },
  },
  {
    id: "n8n",
    name: "n8n",
    description: "Self-hosted automation — planned.",
    category: "Automation",
    logoLetter: "n",
    logoColor: "#ea4b71",
    readiness: "planned",
    cta: { kind: "interest_modal" },
  },
  {
    id: "docusign",
    name: "DocuSign",
    description: "E-signatures on quotes and contracts — planned.",
    category: "Documents & Approvals",
    logoLetter: "D",
    logoColor: "#ffbe00",
    readiness: "planned",
    cta: { kind: "interest_modal" },
  },
  {
    id: "pandadoc",
    name: "PandaDoc",
    description: "Quotes and approvals — planned.",
    category: "Documents & Approvals",
    logoLetter: "P",
    logoColor: "#3ab74d",
    readiness: "planned",
    cta: { kind: "interest_modal" },
  },
  {
    id: "google-maps",
    name: "Google Maps",
    description: "Routing and job locations — map display may use platform keys; tenant Maps “integration” is not a connectable connector today.",
    category: "Maps & Routing",
    logoLetter: "G",
    logoColor: "#34a853",
    readiness: "planned",
    cta: { kind: "interest_modal" },
  },
]

export const MARKETING_INTEGRATION_CATEGORIES = [
  "Core Business",
  "Communication",
  "Scheduling",
  "Automation",
  "Documents & Approvals",
  "Maps & Routing",
] as const

export function countMarketingCatalogByReadiness(
  readiness: IntegrationCatalogReadiness,
): number {
  return MARKETING_INTEGRATION_CATALOG.filter((e) => e.readiness === readiness).length
}

/** Settings hub (`/settings/integrations`) row metadata — keep in sync with inventory doc. */
export type SettingsHubIntegrationId =
  | "quickbooks"
  | "stripe"
  | "gmail"
  | "google-calendar"
  | "slack"
  | "twilio"
  | "salesforce"
  | "zapier"
  | "docusign"

export const SETTINGS_HUB_INTEGRATION_READINESS: Record<
  SettingsHubIntegrationId,
  IntegrationCatalogReadiness
> = {
  quickbooks: "live",
  stripe: "limited",
  gmail: "planned",
  "google-calendar": "planned",
  slack: "planned",
  twilio: "planned",
  salesforce: "planned",
  zapier: "planned",
  docusign: "planned",
}
