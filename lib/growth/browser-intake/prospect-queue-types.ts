/** Browser extension prospect queue — client-safe. */

export const GROWTH_BROWSER_INTAKE_PROSPECT_QUEUE_QA_MARKER =
  "growth-browser-intake-prospect-queue-v1" as const

export const GROWTH_BROWSER_INTAKE_PROSPECT_QUEUE_ACTIONS = [
  "process_queue",
  "run_contact_discovery",
  "verify_emails",
  "create_leads",
] as const

export type GrowthBrowserIntakeProspectQueueAction =
  (typeof GROWTH_BROWSER_INTAKE_PROSPECT_QUEUE_ACTIONS)[number]

export const GROWTH_BROWSER_INTAKE_PROSPECT_QUEUE_ITEM_KINDS = [
  "company",
  "contact",
  "linkedin_page",
] as const

export type GrowthBrowserIntakeProspectQueueItemKind =
  (typeof GROWTH_BROWSER_INTAKE_PROSPECT_QUEUE_ITEM_KINDS)[number]

export type GrowthBrowserIntakeProspectQueueItem = {
  queue_item_id: string
  kind: GrowthBrowserIntakeProspectQueueItemKind
  company_name: string
  contact_name?: string | null
  title?: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
  linkedin_url?: string | null
  source_url?: string | null
  source_platform?: string | null
  page_title?: string | null
  notes?: string | null
  lead_id?: string | null
  queued_at: string
}

export type GrowthBrowserIntakeProspectQueueItemResult = {
  queue_item_id: string
  ok: boolean
  action: GrowthBrowserIntakeProspectQueueAction
  lead_id: string | null
  message: string
  email_status?: string | null
  contact_discovery_queued?: boolean
}

export type GrowthBrowserIntakeProspectQueueProcessResult = {
  action: GrowthBrowserIntakeProspectQueueAction
  processed_count: number
  success_count: number
  results: GrowthBrowserIntakeProspectQueueItemResult[]
}

export function inferBrowserIntakeProspectQueueItemKind(input: {
  linkedin_url?: string | null
  contact_name?: string | null
  email?: string | null
  phone?: string | null
}): GrowthBrowserIntakeProspectQueueItemKind {
  const linkedin = (input.linkedin_url ?? "").trim()
  const hasContact = Boolean(
    (input.contact_name ?? "").trim() ||
      (input.email ?? "").trim() ||
      (input.phone ?? "").trim(),
  )
  if (linkedin && !hasContact) return "linkedin_page"
  if (hasContact) return "contact"
  return "company"
}
