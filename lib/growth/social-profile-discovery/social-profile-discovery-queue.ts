import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { companyHasVerifiedSocialProfile } from "@/lib/growth/social-profile-discovery/social-profile-discovery-company-profile-integrity"
import {
  runSocialProfileDiscoveryForCanonicalCompany,
  runSocialProfileDiscoveryForCanonicalPerson,
} from "@/lib/growth/social-profile-discovery/social-profile-discovery-orchestrator"
import { personHasVerifiedSocialProfile } from "@/lib/growth/social-profile-discovery/social-profile-discovery-person-profile-integrity"
import { recoverStaleSocialProfileDiscoveryRunningJobs } from "@/lib/growth/social-profile-discovery/social-profile-discovery-stale-jobs"
import type {
  GrowthSocialProfileDiscoveryJobTrigger,
  GrowthSocialProfileDiscoveryJobStatus,
} from "@/lib/growth/social-profile-discovery/social-profile-discovery-runtime-types"
import type { GrowthSocialProfileDiscoveryScope } from "@/lib/growth/social-profile-discovery/social-profile-discovery-types"

export const GROWTH_SOCIAL_PROFILE_DISCOVERY_MAX_JOBS_PER_CRON = 2 as const
export const GROWTH_SOCIAL_PROFILE_DISCOVERY_MAX_COMPANY_ENRICH_QUEUE = 8 as const

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export type EnqueueSocialProfileDiscoveryJobInput = {
  company_id: string
  person_id?: string | null
  discovery_scope?: GrowthSocialProfileDiscoveryScope
  trigger_source: GrowthSocialProfileDiscoveryJobTrigger
  created_by?: string | null
  promote_on_complete?: boolean
  scheduled_for?: string
  skip_if_verified?: boolean
  skip_if_active_job?: boolean
}

export type EnqueueSocialProfileDiscoveryJobResult =
  | { ok: true; enqueued: true; job_id: string }
  | { ok: true; enqueued: false; reason: string; job_id?: string | null }
  | { ok: false; reason: string }

export async function findActiveSocialProfileDiscoveryJob(
  admin: SupabaseClient,
  input: {
    company_id: string
    person_id?: string | null
    discovery_scope: GrowthSocialProfileDiscoveryScope
  },
): Promise<{ id: string; status: GrowthSocialProfileDiscoveryJobStatus } | null> {
  let query = admin
    .schema("growth")
    .from("social_profile_discovery_jobs")
    .select("id, status")
    .eq("company_id", input.company_id)
    .eq("discovery_scope", input.discovery_scope)
    .in("status", ["pending", "running"])

  if (input.discovery_scope === "person") {
    const person_id = asString(input.person_id)
    if (!person_id) return null
    query = query.eq("person_id", person_id)
  } else {
    query = query.is("person_id", null)
  }

  const { data } = await query.maybeSingle()
  if (!data?.id) return null
  return { id: asString(data.id), status: data.status as GrowthSocialProfileDiscoveryJobStatus }
}

export async function enqueueSocialProfileDiscoveryJob(
  admin: SupabaseClient,
  input: EnqueueSocialProfileDiscoveryJobInput,
): Promise<EnqueueSocialProfileDiscoveryJobResult> {
  const company_id = asString(input.company_id)
  const discovery_scope: GrowthSocialProfileDiscoveryScope =
    input.discovery_scope ?? (input.person_id ? "person" : "company")
  const person_id = discovery_scope === "person" ? asString(input.person_id) : null

  if (!company_id) {
    return { ok: false, reason: "company_id is required." }
  }
  if (discovery_scope === "person" && !person_id) {
    return { ok: false, reason: "person_id is required for person-scoped discovery." }
  }

  if (discovery_scope === "person" && person_id) {
    const { data: role } = await admin
      .schema("growth")
      .from("person_company_roles")
      .select("id")
      .eq("company_id", company_id)
      .eq("person_id", person_id)
      .limit(1)
      .maybeSingle()
    if (!role) {
      return { ok: false, reason: "person_company_roles row required before social profile discovery." }
    }
  }

  if (input.skip_if_verified !== false) {
    const hasVerified =
      discovery_scope === "person" && person_id
        ? await personHasVerifiedSocialProfile(admin, person_id)
        : await companyHasVerifiedSocialProfile(admin, company_id)
    if (hasVerified) {
      return { ok: true, enqueued: false, reason: "verified_profile_exists" }
    }
  }

  if (input.skip_if_active_job !== false) {
    const active = await findActiveSocialProfileDiscoveryJob(admin, {
      company_id,
      person_id,
      discovery_scope,
    })
    if (active) {
      return { ok: true, enqueued: false, reason: "active_job_exists", job_id: active.id }
    }
  }

  const scheduled_for = input.scheduled_for ?? new Date().toISOString()
  const { data, error } = await admin
    .schema("growth")
    .from("social_profile_discovery_jobs")
    .insert({
      company_id,
      person_id,
      discovery_scope,
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
      const active = await findActiveSocialProfileDiscoveryJob(admin, {
        company_id,
        person_id,
        discovery_scope,
      })
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
  logGrowthEngine("social_profile_discovery_job_enqueued", {
    job_id,
    company_id,
    person_id,
    discovery_scope,
    trigger_source: input.trigger_source,
    promote_on_complete: input.promote_on_complete ?? false,
    created_by: input.created_by ?? null,
  })

  return { ok: true, enqueued: true, job_id }
}

export async function queueSocialProfileDiscoveryForCompanyRoles(
  admin: SupabaseClient,
  input: {
    company_id: string
    trigger_source: GrowthSocialProfileDiscoveryJobTrigger
    created_by?: string | null
    limit?: number
  },
): Promise<{ queued: number; skipped: number }> {
  const company_id = asString(input.company_id)
  const limit = Math.min(Math.max(input.limit ?? GROWTH_SOCIAL_PROFILE_DISCOVERY_MAX_COMPANY_ENRICH_QUEUE, 1), 25)

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
    const result = await enqueueSocialProfileDiscoveryJob(admin, {
      company_id,
      person_id,
      discovery_scope: "person",
      trigger_source: input.trigger_source,
      created_by: input.created_by ?? null,
    })
    if (result.ok && result.enqueued) queued += 1
    else skipped += 1
  }
  return { queued, skipped }
}

export async function processSocialProfileDiscoveryJobQueue(
  admin: SupabaseClient,
  limit = GROWTH_SOCIAL_PROFILE_DISCOVERY_MAX_JOBS_PER_CRON,
): Promise<{ processed: number; failed: number; skipped: number; stale_recovered: number }> {
  const { recovered: stale_recovered } = await recoverStaleSocialProfileDiscoveryRunningJobs(admin)

  const { data: jobs } = await admin
    .schema("growth")
    .from("social_profile_discovery_jobs")
    .select("id, company_id, person_id, discovery_scope, promote_on_complete, attempts")
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
    const discovery_scope = (job.discovery_scope as GrowthSocialProfileDiscoveryScope) ?? "person"
    const person_id = job.person_id ? asString(job.person_id) : null
    if (!job_id || !company_id) {
      skipped += 1
      continue
    }
    if (discovery_scope === "person" && !person_id) {
      skipped += 1
      continue
    }

    const started = new Date().toISOString()
    const { error: runErr } = await admin
      .schema("growth")
      .from("social_profile_discovery_jobs")
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
      const result =
        discovery_scope === "company"
          ? await runSocialProfileDiscoveryForCanonicalCompany(admin, {
              company_id,
              promote: Boolean(job.promote_on_complete),
            })
          : await runSocialProfileDiscoveryForCanonicalPerson(admin, {
              company_id,
              person_id: person_id!,
              promote: Boolean(job.promote_on_complete),
            })

      await admin
        .schema("growth")
        .from("social_profile_discovery_jobs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          run_id: result.run_id,
          last_error: null,
        })
        .eq("id", job_id)

      logGrowthEngine("social_profile_discovery_job_completed", {
        job_id,
        run_id: result.run_id,
        company_id,
        person_id,
        discovery_scope,
        candidate_count: result.candidate_count,
        verified_count: result.verified_count,
        promoted_count: result.promoted_count,
      })

      processed += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : "Social profile discovery failed."
      await admin
        .schema("growth")
        .from("social_profile_discovery_jobs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          last_error: message.slice(0, 500),
        })
        .eq("id", job_id)

      logGrowthEngine("social_profile_discovery_job_failed", {
        job_id,
        company_id,
        person_id,
        discovery_scope,
        message: message.slice(0, 500),
      })

      failed += 1
    }
  }

  return { processed, failed, skipped, stale_recovered }
}
