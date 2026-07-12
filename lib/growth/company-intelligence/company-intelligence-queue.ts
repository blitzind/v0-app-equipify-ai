import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { runCompanyIntelligenceForCanonicalCompany } from "@/lib/growth/company-intelligence/company-intelligence-orchestrator"
import { companyHasVerifiedIntelligenceSnapshots } from "@/lib/growth/company-intelligence/company-intelligence-snapshot-integrity"
import { recoverStaleCompanyIntelligenceRunningJobs } from "@/lib/growth/company-intelligence/company-intelligence-stale-jobs"
import { triggerBuyingCommitteeIntelligenceAfterCompanyIntelligence } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-triggers"
import type {
  GrowthCompanyIntelligenceJobTrigger,
  GrowthCompanyIntelligenceJobStatus,
} from "@/lib/growth/company-intelligence/company-intelligence-runtime-types"

export const GROWTH_COMPANY_INTELLIGENCE_MAX_JOBS_PER_CRON = 2 as const

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export type EnqueueCompanyIntelligenceJobInput = {
  company_id: string
  trigger_source: GrowthCompanyIntelligenceJobTrigger
  created_by?: string | null
  promote_on_complete?: boolean
  scheduled_for?: string
  skip_if_verified?: boolean
  skip_if_active_job?: boolean
}

export type EnqueueCompanyIntelligenceJobResult =
  | { ok: true; enqueued: true; job_id: string }
  | { ok: true; enqueued: false; reason: string; job_id?: string | null }
  | { ok: false; reason: string }

export async function findActiveCompanyIntelligenceJob(
  admin: SupabaseClient,
  company_id: string,
): Promise<{ id: string; status: GrowthCompanyIntelligenceJobStatus } | null> {
  const { data } = await admin
    .schema("growth")
    .from("company_intelligence_jobs")
    .select("id, status")
    .eq("company_id", company_id)
    .in("status", ["pending", "running"])
    .maybeSingle()

  if (!data?.id) return null
  return { id: asString(data.id), status: data.status as GrowthCompanyIntelligenceJobStatus }
}

export async function enqueueCompanyIntelligenceJob(
  admin: SupabaseClient,
  input: EnqueueCompanyIntelligenceJobInput,
): Promise<EnqueueCompanyIntelligenceJobResult> {
  const company_id = asString(input.company_id)
  if (!company_id) {
    return { ok: false, reason: "company_id is required." }
  }

  const { data: company } = await admin
    .schema("growth")
    .from("companies")
    .select("id, status")
    .eq("id", company_id)
    .maybeSingle()

  if (!company || company.status !== "active") {
    return { ok: false, reason: "Active canonical company required." }
  }

  if (input.skip_if_verified !== false) {
    if (await companyHasVerifiedIntelligenceSnapshots(admin, company_id)) {
      return { ok: true, enqueued: false, reason: "verified_intelligence_exists" }
    }
  }

  if (input.skip_if_active_job !== false) {
    const active = await findActiveCompanyIntelligenceJob(admin, company_id)
    if (active) {
      return { ok: true, enqueued: false, reason: "active_job_exists", job_id: active.id }
    }
  }

  const scheduled_for = input.scheduled_for ?? new Date().toISOString()
  const { data, error } = await admin
    .schema("growth")
    .from("company_intelligence_jobs")
    .insert({
      company_id,
      created_by: input.created_by ?? null,
      status: "pending",
      trigger_source: input.trigger_source,
      scheduled_for,
      promote_on_complete: input.promote_on_complete ?? false,
      metadata: {},
    })
    .select("id")
    .single()

  if (error) {
    if (error.code === "23505") {
      const active = await findActiveCompanyIntelligenceJob(admin, company_id)
      return {
        ok: true,
        enqueued: false,
        reason: "active_job_exists",
        job_id: active?.id ?? null,
      }
    }
    return { ok: false, reason: error.message }
  }

  const job_id = asString(data?.id)
  logGrowthEngine("company_intelligence_job_enqueued", {
    job_id,
    company_id,
    trigger_source: input.trigger_source,
    promote_on_complete: input.promote_on_complete ?? false,
    created_by: input.created_by ?? null,
  })

  return { ok: true, enqueued: true, job_id }
}

export async function processCompanyIntelligenceJobQueue(
  admin: SupabaseClient,
  limit = GROWTH_COMPANY_INTELLIGENCE_MAX_JOBS_PER_CRON,
): Promise<{ processed: number; failed: number; skipped: number; stale_recovered: number }> {
  const { recovered: stale_recovered } = await recoverStaleCompanyIntelligenceRunningJobs(admin)

  const { data: jobs } = await admin
    .schema("growth")
    .from("company_intelligence_jobs")
    .select("id, company_id, promote_on_complete, attempts")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(limit)

  let processed = 0
  let failed = 0
  let skipped = 0

  for (const job of jobs ?? []) {
    const job_id = asString(job.id)
    const company_id = asString(job.company_id)
    if (!job_id || !company_id) {
      skipped += 1
      continue
    }

    const { error: runErr } = await admin
      .schema("growth")
      .from("company_intelligence_jobs")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
        attempts: (job.attempts ?? 0) + 1,
      })
      .eq("id", job_id)
      .eq("status", "pending")

    if (runErr) {
      skipped += 1
      continue
    }

    try {
      const result = await runCompanyIntelligenceForCanonicalCompany(admin, {
        company_id,
        promote: Boolean(job.promote_on_complete),
      })

      await admin
        .schema("growth")
        .from("company_intelligence_jobs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          run_id: result.run_id,
          last_error: null,
        })
        .eq("id", job_id)

      logGrowthEngine("company_intelligence_job_completed", {
        job_id,
        run_id: result.run_id,
        company_id,
        finding_count: result.finding_count,
        verified_count: result.verified_count,
        promoted_count: result.promoted_count,
      })

      // GE-AIOS-AUTONOMY-1B — CI completion → AI OS Event Bus → Draft Factory
      try {
        const { data: contactRows } = await admin
          .schema("growth")
          .from("company_contacts")
          .select("growth_lead_id")
          .eq("company_id", company_id)
          .not("growth_lead_id", "is", null)
          .limit(10)
        const leadIds = [
          ...new Set(
            (contactRows ?? [])
              .map((row) => asString((row as Record<string, unknown>).growth_lead_id))
              .filter(Boolean),
          ),
        ]
        if (leadIds.length > 0) {
          const { getGrowthEngineAiOrgId } = await import("@/lib/growth/access")
          const organizationId = getGrowthEngineAiOrgId()
          if (organizationId) {
            const { publishDraftFactoryCompanyIntelligenceCompleted } = await import(
              "@/lib/growth/draft-factory/draft-factory-wake-emitters"
            )
            void publishDraftFactoryCompanyIntelligenceCompleted(admin, {
              organizationId,
              companyId: company_id,
              runId: result.run_id,
              leadIds,
              jobId: job_id,
            })
          }
        }
      } catch {
        // Completion wake must not block CI job completion.
      }

      await triggerBuyingCommitteeIntelligenceAfterCompanyIntelligence(admin, { company_id })

      processed += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : "Company intelligence failed."
      await admin
        .schema("growth")
        .from("company_intelligence_jobs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          last_error: message.slice(0, 500),
        })
        .eq("id", job_id)

      logGrowthEngine("company_intelligence_job_failed", {
        job_id,
        company_id,
        message: message.slice(0, 500),
      })

      failed += 1
    }
  }

  return { processed, failed, skipped, stale_recovered }
}
