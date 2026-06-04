import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { runBuyingCommitteeIntelligenceForCanonicalCompany } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-orchestrator"
import { buyingCommitteeHasVerifiedIntelligenceMembers } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-committee-integrity"
import { recoverStaleBuyingCommitteeIntelligenceRunningJobs } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-stale-jobs"
import type {
  GrowthBuyingCommitteeIntelligenceJobTrigger,
  GrowthBuyingCommitteeIntelligenceJobStatus,
} from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-runtime-types"

export const GROWTH_BUYING_COMMITTEE_INTELLIGENCE_MAX_JOBS_PER_CRON = 2 as const

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export type EnqueueBuyingCommitteeIntelligenceJobInput = {
  company_id: string
  trigger_source: GrowthBuyingCommitteeIntelligenceJobTrigger
  created_by?: string | null
  promote_on_complete?: boolean
  scheduled_for?: string
  skip_if_verified?: boolean
  skip_if_active_job?: boolean
}

export type EnqueueBuyingCommitteeIntelligenceJobResult =
  | { ok: true; enqueued: true; job_id: string }
  | { ok: true; enqueued: false; reason: string; job_id?: string | null }
  | { ok: false; reason: string }

export async function findActiveBuyingCommitteeIntelligenceJob(
  admin: SupabaseClient,
  company_id: string,
): Promise<{ id: string; status: GrowthBuyingCommitteeIntelligenceJobStatus } | null> {
  const { data } = await admin
    .schema("growth")
    .from("buying_committee_jobs")
    .select("id, status")
    .eq("company_id", company_id)
    .in("status", ["pending", "running"])
    .maybeSingle()

  if (!data?.id) return null
  return { id: asString(data.id), status: data.status as GrowthBuyingCommitteeIntelligenceJobStatus }
}

export async function enqueueBuyingCommitteeIntelligenceJob(
  admin: SupabaseClient,
  input: EnqueueBuyingCommitteeIntelligenceJobInput,
): Promise<EnqueueBuyingCommitteeIntelligenceJobResult> {
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
    if (await buyingCommitteeHasVerifiedIntelligenceMembers(admin, company_id)) {
      return { ok: true, enqueued: false, reason: "verified_committee_exists" }
    }
  }

  if (input.skip_if_active_job !== false) {
    const active = await findActiveBuyingCommitteeIntelligenceJob(admin, company_id)
    if (active) {
      return { ok: true, enqueued: false, reason: "active_job_exists", job_id: active.id }
    }
  }

  const scheduled_for = input.scheduled_for ?? new Date().toISOString()
  const { data, error } = await admin
    .schema("growth")
    .from("buying_committee_jobs")
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
      const active = await findActiveBuyingCommitteeIntelligenceJob(admin, company_id)
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
  logGrowthEngine("buying_committee_intelligence_job_enqueued", {
    job_id,
    company_id,
    trigger_source: input.trigger_source,
    promote_on_complete: input.promote_on_complete ?? false,
    created_by: input.created_by ?? null,
  })

  return { ok: true, enqueued: true, job_id }
}

export async function processBuyingCommitteeIntelligenceJobQueue(
  admin: SupabaseClient,
  limit = GROWTH_BUYING_COMMITTEE_INTELLIGENCE_MAX_JOBS_PER_CRON,
): Promise<{ processed: number; failed: number; skipped: number; stale_recovered: number }> {
  const { recovered: stale_recovered } = await recoverStaleBuyingCommitteeIntelligenceRunningJobs(admin)

  const { data: jobs } = await admin
    .schema("growth")
    .from("buying_committee_jobs")
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
      .from("buying_committee_jobs")
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
      const result = await runBuyingCommitteeIntelligenceForCanonicalCompany(admin, {
        company_id,
        promote: Boolean(job.promote_on_complete),
      })

      await admin
        .schema("growth")
        .from("buying_committee_jobs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          run_id: result.run_id,
          last_error: null,
        })
        .eq("id", job_id)

      logGrowthEngine("buying_committee_intelligence_job_completed", {
        job_id,
        run_id: result.run_id,
        company_id,
        member_count: result.member_count,
        verified_count: result.verified_count,
        promoted_count: result.promoted_count,
      })

      processed += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : "Buying committee intelligence failed."
      await admin
        .schema("growth")
        .from("buying_committee_jobs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          last_error: message.slice(0, 500),
        })
        .eq("id", job_id)

      logGrowthEngine("buying_committee_intelligence_job_failed", {
        job_id,
        company_id,
        message: message.slice(0, 500),
      })

      failed += 1
    }
  }

  return { processed, failed, skipped, stale_recovered }
}
