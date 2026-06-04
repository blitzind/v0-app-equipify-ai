import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { limitSocialProfileDiscoveryDraftsForVerification } from "@/lib/growth/social-profile-discovery/social-profile-discovery-limits"
import {
  assertSocialProfileDiscoveryPreflight,
  SocialProfileDiscoveryPreflightError,
} from "@/lib/growth/social-profile-discovery/social-profile-discovery-preflight"
import { promoteVerifiedSocialProfileDiscoveryCandidate } from "@/lib/growth/social-profile-discovery/social-profile-discovery-promote"
import {
  createSocialProfileDiscoveryRun,
  finalizeSocialProfileDiscoveryRun,
  insertSocialProfileDiscoveryCandidate,
  insertSocialProfileDiscoveryEvidence,
  loadSocialProfileDiscoveryCompanyContext,
  loadSocialProfileDiscoveryPersonContext,
  updateSocialProfileDiscoveryCandidatePromotion,
} from "@/lib/growth/social-profile-discovery/social-profile-discovery-repository"
import type { SocialProfileDiscoveryContext } from "@/lib/growth/social-profile-discovery/social-profile-discovery-sources"
import {
  collectCanonicalChannelSocialProfileDiscoveryCandidates,
  collectStagingSocialProfileDiscoveryCandidates,
  collectWebsiteSocialProfileDiscoveryCandidates,
} from "@/lib/growth/social-profile-discovery/social-profile-discovery-sources"
import { verifySocialProfileDiscoveryDraft } from "@/lib/growth/social-profile-discovery/social-profile-discovery-verification"
import {
  GROWTH_SOCIAL_PROFILE_DISCOVERY_QA_MARKER,
  type GrowthSocialProfileDiscoveryCandidateSummary,
  type GrowthSocialProfileDiscoveryDraftCandidate,
  type GrowthSocialProfileDiscoveryRunResult,
  type GrowthSocialProfileDiscoveryScope,
} from "@/lib/growth/social-profile-discovery/social-profile-discovery-types"

function dedupeDrafts(
  drafts: GrowthSocialProfileDiscoveryDraftCandidate[],
): GrowthSocialProfileDiscoveryDraftCandidate[] {
  const byKey = new Map<string, GrowthSocialProfileDiscoveryDraftCandidate>()
  for (const draft of drafts) {
    const existing = byKey.get(draft.normalized_profile_key)
    if (!existing || draft.confidence > existing.confidence) {
      byKey.set(draft.normalized_profile_key, draft)
    }
  }
  return [...byKey.values()]
}

async function runSocialProfileDiscovery(
  admin: SupabaseClient,
  input: {
    company_id: string
    person_id: string | null
    discovery_scope: GrowthSocialProfileDiscoveryScope
    created_by?: string | null
    promote?: boolean
  },
): Promise<GrowthSocialProfileDiscoveryRunResult> {
  await assertSocialProfileDiscoveryPreflight(admin, {
    company_id: input.company_id,
    person_id: input.person_id,
    discovery_scope: input.discovery_scope,
  })

  const ctx =
    input.discovery_scope === "person" && input.person_id
      ? await loadSocialProfileDiscoveryPersonContext(admin, {
          company_id: input.company_id,
          person_id: input.person_id,
        })
      : await loadSocialProfileDiscoveryCompanyContext(admin, { company_id: input.company_id })

  if (!ctx) {
    throw new Error("Canonical company or person not found.")
  }

  const discoveryCtx: SocialProfileDiscoveryContext = {
    company_id: ctx.company_id,
    person_id: ctx.person_id,
    discovery_scope: ctx.discovery_scope,
    company_name: ctx.company_name,
    normalized_name: ctx.normalized_name,
    full_name: ctx.full_name,
    primary_domain: ctx.primary_domain,
    website_url: ctx.website_url,
  }

  const run_id = await createSocialProfileDiscoveryRun(admin, {
    company_id: input.company_id,
    person_id: input.person_id,
    discovery_scope: input.discovery_scope,
    created_by: input.created_by ?? null,
  })

  const messages: string[] = []

  const sourceResults = await Promise.all([
    collectWebsiteSocialProfileDiscoveryCandidates(discoveryCtx),
    collectStagingSocialProfileDiscoveryCandidates(admin, discoveryCtx),
    collectCanonicalChannelSocialProfileDiscoveryCandidates(admin, discoveryCtx),
  ])
  for (const result of sourceResults) {
    messages.push(...result.messages)
  }

  const deduped = dedupeDrafts(sourceResults.flatMap((r) => r.drafts))
  const { drafts, truncated } = limitSocialProfileDiscoveryDraftsForVerification(deduped)
  if (truncated > 0) {
    messages.push(`Verification cap: ${truncated} lower-priority candidate(s) skipped.`)
  }

  let verified_count = 0
  let promoted_count = 0
  const summaries: GrowthSocialProfileDiscoveryCandidateSummary[] = []

  try {
    for (const draft of drafts) {
      const v = verifySocialProfileDiscoveryDraft(draft)
      if (v.verification_status === "verified") verified_count++

      const candidate_id = await insertSocialProfileDiscoveryCandidate(admin, {
        run_id,
        company_id: input.company_id,
        person_id: input.person_id,
        draft: { ...draft, confidence: v.confidence, confidence_tier: v.confidence_tier },
        verification_status: v.verification_status,
        verified_at: v.verified_at,
        verification_provider: v.verification_provider,
        verification_reasons: v.verification_reasons,
        promotion_status: "candidate",
      })
      await insertSocialProfileDiscoveryEvidence(admin, candidate_id, v.evidence)

      let promotion_status = "skipped"
      let promotion_reason = "Promotion disabled for this run."

      if (input.promote !== false) {
        const promo = await promoteVerifiedSocialProfileDiscoveryCandidate(admin, {
          discovery_scope: input.discovery_scope,
          company_id: input.company_id,
          person_id: input.person_id,
          profile_type: draft.profile_type,
          profile_url: draft.profile_url,
          normalized_profile_key: draft.normalized_profile_key,
          confidence: v.confidence,
          verification_status: v.verification_status,
          provider_name: draft.provider_name,
          discovery_source: draft.discovery_source,
          run_id,
          candidate_id,
        })
        promotion_status = promo.promotion_status
        promotion_reason = promo.reason
        if (promo.promoted) promoted_count++
      } else {
        await updateSocialProfileDiscoveryCandidatePromotion(admin, {
          candidate_id,
          promotion_status: "skipped",
          promotion_reason,
        })
      }

      summaries.push({
        id: candidate_id,
        profile_type: draft.profile_type,
        profile_url: draft.profile_url,
        source: draft.source,
        confidence: v.confidence,
        confidence_tier: v.confidence_tier,
        verification_status: v.verification_status,
        promotion_status,
        promotion_reason,
        verification_provider: v.verification_provider,
        verification_reasons: v.verification_reasons,
        evidence_count: v.evidence.length,
      })
    }

    await finalizeSocialProfileDiscoveryRun(admin, {
      run_id,
      status: "completed",
      candidate_count: summaries.length,
      verified_count,
      promoted_count,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Social profile discovery failed."
    await finalizeSocialProfileDiscoveryRun(admin, {
      run_id,
      status: "failed",
      candidate_count: summaries.length,
      verified_count,
      promoted_count,
      error_message: message,
    })
    throw e
  }

  return {
    qa_marker: GROWTH_SOCIAL_PROFILE_DISCOVERY_QA_MARKER,
    run_id,
    company_id: input.company_id,
    person_id: input.person_id,
    discovery_scope: input.discovery_scope,
    status: "completed",
    candidate_count: summaries.length,
    verified_count,
    promoted_count,
    candidates: summaries,
    messages,
  }
}

export async function runSocialProfileDiscoveryForCanonicalPerson(
  admin: SupabaseClient,
  input: {
    company_id: string
    person_id: string
    created_by?: string | null
    promote?: boolean
  },
): Promise<GrowthSocialProfileDiscoveryRunResult> {
  return runSocialProfileDiscovery(admin, {
    company_id: input.company_id,
    person_id: input.person_id,
    discovery_scope: "person",
    created_by: input.created_by,
    promote: input.promote,
  })
}

export async function runSocialProfileDiscoveryForCanonicalCompany(
  admin: SupabaseClient,
  input: {
    company_id: string
    created_by?: string | null
    promote?: boolean
  },
): Promise<GrowthSocialProfileDiscoveryRunResult> {
  return runSocialProfileDiscovery(admin, {
    company_id: input.company_id,
    person_id: null,
    discovery_scope: "company",
    created_by: input.created_by,
    promote: input.promote,
  })
}

export { SocialProfileDiscoveryPreflightError }
