/** Phase 7.PS-IM — Density scale-up queue execution on deployed runtime. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { executeBenchmarkVerifiedEmailCandidate } from "@/lib/growth/benchmark/apollo-replacement-benchmark-verified-email-execute"
import {
  loadDensityScaleUpQueue,
  persistDensityScaleUpQueue,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-density-scale-up-queue"
import type { DensityScaleUpQueuePersonResult } from "@/lib/growth/benchmark/apollo-replacement-benchmark-density-scale-up-types"
import { APOLLO_REPLACEMENT_BENCHMARK_ID } from "@/lib/growth/benchmark/apollo-replacement-benchmark-types"

export async function processDensityScaleUpVerifiedEmailQueueIfScheduled(
  admin: SupabaseClient,
): Promise<{
  processed: boolean
  cert_payload: Record<string, unknown> | null
}> {
  const existing = await loadDensityScaleUpQueue(admin, APOLLO_REPLACEMENT_BENCHMARK_ID)
  if (!existing || existing.status !== "scheduled" || existing.candidates.length === 0) {
    return { processed: false, cert_payload: null }
  }

  const processing = {
    ...existing,
    status: "processing" as const,
    person_results: [],
    error: null,
  }
  await persistDensityScaleUpQueue(admin, processing)

  const person_results: DensityScaleUpQueuePersonResult[] = []
  let emails_verified = 0
  let emails_promoted = 0

  try {
    for (const candidate of existing.candidates) {
      const result = await executeBenchmarkVerifiedEmailCandidate(admin, candidate, {
        execution_channel: "deployed_vercel_cron_scale_up_queue",
      })
      if (result.verified) emails_verified += 1
      if (result.promoted) emails_promoted += 1
      person_results.push({
        full_name: candidate.full_name,
        email: candidate.email,
        company_name: candidate.company_name,
        person_id: candidate.person_id,
        company_id: candidate.company_id,
        verified: result.verified,
        promoted: result.promoted,
        execution_channel: result.provenance.execution_channel,
        messages: result.messages,
      })
    }

    const completed = {
      ...existing,
      status: "completed" as const,
      completed_at: new Date().toISOString(),
      person_results,
      error: null,
    }
    await persistDensityScaleUpQueue(admin, completed)

    return {
      processed: true,
      cert_payload: {
        ok: true,
        density_scale_up_queue: true,
        emails_verified,
        emails_promoted,
        person_results,
        processed: existing.candidates.length,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failed = {
      ...existing,
      status: "failed" as const,
      completed_at: new Date().toISOString(),
      person_results,
      error: message,
    }
    await persistDensityScaleUpQueue(admin, failed)
    return {
      processed: true,
      cert_payload: {
        ok: false,
        density_scale_up_queue: true,
        error: message,
        person_results,
        processed: person_results.length,
      },
    }
  }
}
