import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { runEmailDiscoveryForCanonicalPerson } from "@/lib/growth/email-discovery/email-discovery-orchestrator"
import { recoverStaleEmailDiscoveryRunningJobs } from "@/lib/growth/email-discovery/email-discovery-stale-jobs"
import type {
  GrowthEmailDiscoveryJobTrigger,
  GrowthEmailDiscoveryJobStatus,
} from "@/lib/growth/email-discovery/email-discovery-runtime-types"

export const GROWTH_EMAIL_DISCOVERY_MAX_JOBS_PER_CRON = 2 as const
export const GROWTH_EMAIL_DISCOVERY_MAX_COMPANY_ENRICH_QUEUE = 8 as const

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export type EnqueueEmailDiscoveryJobInput = {
  company_id: string
  person_id: string
  trigger_source: GrowthEmailDiscoveryJobTrigger
  created_by?: string | null
  promote_on_complete?: boolean
  scheduled_for?: string
  skip_if_verified?: boolean
  skip_if_active_job?: boolean
}

export type EnqueueEmailDiscoveryJobResult =
  | { ok: true; enqueued: true; job_id: string }
  | { ok: true; enqueued: false; reason: string; job_id?: string | null }
  | { ok: false; reason: string }

export async function personHasVerifiedEmail(
  admin: SupabaseClient,
  personId: string,
): Promise<boolean> {
  const { data } = await admin
    .schema("growth")
    .from("person_emails")
    .select("id")
    .eq("person_id", personId)
    .eq("verification_status", "verified")
    .limit(1)
    .maybeSingle()
  return Boolean(data?.id)
}

export async function findActiveEmailDiscoveryJob(
  admin: SupabaseClient,
  input: { company_id: string; person_id: string },
): Promise<{ id: string; status: GrowthEmailDiscoveryJobStatus } | null> {
  const { data } = await admin
    .schema("growth")
    .from("email_discovery_jobs")
    .select("id, status")
    .eq("company_id", input.company_id)
    .eq("person_id", input.person_id)
    .in("status", ["pending", "running"])
    .maybeSingle()
  if (!data?.id) return null
  return { id: asString(data.id), status: data.status as GrowthEmailDiscoveryJobStatus }
}

export async function enqueueEmailDiscoveryJob(
  admin: SupabaseClient,
  input: EnqueueEmailDiscoveryJobInput,
): Promise<EnqueueEmailDiscoveryJobResult> {
  const company_id = asString(input.company_id)
  const person_id = asString(input.person_id)
  if (!company_id || !person_id) {
    return { ok: false, reason: "company_id and person_id are required." }
  }

  const { data: role } = await admin
    .schema("growth")
    .from("person_company_roles")
    .select("id")
    .eq("company_id", company_id)
    .eq("person_id", person_id)
    .limit(1)
    .maybeSingle()
  if (!role) {
    return { ok: false, reason: "person_company_roles row required before email discovery." }
  }

  if (input.skip_if_verified !== false) {
    if (await personHasVerifiedEmail(admin, person_id)) {
      return { ok: true, enqueued: false, reason: "verified_email_exists" }
    }
  }

  if (input.skip_if_active_job !== false) {
    const active = await findActiveEmailDiscoveryJob(admin, { company_id, person_id })
    if (active) {
      return { ok: true, enqueued: false, reason: "active_job_exists", job_id: active.id }
    }
  }

  const scheduled_for = input.scheduled_for ?? new Date().toISOString()
  const { data, error } = await admin
    .schema("growth")
    .from("email_discovery_jobs")
    .insert({
      company_id,
      person_id,
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
      const active = await findActiveEmailDiscoveryJob(admin, { company_id, person_id })
      return {
        ok: true,
        enqueued: false,
        reason: "active_job_exists",
        job_id: active?.id ?? null,
      }
    }
    return { ok: false, reason: error.message }
  }

  return { ok: true, enqueued: true, job_id: asString(data?.id) }
}

export async function queueEmailDiscoveryForCompanyRoles(
  admin: SupabaseClient,
  input: {
    company_id: string
    trigger_source: GrowthEmailDiscoveryJobTrigger
    created_by?: string | null
    limit?: number
  },
): Promise<{ queued: number; skipped: number }> {
  const company_id = asString(input.company_id)
  const limit = Math.min(Math.max(input.limit ?? GROWTH_EMAIL_DISCOVERY_MAX_COMPANY_ENRICH_QUEUE, 1), 25)

  const { data: roles } = await admin
    .schema("growth")
    .from("person_company_roles")
    .select("person_id")
    .eq("company_id", company_id)
    .limit(limit * 3)

  let queued = 0
  let skipped = 0
  for (const row of roles ?? []) {
    if (queued >= limit) break
    const person_id = asString((row as { person_id: string }).person_id)
    if (!person_id) continue
    const result = await enqueueEmailDiscoveryJob(admin, {
      company_id,
      person_id,
      trigger_source: input.trigger_source,
      created_by: input.created_by ?? null,
    })
    if (result.ok && result.enqueued) queued += 1
    else skipped += 1
  }
  return { queued, skipped }
}

export async function processEmailDiscoveryJobQueue(
  admin: SupabaseClient,
  limit = GROWTH_EMAIL_DISCOVERY_MAX_JOBS_PER_CRON,
): Promise<{ processed: number; failed: number; skipped: number; stale_recovered: number }> {
  const { recovered: stale_recovered } = await recoverStaleEmailDiscoveryRunningJobs(admin)

  const { data: jobs } = await admin
    .schema("growth")
    .from("email_discovery_jobs")
    .select("id, company_id, person_id, promote_on_complete, attempts")
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
    const person_id = asString(job.person_id)
    if (!job_id || !company_id || !person_id) {
      skipped += 1
      continue
    }

    const started = new Date().toISOString()
    const { error: runErr } = await admin
      .schema("growth")
      .from("email_discovery_jobs")
      .update({
        status: "running",
        started_at: started,
        attempts: (job.attempts ?? 0) + 1,
      })
      .eq("id", job_id)
      .eq("status", "pending")

    if (runErr) {
      skipped += 1
      continue
    }

    try {
      const result = await runEmailDiscoveryForCanonicalPerson(admin, {
        company_id,
        person_id,
        promote: Boolean(job.promote_on_complete),
        require_production_safe_verification: true,
      })

      await admin
        .schema("growth")
        .from("email_discovery_jobs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          run_id: result.run_id,
          last_error: null,
        })
        .eq("id", job_id)

      processed += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : "Email discovery failed."
      await admin
        .schema("growth")
        .from("email_discovery_jobs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          last_error: message.slice(0, 500),
        })
        .eq("id", job_id)
      failed += 1
    }
  }

  return { processed, failed, skipped, stale_recovered }
}
