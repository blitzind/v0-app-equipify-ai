/** Phase 7.PS-HZ — Corroborated contact channel completion orchestrator. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_CORROBORATED_CONTACT_CHANNEL_COMPLETION_QA_MARKER,
  GROWTH_CORROBORATED_CONTACT_CHANNEL_COMPLETION_RUNTIME_QA_MARKER,
  type CorroboratedChannelRuntimeContext,
  type CorroboratedContactChannelCompletionMetrics,
  type CorroboratedPersonChannelResult,
  type CorroboratedPersonTarget,
} from "@/lib/growth/corroborated-contact-channel-completion/corroborated-contact-channel-completion-types"
import { loadCorroboratedPersonTargets } from "@/lib/growth/corroborated-contact-channel-completion/corroborated-contact-channel-completion-loader"
import {
  countVerifiedChannelsForPerson,
  loadOutreachReadinessSnapshot,
} from "@/lib/growth/corroborated-contact-channel-completion/corroborated-contact-channel-completion-metrics"
import {
  resolveCorroboratedChannelRuntimeContext,
  runEmailDiscoveryForCorroboratedPerson,
} from "@/lib/growth/corroborated-contact-channel-completion/corroborated-contact-channel-completion-runtime"
import { loadPersonCommitteeDensityExpansionCohort } from "@/lib/growth/graph-expansion/person-committee-density-expansion"
import type { PersonCommitteeDensityCohortCompany } from "@/lib/growth/graph-expansion/person-committee-density-expansion-types"
import { runPhoneDiscoveryForCanonicalPerson } from "@/lib/growth/phone-discovery/phone-discovery-orchestrator"
import { runSocialProfileDiscoveryForCanonicalPerson } from "@/lib/growth/social-profile-discovery/social-profile-discovery-orchestrator"

function emptyMetrics(): CorroboratedContactChannelCompletionMetrics {
  return {
    corroborated_persons_processed: 0,
    emails_discovered: 0,
    emails_verified: 0,
    emails_promoted: 0,
    phones_discovered: 0,
    phones_verified: 0,
    phones_promoted: 0,
    social_profiles_discovered: 0,
    social_profiles_verified: 0,
    social_profiles_promoted: 0,
    verified_channels_promoted: 0,
    persons_with_new_verified_channel: 0,
  }
}

async function persistChannelCompletionProvenance(
  admin: SupabaseClient,
  input: {
    person_id: string
    company_id: string
    result: CorroboratedPersonChannelResult
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
        corroborated_channel_completion: {
          qa_marker: GROWTH_CORROBORATED_CONTACT_CHANNEL_COMPLETION_QA_MARKER,
          runtime_qa_marker: GROWTH_CORROBORATED_CONTACT_CHANNEL_COMPLETION_RUNTIME_QA_MARKER,
          company_id: input.company_id,
          completed_at: new Date().toISOString(),
          email: input.result.email,
          phone: input.result.phone,
          social: input.result.social,
          gained_verified_channel: input.result.gained_verified_channel,
        },
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.person_id)
}

async function completeChannelsForCorroboratedPerson(
  admin: SupabaseClient,
  input: {
    target: CorroboratedPersonTarget
    runtime_context: CorroboratedChannelRuntimeContext
  },
): Promise<CorroboratedPersonChannelResult> {
  const messages: string[] = []
  const verified_before = await countVerifiedChannelsForPerson(admin, input.target.person_id)

  const emailDiscovery = await runEmailDiscoveryForCorroboratedPerson({
    admin,
    target: input.target,
    runtime_context: input.runtime_context,
  })
  messages.push(...emailDiscovery.messages)

  const email = {
    attempted: emailDiscovery.attempted,
    candidate_count: emailDiscovery.candidate_count,
    verified_count: emailDiscovery.verified_count,
    promoted_count: emailDiscovery.promoted_count,
    error: emailDiscovery.error,
    runtime: emailDiscovery.runtime,
  }
  const phone = {
    attempted: false,
    candidate_count: 0,
    verified_count: 0,
    promoted_count: 0,
    error: null as string | null,
  }
  const social = {
    attempted: false,
    candidate_count: 0,
    verified_count: 0,
    promoted_count: 0,
    error: null as string | null,
  }

  phone.attempted = true
  try {
    const result = await runPhoneDiscoveryForCanonicalPerson(admin, {
      company_id: input.target.company_id,
      person_id: input.target.person_id,
      promote: true,
    })
    phone.candidate_count = result.candidate_count
    phone.verified_count = result.verified_count
    phone.promoted_count = result.promoted_count
    messages.push(
      `phone: candidates=${result.candidate_count} verified=${result.verified_count} promoted=${result.promoted_count}`,
    )
  } catch (error) {
    phone.error = error instanceof Error ? error.message : String(error)
    messages.push(`phone_error: ${phone.error}`)
  }

  social.attempted = true
  try {
    const result = await runSocialProfileDiscoveryForCanonicalPerson(admin, {
      company_id: input.target.company_id,
      person_id: input.target.person_id,
      promote: true,
    })
    social.candidate_count = result.candidate_count
    social.verified_count = result.verified_count
    social.promoted_count = result.promoted_count
    messages.push(
      `social: candidates=${result.candidate_count} verified=${result.verified_count} promoted=${result.promoted_count}`,
    )
  } catch (error) {
    social.error = error instanceof Error ? error.message : String(error)
    messages.push(`social_error: ${social.error}`)
  }

  const verified_after = await countVerifiedChannelsForPerson(admin, input.target.person_id)
  const gained_verified_channel = verified_after > verified_before

  const result: CorroboratedPersonChannelResult = {
    person_id: input.target.person_id,
    full_name: input.target.full_name,
    company_name: input.target.company_name,
    company_id: input.target.company_id,
    email,
    phone,
    social,
    verified_channels_before: verified_before,
    verified_channels_after: verified_after,
    gained_verified_channel,
    messages,
  }

  await persistChannelCompletionProvenance(admin, {
    person_id: input.target.person_id,
    company_id: input.target.company_id,
    result,
  })

  return result
}

export async function runCorroboratedContactChannelCompletion(
  admin: SupabaseClient,
  input: {
    cohort?: PersonCommitteeDensityCohortCompany[]
    include_anchors?: boolean
    limit?: number
    targets?: CorroboratedPersonTarget[]
  } = {},
): Promise<{
  qa_marker: typeof GROWTH_CORROBORATED_CONTACT_CHANNEL_COMPLETION_QA_MARKER
  ok: boolean
  cohort: PersonCommitteeDensityCohortCompany[]
  targets: CorroboratedPersonTarget[]
  metrics: CorroboratedContactChannelCompletionMetrics
  before: Awaited<ReturnType<typeof loadOutreachReadinessSnapshot>>
  after: Awaited<ReturnType<typeof loadOutreachReadinessSnapshot>>
  person_results: CorroboratedPersonChannelResult[]
  runtime_context: CorroboratedChannelRuntimeContext
  messages: string[]
}> {
  const metrics = emptyMetrics()
  const messages: string[] = []
  const person_results: CorroboratedPersonChannelResult[] = []

  const cohort =
    input.cohort ??
    (await loadPersonCommitteeDensityExpansionCohort(admin, {
      include_anchors: input.include_anchors,
      limit: input.limit,
    }))

  const targets =
    input.targets ?? (await loadCorroboratedPersonTargets(admin, cohort))
  const personIds = targets.map((t) => t.person_id)
  const companyIds = [...new Set(targets.map((t) => t.company_id))]

  const before = await loadOutreachReadinessSnapshot(admin, {
    person_ids: personIds,
    company_ids: companyIds,
  })
  const runtime_context = await resolveCorroboratedChannelRuntimeContext(admin)
  messages.push(
    `runtime_path: ${runtime_context.email_execution_path} local_zb=${runtime_context.local_zerobounce_configured} deployed_zb=${runtime_context.deployed_zerobounce_configured}`,
  )
  messages.push(`corroborated_targets: ${targets.length}`)

  for (const target of targets) {
    metrics.corroborated_persons_processed += 1
    const result = await completeChannelsForCorroboratedPerson(admin, {
      target,
      runtime_context,
    })
    person_results.push(result)

    metrics.emails_discovered += result.email.candidate_count
    metrics.emails_verified += result.email.verified_count
    metrics.emails_promoted += result.email.promoted_count
    metrics.phones_discovered += result.phone.candidate_count
    metrics.phones_verified += result.phone.verified_count
    metrics.phones_promoted += result.phone.promoted_count
    metrics.social_profiles_discovered += result.social.candidate_count
    metrics.social_profiles_verified += result.social.verified_count
    metrics.social_profiles_promoted += result.social.promoted_count

    if (result.gained_verified_channel) {
      metrics.persons_with_new_verified_channel += 1
      metrics.verified_channels_promoted +=
        result.verified_channels_after - result.verified_channels_before
    }

    messages.push(
      `${target.full_name}@${target.company_name}: gained_channel=${result.gained_verified_channel}`,
    )
  }

  const after = await loadOutreachReadinessSnapshot(admin, {
    person_ids: personIds,
    company_ids: companyIds,
  })

  const ok =
    metrics.corroborated_persons_processed > 0 && metrics.persons_with_new_verified_channel > 0

  return {
    qa_marker: GROWTH_CORROBORATED_CONTACT_CHANNEL_COMPLETION_QA_MARKER,
    ok,
    cohort,
    targets,
    metrics,
    before,
    after,
    person_results,
    runtime_context,
    messages,
  }
}
