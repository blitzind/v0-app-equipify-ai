/** Apollo sequence personalization — unified context → channel content before execution-ready. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthAiCopilotGenerationType } from "@/lib/growth/ai-copilot-types"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { buildOutreachContextPacket } from "@/lib/growth/outreach/personalization/context-packet-builder"
import { buildPersonalizedSmsDraft } from "@/lib/growth/sms/personalization/assemble-sms-draft"
import { projectSmsPersonalizationContext } from "@/lib/growth/sms/personalization/sms-context-projection"
import { normalizeToE164 } from "@/lib/growth/sms/phone-normalization"
import { runGrowthAiCopilotGeneration } from "@/lib/growth/run-ai-copilot-generation"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { resolveCanonicalOutreachPackageForLead } from "@/lib/growth/aios/growth/growth-send-plane-1a-canonical-loader"
import {
  materializeCanonicalOutreachChannelContent,
  resolveOperatorAssetOverride,
} from "@/lib/growth/aios/growth/growth-send-plane-1a-materialization"
import {
  fetchGrowthSequenceEnrollmentById,
  fetchGrowthSequenceEnrollmentStepById,
  updateGrowthSequenceEnrollmentStep,
} from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import { updateSequenceExecutionJob } from "@/lib/growth/sequences/execution/sequence-job-repository"
import {
  buildApolloCallIntelligence,
  formatApolloCallIntelligenceBody,
} from "@/lib/growth/apollo/apollo-call-intelligence"
import type { ApolloSequenceExecutionCandidateRow } from "@/lib/growth/apollo/apollo-sequence-execution-automation-types"
import type {
  ApolloSequenceExecutionDraftRecord,
  ApolloSequenceExecutionJobLink,
  ApolloSequenceExecutionMaterializationPlan,
} from "@/lib/growth/apollo/apollo-sequence-execution-automation-types"
import {
  evaluateApolloSequenceCandidateContentReadiness,
  isApolloSequenceDraftPlaceholderContent,
  type ApolloSequenceContentReadinessResult,
} from "@/lib/growth/apollo/apollo-sequence-draft-readiness"
import {
  isApolloEmailPlaceholderContent,
  isApolloSmsPlaceholderBody,
} from "@/lib/growth/apollo/apollo-sequence-placeholder-guard"
import {
  buildApolloUnifiedPersonalizationContextFromPacket,
  type ApolloUnifiedPersonalizationContext,
} from "@/lib/growth/apollo/apollo-unified-personalization-context"
import { buildApolloVoiceDropIntelligenceFromUnifiedContext } from "@/lib/growth/apollo/apollo-voice-drop-intelligence-engine"
import { generateApolloVoiceDropScriptFromUnifiedContext } from "@/lib/growth/apollo/apollo-voice-drop-script-generation"

import {
  APOLLO_SEQUENCE_PERSONALIZATION_SERVICE_QA_MARKER,
  APOLLO_SMS_PERSONALIZATION_MISSING_PHONE_BLOCKER,
} from "@/lib/growth/apollo/apollo-sequence-personalization-constants"

export {
  APOLLO_SEQUENCE_PERSONALIZATION_SERVICE_QA_MARKER,
  APOLLO_SMS_PERSONALIZATION_MISSING_PHONE_BLOCKER,
} from "@/lib/growth/apollo/apollo-sequence-personalization-constants"

export type ApolloSequencePersonalizationResult = {
  ok: boolean
  code: string | null
  detail: string | null
  materialization: ApolloSequenceExecutionMaterializationPlan
  execution_jobs: ApolloSequenceExecutionJobLink[]
  unified_context: ApolloUnifiedPersonalizationContext | null
  readiness: ApolloSequenceContentReadinessResult & {
    qa_marker: typeof APOLLO_SEQUENCE_PERSONALIZATION_SERVICE_QA_MARKER
  }
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function resolveEmailGenerationType(step: { generation_type: string | null }): GrowthAiCopilotGenerationType {
  const raw = asString(step.generation_type)
  if (raw === "cold_email" || raw === "follow_up_email" || raw === "reply_email") return raw
  return "follow_up_email"
}

function buildApolloEmailPersonalizationFallback(input: {
  draft: ApolloSequenceExecutionDraftRecord
  unified_context: ApolloUnifiedPersonalizationContext
  reason?: string | null
}): ApolloSequenceExecutionDraftRecord {
  const name = input.unified_context.contact_full_name.split(/\s+/)[0] || "there"
  const company = input.unified_context.contact_company_name
  const title = input.unified_context.contact_title?.trim() || "your team"

  return {
    ...input.draft,
    subject_placeholder: `Equipify idea for ${company}`,
    body_placeholder: `Hi ${name},\n\nI wanted to share how Equipify supports ${title} leaders at organizations like ${company} with equipment operations and vendor workflows.\n\nWould you be open to a brief conversation this week?\n\nBest regards`,
    content_summary: input.reason
      ? `Email personalization fallback (${input.reason}).`
      : "Email personalization fallback — deterministic draft (no send).",
    personalization_packet_marker: input.unified_context.qa_marker,
  }
}

export async function loadApolloUnifiedPersonalizationContextForCandidate(
  admin: SupabaseClient,
  candidate: ApolloSequenceExecutionCandidateRow,
): Promise<ApolloUnifiedPersonalizationContext | null> {
  const leadId = candidate.growth_lead_id?.trim()
  if (!leadId) return null

  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) return null

  const packet = await buildOutreachContextPacket(admin, lead)

  let accountPlaybookSummary: string | null = null
  let committeeCoverage: string | null = null
  const { data: playbookRow } = await admin
    .schema("growth")
    .from("account_playbooks")
    .select("reasoning, committee_strategy, committee_role_summary, company_profile_snapshot, coverage_status")
    .eq("company_candidate_id", candidate.company_candidate_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (playbookRow) {
    const reasoning = asString(playbookRow.reasoning)
    committeeCoverage = asString(playbookRow.committee_strategy) || null
    const coverageStatus = asString(playbookRow.coverage_status)
    const companyProfile =
      playbookRow.company_profile_snapshot && typeof playbookRow.company_profile_snapshot === "object"
        ? asString((playbookRow.company_profile_snapshot as Record<string, unknown>).summary)
        : ""
    accountPlaybookSummary =
      [reasoning, committeeCoverage, coverageStatus, companyProfile].filter(Boolean).join(" — ") || null
  }

  const apolloEvidence = [
    candidate.source_attribution.apollo_source,
    candidate.source_attribution.qualification_source,
    `Qualification score ${candidate.qualification_score}`,
  ].join("; ")

  return buildApolloUnifiedPersonalizationContextFromPacket({
    packet,
    contact_full_name: candidate.full_name,
    contact_title: candidate.title,
    contact_company_name: candidate.company_name,
    qualification_score: candidate.qualification_score,
    apollo_evidence_summary: apolloEvidence,
    apollo_source_label: candidate.source_attribution.apollo_source,
    qualification_source: candidate.source_attribution.qualification_source,
    enrollment_source: candidate.source_attribution.enrollment_source,
    account_playbook_source: candidate.source_attribution.account_playbook_source,
    account_playbook_summary: accountPlaybookSummary,
    buying_committee_summary: committeeCoverage ?? packet.memoryCommitteeSummaries[0] ?? null,
    attribution_chain: [...candidate.source_attribution.attribution_chain],
  })
}

async function personalizeEmailDraft(
  admin: SupabaseClient,
  input: {
    draft: ApolloSequenceExecutionDraftRecord
    step: ApolloSequenceExecutionMaterializationPlan["steps"][number]
    jobLink: ApolloSequenceExecutionJobLink | null
    unified_context: ApolloUnifiedPersonalizationContext
    leadId: string
    actingUserId: string
    actingUserEmail: string
    sequenceEnrollmentId?: string | null
  },
): Promise<ApolloSequenceExecutionDraftRecord> {
  const generationType = resolveEmailGenerationType(input.step)
  const enrollmentStep = input.jobLink?.sequence_step_id
    ? await fetchGrowthSequenceEnrollmentStepById(admin, input.jobLink.sequence_step_id)
    : null
  const enrollment = input.sequenceEnrollmentId
    ? await fetchGrowthSequenceEnrollmentById(admin, input.sequenceEnrollmentId)
    : null

  const result = await runGrowthAiCopilotGeneration({
    admin,
    leadId: input.leadId,
    generationType,
    actingUserId: input.actingUserId,
    actingUserEmail: input.actingUserEmail,
    sequencePatternStepId: enrollmentStep?.sequencePatternStepId ?? null,
    sequencePatternId: enrollment?.sequencePatternId ?? null,
    organizationId: getGrowthEngineAiOrgId(),
  })

  if (!result.ok) {
    return buildApolloEmailPersonalizationFallback({
      draft: input.draft,
      unified_context: input.unified_context,
      reason: result.code ?? "generation_failed",
    })
  }

  const generation = result.generation
  const subject = generation.generatedSubject?.trim() || input.draft.subject_placeholder || "Follow up"
  const body = generation.generatedContent?.trim() || input.draft.body_placeholder

  const personalizedDraft = {
    ...input.draft,
    subject_placeholder: subject,
    body_placeholder: body,
    content_summary: `Personalized email (generation ${generation.id}) — ${generationType}.`,
    generation_id: generation.id !== "ephemeral" ? generation.id : null,
    personalization_packet_marker: input.unified_context.qa_marker,
  }

  if (
    isApolloEmailPlaceholderContent({
      subject: personalizedDraft.subject_placeholder,
      body: personalizedDraft.body_placeholder,
    })
  ) {
    return buildApolloEmailPersonalizationFallback({
      draft: input.draft,
      unified_context: input.unified_context,
      reason: "generated_content_still_placeholder",
    })
  }

  if (input.jobLink?.sequence_step_id) {
    await updateGrowthSequenceEnrollmentStep(admin, input.jobLink.sequence_step_id, {
      status: "draft_created",
      generationId: generation.id !== "ephemeral" ? generation.id : null,
      instructions: personalizedDraft.body_placeholder,
    })
  }

  return personalizedDraft
}

async function personalizeSmsDraft(
  admin: SupabaseClient,
  input: {
    draft: ApolloSequenceExecutionDraftRecord
    jobLink: ApolloSequenceExecutionJobLink | null
    unified_context: ApolloUnifiedPersonalizationContext
    leadId: string
    phoneE164?: string | null
  },
): Promise<{ draft: ApolloSequenceExecutionDraftRecord; smsBody: string | null }> {
  let body = ""
  const organizationId = getGrowthEngineAiOrgId()
  if (organizationId) {
    const canonicalPkg = await resolveCanonicalOutreachPackageForLead(admin, {
      organizationId,
      leadId: input.leadId,
    })
    const brief = canonicalPkg?.salesStrategyBrief
    if (brief) {
      const materialized = materializeCanonicalOutreachChannelContent({
        brief,
        channel: "sms",
        package: canonicalPkg,
        operatorAssetOverride: resolveOperatorAssetOverride(canonicalPkg, "sms"),
      })
      if (materialized.transportReady) {
        body = materialized.body
      }
    }
  }

  if (!body) {
    const context = projectSmsPersonalizationContext({ packet: input.unified_context.outreach_packet })
    const { draft: smsDraft } = buildPersonalizedSmsDraft({
      leadId: input.leadId,
      context,
      draftType: "outbound",
    })
    body = asString(smsDraft.body)
  }
  if (!body || isApolloSmsPlaceholderBody(body)) {
    const name = input.unified_context.contact_full_name.split(/\s+/)[0] || "there"
    const company = input.unified_context.contact_company_name
    body = `${name}, quick Equipify follow-up re: ${company}. Reply STOP to opt out.`
  }

  if (input.jobLink?.execution_job_id) {
    await updateSequenceExecutionJob(admin, input.jobLink.execution_job_id, {
      smsDraftBody: body,
      smsToE164: input.phoneE164 ?? null,
    })
  }

  return {
    draft: {
      ...input.draft,
      body_placeholder: body,
      content_summary: "Personalized SMS draft — placeholder removed.",
      personalization_packet_marker: input.unified_context.qa_marker,
    },
    smsBody: body,
  }
}

async function personalizeVoiceDropDraft(
  admin: SupabaseClient,
  input: {
    draft: ApolloSequenceExecutionDraftRecord
    unified_context: ApolloUnifiedPersonalizationContext
    leadId: string
  },
): Promise<ApolloSequenceExecutionDraftRecord> {
  const organizationId = getGrowthEngineAiOrgId()
  if (organizationId) {
    const canonicalPkg = await resolveCanonicalOutreachPackageForLead(admin, {
      organizationId,
      leadId: input.leadId,
    })
    const brief = canonicalPkg?.salesStrategyBrief
    if (brief) {
      const materialized = materializeCanonicalOutreachChannelContent({
        brief,
        channel: "voicemail",
        package: canonicalPkg,
        operatorAssetOverride: resolveOperatorAssetOverride(canonicalPkg, "voicemail"),
      })
      if (materialized.transportReady) {
        return {
          ...input.draft,
          body_placeholder: materialized.body,
          voice_drop_script_reference: materialized.body,
          content_summary: "Canonical voicemail draft from Sales Strategy Brief.",
          personalization_packet_marker: input.unified_context.qa_marker,
        }
      }
    }
  }

  const intelligence = buildApolloVoiceDropIntelligenceFromUnifiedContext({
    unified_context: input.unified_context,
    fit_score: input.unified_context.qualification_score,
  })
  const script = generateApolloVoiceDropScriptFromUnifiedContext({
    script_type: intelligence.recommended_script_type,
    unified_context: input.unified_context,
  })

  return {
    ...input.draft,
    body_placeholder: script.full_script,
    voice_drop_script_reference: script.full_script,
    content_summary: `Voice drop script (${script.script_type}) — unified context personalization.`,
    personalization_packet_marker: input.unified_context.qa_marker,
  }
}

async function personalizeCallDraft(
  admin: SupabaseClient,
  input: {
    draft: ApolloSequenceExecutionDraftRecord
    unified_context: ApolloUnifiedPersonalizationContext
    leadId: string
  },
): Promise<ApolloSequenceExecutionDraftRecord> {
  const organizationId = getGrowthEngineAiOrgId()
  if (organizationId) {
    const canonicalPkg = await resolveCanonicalOutreachPackageForLead(admin, {
      organizationId,
      leadId: input.leadId,
    })
    const brief = canonicalPkg?.salesStrategyBrief
    if (brief) {
      const materialized = materializeCanonicalOutreachChannelContent({
        brief,
        channel: "call",
        package: canonicalPkg,
        operatorAssetOverride: resolveOperatorAssetOverride(canonicalPkg, "call"),
      })
      if (materialized.transportReady) {
        return {
          ...input.draft,
          body_placeholder: materialized.body,
          content_summary: "Canonical call guide from Growth 5F package.",
          personalization_packet_marker: input.unified_context.qa_marker,
        }
      }
    }
  }

  const intelligence = buildApolloCallIntelligence(input.unified_context)
  const body = formatApolloCallIntelligenceBody(intelligence)

  return {
    ...input.draft,
    body_placeholder: body,
    content_summary: "Call intelligence generated from unified personalization packet.",
    call_intelligence: intelligence,
    personalization_packet_marker: input.unified_context.qa_marker,
  }
}

export async function personalizeApolloSequenceCandidateContent(
  admin: SupabaseClient,
  input: {
    candidate: ApolloSequenceExecutionCandidateRow
    acting_user_id: string
    acting_user_email: string
  },
): Promise<ApolloSequencePersonalizationResult> {
  const leadId = input.candidate.growth_lead_id?.trim()
  if (!leadId) {
    return {
      ok: false,
      code: "growth_lead_id_required",
      detail: "Cannot personalize without growth lead.",
      materialization: input.candidate.materialization,
      execution_jobs: input.candidate.execution_jobs,
      unified_context: null,
      readiness: {
        ...evaluateApolloSequenceCandidateContentReadiness({
          drafts: input.candidate.materialization.drafts,
        }),
        qa_marker: APOLLO_SEQUENCE_PERSONALIZATION_SERVICE_QA_MARKER,
      },
    }
  }

  const unifiedContext = await loadApolloUnifiedPersonalizationContextForCandidate(admin, input.candidate)
  if (!unifiedContext) {
    return {
      ok: false,
      code: "unified_context_unavailable",
      detail: "Failed to build unified personalization context.",
      materialization: input.candidate.materialization,
      execution_jobs: input.candidate.execution_jobs,
      unified_context: null,
      readiness: {
        ...evaluateApolloSequenceCandidateContentReadiness({
          drafts: input.candidate.materialization.drafts,
        }),
        qa_marker: APOLLO_SEQUENCE_PERSONALIZATION_SERVICE_QA_MARKER,
      },
    }
  }

  const phoneE164 = normalizeToE164(input.candidate.phone)
  const smsPhoneUnavailable = !phoneE164
  const materialization = { ...input.candidate.materialization }
  const updatedDrafts: ApolloSequenceExecutionDraftRecord[] = []
  const jobByStep = new Map(
    input.candidate.execution_jobs.map((job) => [job.step_number, job]),
  )
  const stepByNumber = new Map(materialization.steps.map((step) => [step.step_number, step]))

  for (const draft of materialization.drafts) {
    const step = stepByNumber.get(draft.step_number)
    const jobLink = jobByStep.get(draft.step_number) ?? null

    if (!step) {
      updatedDrafts.push(draft)
      continue
    }

    const needsPersonalization = isApolloSequenceDraftPlaceholderContent(draft.body_placeholder)
    if (!needsPersonalization) {
      updatedDrafts.push(draft)
      continue
    }

    if (draft.draft_type === "email") {
      updatedDrafts.push(
        await personalizeEmailDraft(admin, {
          draft,
          step,
          jobLink,
          unified_context: unifiedContext,
          leadId,
          actingUserId: input.acting_user_id,
          actingUserEmail: input.acting_user_email,
          sequenceEnrollmentId: input.candidate.sequence_enrollment_id,
        }),
      )
      continue
    }

    if (draft.draft_type === "sms") {
      if (smsPhoneUnavailable) {
        updatedDrafts.push(draft)
        continue
      }
      const smsResult = await personalizeSmsDraft(admin, {
        draft,
        jobLink,
        unified_context: unifiedContext,
        leadId,
        phoneE164,
      })
      updatedDrafts.push(smsResult.draft)
      continue
    }

    if (draft.draft_type === "voice_drop") {
      updatedDrafts.push(
        await personalizeVoiceDropDraft(admin, {
          draft,
          unified_context: unifiedContext,
          leadId,
        }),
      )
      continue
    }

    if (draft.draft_type === "call") {
      updatedDrafts.push(
        await personalizeCallDraft(admin, {
          draft,
          unified_context: unifiedContext,
          leadId,
        }),
      )
      continue
    }

    updatedDrafts.push(draft)
  }

  materialization.drafts = updatedDrafts

  const readiness = {
    ...evaluateApolloSequenceCandidateContentReadiness({
      drafts: updatedDrafts,
      unified_context: unifiedContext,
    }),
    qa_marker: APOLLO_SEQUENCE_PERSONALIZATION_SERVICE_QA_MARKER,
  }

  const emailStillPlaceholder = updatedDrafts.some(
    (draft) =>
      draft.draft_type === "email" &&
      isApolloEmailPlaceholderContent({
        subject: draft.subject_placeholder,
        body: draft.body_placeholder,
      }),
  )
  const smsStillPlaceholder = updatedDrafts.some(
    (draft) => draft.draft_type === "sms" && isApolloSmsPlaceholderBody(draft.body_placeholder),
  )
  const voiceStillPlaceholder = updatedDrafts.some(
    (draft) =>
      draft.draft_type === "voice_drop" &&
      isApolloSequenceDraftPlaceholderContent(draft.body_placeholder),
  )
  const channelDraftsMaterialized =
    !emailStillPlaceholder &&
    !voiceStillPlaceholder &&
    (smsPhoneUnavailable || !smsStillPlaceholder)

  if (!channelDraftsMaterialized) {
    return {
      ok: false,
      code: emailStillPlaceholder
        ? "email_still_placeholder"
        : smsStillPlaceholder && !smsPhoneUnavailable
          ? "sms_still_placeholder"
          : voiceStillPlaceholder
            ? "voice_drop_still_placeholder"
            : readiness.code ?? "content_not_ready",
      detail: readiness.detail,
      materialization,
      execution_jobs: input.candidate.execution_jobs,
      unified_context: unifiedContext,
      readiness,
    }
  }

  return {
    ok: true,
    code: smsPhoneUnavailable ? APOLLO_SMS_PERSONALIZATION_MISSING_PHONE_BLOCKER : null,
    detail: smsPhoneUnavailable
      ? "Email and voice drop drafts materialized — SMS blocked (missing phone, no send)."
      : "Channel drafts materialized — email, SMS, and voice drop content present (no send).",
    materialization,
    execution_jobs: input.candidate.execution_jobs,
    unified_context: unifiedContext,
    readiness,
  }
}
