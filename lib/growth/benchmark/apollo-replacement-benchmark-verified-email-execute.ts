/** Phase 7.PS-IL — Benchmark verified email execution (staging verify + promote). Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { canonicalNormalizedPersonEmail } from "@/lib/growth/canonical-persons/canonical-person-normalize"
import { baseConfidenceForSource } from "@/lib/growth/email-discovery/email-discovery-confidence"
import { evaluateEmailDiscoveryVerificationCertification } from "@/lib/growth/email-discovery/email-discovery-certification"
import {
  assertEmailDiscoveryVerificationReadyForRun,
  assertPersonCompanyRoleForDiscovery,
} from "@/lib/growth/email-discovery/email-discovery-preflight"
import { promoteVerifiedEmailDiscoveryCandidate } from "@/lib/growth/email-discovery/email-discovery-promote"
import {
  createEmailDiscoveryRun,
  finalizeEmailDiscoveryRun,
  insertEmailDiscoveryCandidate,
  insertEmailDiscoveryEvidence,
} from "@/lib/growth/email-discovery/email-discovery-repository"
import { verifyEmailDiscoveryDraft } from "@/lib/growth/email-discovery/email-discovery-verification"
import type { GrowthEmailDiscoveryDraftCandidate } from "@/lib/growth/email-discovery/email-discovery-types"
import {
  GROWTH_APOLLO_REPLACEMENT_BENCHMARK_VERIFIED_EMAIL_QA_MARKER,
  type BenchmarkVerifiedEmailCandidateRow,
  type BenchmarkVerifiedEmailCompletionProvenance,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-verified-email-types"
import {
  loadBenchmarkVerifiedEmailQueue,
  persistBenchmarkVerifiedEmailQueue,
  type BenchmarkVerifiedEmailQueuePersonResult,
  type BenchmarkVerifiedEmailQueueRecord,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-verified-email-queue"
import { APOLLO_REPLACEMENT_BENCHMARK_ID } from "@/lib/growth/benchmark/apollo-replacement-benchmark-types"

function stagingDraftFromCandidate(
  candidate: BenchmarkVerifiedEmailCandidateRow,
): GrowthEmailDiscoveryDraftCandidate | null {
  const normalized_email = canonicalNormalizedPersonEmail(candidate.email)
  if (!normalized_email) return null

  const base = baseConfidenceForSource("staging_contact")
  return {
    email: candidate.email,
    normalized_email,
    source: "staging_contact",
    confidence: base,
    confidence_tier: "direct_evidence",
    provider_name: "company_contacts",
    discovery_source: candidate.source_type || "company_contacts",
    evidence: [
      {
        evidence_type: "staging_row",
        source_url: candidate.source_page_url,
        evidence_text: `Benchmark contact ${candidate.company_contact_id} — ${candidate.full_name} (${candidate.evidence_ref})`,
        confidence: base,
      },
    ],
  }
}

async function persistBenchmarkEmailCompletionProvenance(
  admin: SupabaseClient,
  input: {
    person_id: string
    provenance: BenchmarkVerifiedEmailCompletionProvenance
  },
): Promise<void> {
  const { data: person } = await admin
    .schema("growth")
    .from("persons")
    .select("metadata")
    .eq("id", input.person_id)
    .maybeSingle()

  const metadata =
    person?.metadata && typeof person.metadata === "object"
      ? ({ ...(person.metadata as Record<string, unknown>) } as Record<string, unknown>)
      : {}

  await admin
    .schema("growth")
    .from("persons")
    .update({
      metadata: {
        ...metadata,
        apollo_benchmark_verified_email_completion: {
          qa_marker: GROWTH_APOLLO_REPLACEMENT_BENCHMARK_VERIFIED_EMAIL_QA_MARKER,
          ...input.provenance,
          completed_at: new Date().toISOString(),
        },
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.person_id)
}

export async function executeBenchmarkVerifiedEmailCandidate(
  admin: SupabaseClient,
  candidate: BenchmarkVerifiedEmailCandidateRow,
  input: { execution_channel: string },
): Promise<{
  attempted: boolean
  verified: boolean
  promoted: boolean
  error: string | null
  provenance: BenchmarkVerifiedEmailCompletionProvenance
  messages: string[]
}> {
  const messages: string[] = []
  const provenanceBase = {
    provider: "zerobounce",
    deployed_runtime_used: input.execution_channel.startsWith("deployed"),
    execution_channel: input.execution_channel,
    source_evidence: candidate.evidence_ref ?? candidate.email,
    contact_id: candidate.company_contact_id,
    email: candidate.email,
  }

  await assertPersonCompanyRoleForDiscovery(admin, {
    company_id: candidate.company_id,
    person_id: candidate.person_id,
  })
  assertEmailDiscoveryVerificationReadyForRun({ require_production_safe: true })

  const draft = stagingDraftFromCandidate(candidate)
  if (!draft) {
    return {
      attempted: false,
      verified: false,
      promoted: false,
      error: "invalid_email_normalization",
      provenance: provenanceBase,
      messages: ["invalid_email"],
    }
  }

  const run_id = await createEmailDiscoveryRun(admin, {
    company_id: candidate.company_id,
    person_id: candidate.person_id,
  })

  await admin
    .schema("growth")
    .from("email_discovery_runs")
    .update({ provider_summary: "staging_contact_only_benchmark_7_ps_il" })
    .eq("id", run_id)

  const verification = await verifyEmailDiscoveryDraft(admin, draft)
  const verifiedDraft: GrowthEmailDiscoveryDraftCandidate = {
    ...draft,
    confidence: verification.confidence,
    confidence_tier: verification.confidence_tier,
    evidence: verification.evidence,
  }
  const candidate_id = await insertEmailDiscoveryCandidate(admin, {
    run_id,
    company_id: candidate.company_id,
    person_id: candidate.person_id,
    draft: verifiedDraft,
    verification_status: verification.verification_status,
    verified_at: verification.verified_at,
    verification_provider: verification.verification_provider,
    verification_reasons: verification.verification_reasons,
    promotion_status: "candidate",
  })
  await insertEmailDiscoveryEvidence(admin, candidate_id, verifiedDraft.evidence)

  let promoted = false
  if (verification.verification_status === "verified") {
    const promotion = await promoteVerifiedEmailDiscoveryCandidate(admin, {
      person_id: candidate.person_id,
      email: draft.email,
      normalized_email: draft.normalized_email,
      confidence: verification.confidence,
      verification_status: verification.verification_status,
      provider_name: draft.provider_name,
      discovery_source: draft.discovery_source,
      run_id,
      candidate_id,
    })
    promoted = promotion.promoted
    messages.push(`promotion: ${promotion.promotion_status} — ${promotion.reason}`)
  } else {
    messages.push(`verification_status: ${verification.verification_status}`)
  }

  await finalizeEmailDiscoveryRun(admin, {
    run_id,
    status: "completed",
    candidate_count: 1,
    verified_count: verification.verification_status === "verified" ? 1 : 0,
    promoted_count: promoted ? 1 : 0,
  })

  const cert = evaluateEmailDiscoveryVerificationCertification()
  const provenance: BenchmarkVerifiedEmailCompletionProvenance = {
    ...provenanceBase,
    provider: verification.verification_provider || "zerobounce",
    deployed_runtime_used: input.execution_channel.startsWith("deployed"),
    execution_channel: cert.production_safe
      ? input.execution_channel
      : `${input.execution_channel}_unsafe`,
  }

  await persistBenchmarkEmailCompletionProvenance(admin, {
    person_id: candidate.person_id,
    provenance,
  })

  return {
    attempted: true,
    verified: verification.verification_status === "verified",
    promoted,
    error: null,
    provenance,
    messages,
  }
}

export async function processBenchmarkVerifiedEmailQueueIfScheduled(
  admin: SupabaseClient,
): Promise<{
  processed: boolean
  queue: BenchmarkVerifiedEmailQueueRecord | null
  cert_payload: Record<string, unknown> | null
}> {
  const existing = await loadBenchmarkVerifiedEmailQueue(admin, APOLLO_REPLACEMENT_BENCHMARK_ID)
  if (!existing || existing.status !== "scheduled" || existing.candidates.length === 0) {
    return { processed: false, queue: existing, cert_payload: null }
  }

  const processing: BenchmarkVerifiedEmailQueueRecord = {
    ...existing,
    status: "processing",
    person_results: [],
    error: null,
  }
  await persistBenchmarkVerifiedEmailQueue(admin, processing)

  const person_results: BenchmarkVerifiedEmailQueuePersonResult[] = []
  let emails_verified = 0
  let emails_promoted = 0

  try {
    for (const candidate of existing.candidates) {
      const result = await executeBenchmarkVerifiedEmailCandidate(admin, candidate, {
        execution_channel: "deployed_vercel_cron_queue",
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

    const completed: BenchmarkVerifiedEmailQueueRecord = {
      ...existing,
      status: "completed",
      completed_at: new Date().toISOString(),
      person_results,
      error: null,
    }
    await persistBenchmarkVerifiedEmailQueue(admin, completed)

    return {
      processed: true,
      queue: completed,
      cert_payload: {
        ok: true,
        benchmark_queue: true,
        emails_verified,
        emails_promoted,
        person_results,
        processed: existing.candidates.length,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failed: BenchmarkVerifiedEmailQueueRecord = {
      ...existing,
      status: "failed",
      completed_at: new Date().toISOString(),
      person_results,
      error: message,
    }
    await persistBenchmarkVerifiedEmailQueue(admin, failed)
    return {
      processed: true,
      queue: failed,
      cert_payload: {
        ok: false,
        benchmark_queue: true,
        error: message,
        person_results,
        processed: person_results.length,
      },
    }
  }
}
