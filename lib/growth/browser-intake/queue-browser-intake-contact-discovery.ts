import "server-only"

import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { runContactDiscoveryForCompany } from "@/lib/growth/contact-discovery/contact-repository"
import { normalizeWebsiteDomain } from "@/lib/growth/import/normalize"
import { fetchGrowthLeadById, updateGrowthLeadFromImportMerge } from "@/lib/growth/lead-repository"
import type { GrowthLead } from "@/lib/growth/types"

export const GROWTH_BROWSER_INTAKE_CONTACT_DISCOVERY_QUEUE_QA_MARKER =
  "growth-browser-intake-contact-discovery-queue-v1" as const

export type BrowserIntakeContactDiscoveryQueueState = {
  status: "queued" | "running" | "completed" | "failed"
  requested_at: string
  capture_method: "chrome_extension"
  company_candidate_id: string | null
  completed_at?: string | null
  error_message?: string | null
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

async function ensureBrowserIntakeDiscoveryRun(
  admin: SupabaseClient,
  createdBy: string | null,
): Promise<string> {
  const { data: existing } = await admin
    .schema("growth")
    .from("real_world_discovery_runs")
    .select("id")
    .contains("metadata", { browser_intake_queue: true })
    .limit(1)
    .maybeSingle()

  if (existing?.id) return asString(existing.id)

  const { data, error } = await admin
    .schema("growth")
    .from("real_world_discovery_runs")
    .insert({
      query: "browser_intake_contact_discovery_queue",
      provider_names: ["browser_intake"],
      status: "completed",
      metadata: { browser_intake_queue: true },
      created_by: createdBy,
    })
    .select("id")
    .single()

  if (error || !data?.id) {
    throw new Error(error?.message ?? "browser_intake_discovery_run_create_failed")
  }

  return asString(data.id)
}

async function ensureCompanyCandidateForLead(
  admin: SupabaseClient,
  lead: GrowthLead,
  runId: string,
): Promise<string> {
  const metadata = lead.metadata ?? {}
  const existingId = asString((metadata.contact_discovery_queue as Record<string, unknown> | undefined)?.company_candidate_id)
  if (existingId) return existingId

  const dedupeHash = createHash("sha256").update(`browser_intake:${lead.id}`).digest("hex")
  const { data: existingCandidate } = await admin
    .schema("growth")
    .from("real_world_company_candidates")
    .select("id")
    .eq("dedupe_hash", dedupeHash)
    .maybeSingle()

  if (existingCandidate?.id) return asString(existingCandidate.id)

  const domain = normalizeWebsiteDomain(lead.website)
  const { data, error } = await admin
    .schema("growth")
    .from("real_world_company_candidates")
    .insert({
      run_id: runId,
      query: "browser_intake",
      provider_name: "browser_intake",
      provider_type: "manual_import",
      company_name: lead.companyName,
      website: lead.website,
      domain,
      dedupe_hash: dedupeHash,
      confidence: 0.7,
      metadata: {
        matched_growth_lead_id: lead.id,
        source: "browser_intake",
      },
    })
    .select("id")
    .single()

  if (error || !data?.id) {
    throw new Error(error?.message ?? "browser_intake_company_candidate_create_failed")
  }

  return asString(data.id)
}

async function patchLeadContactDiscoveryQueue(
  admin: SupabaseClient,
  leadId: string,
  queue: BrowserIntakeContactDiscoveryQueueState,
): Promise<void> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) return

  const metadata = lead.metadata ?? {}
  await updateGrowthLeadFromImportMerge(admin, leadId, {
    metadata: {
      ...metadata,
      contact_discovery_queue: queue,
    },
  })
}

export async function markBrowserIntakeContactDiscoveryQueued(
  admin: SupabaseClient,
  leadId: string,
  companyCandidateId: string | null,
): Promise<BrowserIntakeContactDiscoveryQueueState> {
  const queue: BrowserIntakeContactDiscoveryQueueState = {
    status: "queued",
    requested_at: new Date().toISOString(),
    capture_method: "chrome_extension",
    company_candidate_id: companyCandidateId,
  }
  await patchLeadContactDiscoveryQueue(admin, leadId, queue)
  return queue
}

export function scheduleBrowserIntakeContactDiscovery(
  admin: SupabaseClient,
  input: {
    leadId: string
    createdBy?: string | null
    companyCandidateId: string
  },
): void {
  void (async () => {
    try {
      await patchLeadContactDiscoveryQueue(admin, input.leadId, {
        status: "running",
        requested_at: new Date().toISOString(),
        capture_method: "chrome_extension",
        company_candidate_id: input.companyCandidateId,
      })

      await runContactDiscoveryForCompany(admin, {
        company_candidate_id: input.companyCandidateId,
        created_by: input.createdBy ?? null,
      })

      await patchLeadContactDiscoveryQueue(admin, input.leadId, {
        status: "completed",
        requested_at: new Date().toISOString(),
        capture_method: "chrome_extension",
        company_candidate_id: input.companyCandidateId,
        completed_at: new Date().toISOString(),
      })

      logGrowthEngine("browser_intake_contact_discovery_completed", {
        leadId: input.leadId,
        companyCandidateId: input.companyCandidateId,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "contact_discovery_failed"
      await patchLeadContactDiscoveryQueue(admin, input.leadId, {
        status: "failed",
        requested_at: new Date().toISOString(),
        capture_method: "chrome_extension",
        company_candidate_id: input.companyCandidateId,
        error_message: message,
      })
      logGrowthEngine("browser_intake_contact_discovery_failed", {
        leadId: input.leadId,
        companyCandidateId: input.companyCandidateId,
        message,
      })
    }
  })()
}

export async function queueBrowserIntakeContactDiscovery(
  admin: SupabaseClient,
  input: {
    leadId: string
    createdBy?: string | null
  },
): Promise<{ queued: true; company_candidate_id: string }> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) {
    throw new Error("lead_not_found")
  }

  const runId = await ensureBrowserIntakeDiscoveryRun(admin, input.createdBy ?? null)
  const companyCandidateId = await ensureCompanyCandidateForLead(admin, lead, runId)
  await markBrowserIntakeContactDiscoveryQueued(admin, lead.id, companyCandidateId)
  scheduleBrowserIntakeContactDiscovery(admin, {
    leadId: lead.id,
    createdBy: input.createdBy ?? null,
    companyCandidateId,
  })

  logGrowthEngine("browser_intake_contact_discovery_queued", {
    leadId: lead.id,
    companyCandidateId,
  })

  return { queued: true, company_candidate_id: companyCandidateId }
}
