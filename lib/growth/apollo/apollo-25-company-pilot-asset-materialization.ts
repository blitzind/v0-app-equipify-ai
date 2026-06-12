/** Apollo 25-company pilot — cohort asset materialization without outreach (Phase 14.2G). */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { handoffEnrollmentApprovedToAccountPlaybook } from "@/lib/growth/apollo/apollo-account-playbooks-bridge"
import {
  mapApolloAccountPlaybookDbRow,
} from "@/lib/growth/apollo/apollo-account-playbooks-evidence"
import { approveApolloAccountPlaybook } from "@/lib/growth/apollo/apollo-account-playbooks-queue"
import type { ApolloAccountPlaybookEnrollmentHandoffInput } from "@/lib/growth/apollo/apollo-account-playbooks-types"
import { mapApolloEnrollmentCandidateDbRow } from "@/lib/growth/apollo/apollo-enrollment-automation-evidence"
import type { ApolloEnrollmentCandidateRow } from "@/lib/growth/apollo/apollo-enrollment-automation-types"
import { resolveApolloEnrichmentCanonicalCompanyId } from "@/lib/growth/apollo/apollo-enrichment-cert-canonical-company-resolution"
import { approveApolloMultichannelSequenceCandidate } from "@/lib/growth/apollo/apollo-multichannel-orchestration-queue"
import { mapApolloMultichannelSequenceCandidateDbRow } from "@/lib/growth/apollo/apollo-multichannel-orchestration-evidence"
import { buildApollo25CompanyPilotCanonicalDedupeAudit } from "@/lib/growth/apollo/apollo-25-company-pilot-canonical-dedupe-audit"
import { isApolloSmsPersonalizationRequired } from "@/lib/growth/apollo/apollo-25-company-pilot-personalization-asset-requirements"
import {
  evaluateApollo25CompanyPilotCohortPersonalization,
  evaluateApolloExecutionMaterializationChannelDrafts,
} from "@/lib/growth/apollo/apollo-25-company-pilot-cohort-personalization-validation"
import { buildApollo25CompanyPilotCohortReview } from "@/lib/growth/apollo/apollo-25-company-pilot-cohort-review"
import {
  ensureApollo25CompanyPilotCanonicalUniqueSnapshot,
  parseApollo25CompanyPilotCohortSnapshotFromMetadata,
  snapshotCompaniesFromCohortCompanyRows,
} from "@/lib/growth/apollo/apollo-25-company-pilot-draft-cohort"
import {
  isApollo25CompanyPilotCanonicalDuplicateExcluded,
} from "@/lib/growth/apollo/apollo-25-company-pilot-canonical-cohort-dedupe"
import {
  APOLLO_25_COMPANY_PILOT_COHORT_SNAPSHOT_QA_MARKER,
  type Apollo25CompanyPilotCohortSnapshotCompany,
} from "@/lib/growth/apollo/apollo-25-company-pilot-types"
import { applyApolloCertificationMultichannelTemplateOverride } from "@/lib/growth/apollo/apollo-certification-multichannel-template-override-bridge"
import { APOLLO_PILOT_COHORT_MATERIALIZATION_PREFERRED_SEQUENCE_KEYS } from "@/lib/growth/apollo/apollo-certification-multichannel-template-override"
import { resolveAndBackfillApolloPipelineGrowthLeadForSequenceExecution } from "@/lib/growth/apollo/apollo-pipeline-growth-lead-resolution"
import { loadApolloPilotCohort } from "@/lib/growth/apollo/apollo-pilot-route"
import {
  mapApolloSequenceExecutionCandidateDbRow,
} from "@/lib/growth/apollo/apollo-sequence-execution-automation-evidence"
import { APOLLO_SEQUENCE_EXECUTION_AUTOMATION_QA_MARKER } from "@/lib/growth/apollo/apollo-sequence-execution-automation-types"
import { handoffMultichannelApprovedToSequenceExecution } from "@/lib/growth/apollo/apollo-sequence-execution-bridge"
import { buildApolloSequenceExecutionHandoffInput } from "@/lib/growth/apollo/apollo-sequence-execution-handoff-input"
import { personalizeApolloSequenceCandidateContent } from "@/lib/growth/apollo/apollo-sequence-personalization-service"
import { APOLLO_SMS_PERSONALIZATION_MISSING_PHONE_BLOCKER } from "@/lib/growth/apollo/apollo-sequence-personalization-constants"
import { normalizeToE164 } from "@/lib/growth/sms/phone-normalization"
import { approveApolloVoiceDropCandidate } from "@/lib/growth/apollo/apollo-voice-drop-candidate-queue"
import { mapApolloVoiceDropCandidateDbRow } from "@/lib/growth/apollo/apollo-voice-drop-automation-evidence"
import { generatePersonalizationDraft } from "@/lib/growth/personalization/dashboard"

export const APOLLO_25_COMPANY_PILOT_ASSET_MATERIALIZATION_QA_MARKER =
  "apollo-25-company-pilot-asset-materialization-v14-2g" as const

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export type Apollo25CompanyPilotAssetMaterializationCompanyResult = {
  company_candidate_id: string
  company_name: string
  ready: boolean
  blockers: string[]
  artifacts: {
    account_playbook: boolean
    personalization: boolean
    content_quality_optimization: boolean
    voice_drop_assets: boolean
    email_assets: boolean
    sms_assets: boolean
  }
  stage_ids: {
    enrollment_candidate_id: string | null
    account_playbook_id: string | null
    voice_drop_candidate_id: string | null
    multichannel_sequence_candidate_id: string | null
    sequence_execution_candidate_id: string | null
    growth_lead_id: string | null
  }
}

export type Apollo25CompanyPilotAssetMaterializationReport = {
  qa_marker: typeof APOLLO_25_COMPANY_PILOT_ASSET_MATERIALIZATION_QA_MARKER
  cohort_id: string
  execution_id: string
  companies_processed: number
  companies_ready: number
  readiness_pct: number
  companies: Apollo25CompanyPilotAssetMaterializationCompanyResult[]
  canonical_dedupe_audit: ReturnType<typeof buildApollo25CompanyPilotCanonicalDedupeAudit>
  review: Awaited<ReturnType<typeof buildApollo25CompanyPilotCohortReview>>
  no_outreach_side_effects: true
  no_sequence_execution: true
}

function buildPlaybookHandoffInput(
  enrollment: ApolloEnrollmentCandidateRow,
  canonical_company_id: string | null,
): ApolloAccountPlaybookEnrollmentHandoffInput {
  return {
    enrollment_candidate_id: enrollment.candidate_id,
    company_candidate_id: enrollment.company_candidate_id,
    canonical_company_id,
    company_contact_id: enrollment.company_contact_id,
    contact_candidate_id: enrollment.contact_candidate_id,
    growth_lead_id: enrollment.growth_lead_id,
    company_name: enrollment.company_name,
    full_name: enrollment.full_name,
    title: enrollment.title,
    email: enrollment.email,
    phone: enrollment.phone,
    qualification_score: enrollment.qualification_score,
    fit_score: enrollment.fit_score,
    research_score: enrollment.research_score,
    operator_intelligence: enrollment.operator_intelligence as unknown as Record<string, unknown>,
    source_attribution: enrollment.source_attribution as unknown as Record<string, unknown>,
    acquisition_evidence: enrollment.acquisition_evidence,
  }
}

async function loadEnrollmentCandidateForCompany(
  admin: SupabaseClient,
  company_candidate_id: string,
): Promise<ApolloEnrollmentCandidateRow | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("apollo_enrollment_candidates")
    .select("*")
    .eq("company_candidate_id", company_candidate_id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  return mapApolloEnrollmentCandidateDbRow(data as Record<string, unknown>)
}

async function persistPersonalizedExecutionCandidate(
  admin: SupabaseClient,
  input: {
    candidate_id: string
    materialization: import("@/lib/growth/apollo/apollo-sequence-execution-automation-types").ApolloSequenceExecutionMaterializationPlan
    execution_jobs: import("@/lib/growth/apollo/apollo-sequence-execution-automation-types").ApolloSequenceExecutionJobLink[]
    readiness_detail: string
    acting_user_id: string
    acting_user_email: string
  },
) {
  const now = new Date().toISOString()
  const { error } = await admin
    .schema("growth")
    .from("apollo_sequence_execution_candidates")
    .update({
      sequence_materialization: input.materialization,
      draft_records: input.materialization.drafts,
      sequence_steps: input.materialization.steps,
      execution_jobs: input.execution_jobs,
      updated_at: now,
      outreach_sent: false,
      voice_drop_sent: false,
      email_sent: false,
      sms_sent: false,
      call_placed: false,
      jobs_scheduled: false,
      metadata: {
        qa_marker: APOLLO_SEQUENCE_EXECUTION_AUTOMATION_QA_MARKER,
        pilot_asset_materialization_v14_2g: true,
        content_readiness_detail: input.readiness_detail,
        personalized_at: now,
        personalized_by: input.acting_user_id,
        personalized_email: input.acting_user_email,
      },
    })
    .eq("id", input.candidate_id)

  if (error) throw new Error(error.message)
}

export async function materializeApollo25CompanyPilotCompanyAssets(
  admin: SupabaseClient,
  input: {
    snapshot_company: Apollo25CompanyPilotCohortSnapshotCompany
    acting_user_id: string
    acting_user_email: string
    execution_id: string
    canonical_dedupe?: import("@/lib/growth/apollo/apollo-25-company-pilot-types").Apollo25CompanyPilotCohortCanonicalDedupeSummary | null
    materialized_canonical_company_ids?: Set<string>
  },
): Promise<Apollo25CompanyPilotAssetMaterializationCompanyResult> {
  const blockers: string[] = []
  const company_candidate_id = input.snapshot_company.company_candidate_id

  if (isApollo25CompanyPilotCanonicalDuplicateExcluded(company_candidate_id, input.canonical_dedupe)) {
    return {
      company_candidate_id,
      company_name: input.snapshot_company.company_name,
      ready: false,
      blockers: ["canonical_duplicate_excluded_from_cohort"],
      artifacts: {
        account_playbook: false,
        personalization: false,
        content_quality_optimization: false,
        voice_drop_assets: false,
        email_assets: false,
        sms_assets: false,
      },
      stage_ids: {
        enrollment_candidate_id: null,
        account_playbook_id: null,
        voice_drop_candidate_id: null,
        multichannel_sequence_candidate_id: null,
        sequence_execution_candidate_id: null,
        growth_lead_id: null,
      },
    }
  }

  const canonicalId = input.snapshot_company.canonical_company_id?.trim()
  if (canonicalId && input.materialized_canonical_company_ids?.has(canonicalId)) {
    return {
      company_candidate_id,
      company_name: input.snapshot_company.company_name,
      ready: false,
      blockers: ["canonical_company_already_materialized_in_cohort"],
      artifacts: {
        account_playbook: false,
        personalization: false,
        content_quality_optimization: false,
        voice_drop_assets: false,
        email_assets: false,
        sms_assets: false,
      },
      stage_ids: {
        enrollment_candidate_id: null,
        account_playbook_id: null,
        voice_drop_candidate_id: null,
        multichannel_sequence_candidate_id: null,
        sequence_execution_candidate_id: null,
        growth_lead_id: null,
      },
    }
  }
  const stage_ids = {
    enrollment_candidate_id: null as string | null,
    account_playbook_id: null as string | null,
    voice_drop_candidate_id: null as string | null,
    multichannel_sequence_candidate_id: null as string | null,
    sequence_execution_candidate_id: null as string | null,
    growth_lead_id: null as string | null,
  }

  const enrollment = await loadEnrollmentCandidateForCompany(admin, company_candidate_id)
  if (!enrollment) {
    return {
      company_candidate_id,
      company_name: input.snapshot_company.company_name,
      ready: false,
      blockers: ["enrollment_candidate_missing"],
      artifacts: {
        account_playbook: false,
        personalization: false,
        content_quality_optimization: false,
        voice_drop_assets: false,
        email_assets: false,
        sms_assets: false,
      },
      stage_ids,
    }
  }

  stage_ids.enrollment_candidate_id = enrollment.candidate_id

  const emptyArtifacts = {
    account_playbook: false,
    personalization: false,
    content_quality_optimization: false,
    voice_drop_assets: false,
    email_assets: false,
    sms_assets: false,
  }

  try {
  const canonicalResolution = await resolveApolloEnrichmentCanonicalCompanyId(admin, {
    company_candidate_id,
  })
  const canonical_company_id =
    input.snapshot_company.canonical_company_id?.trim() ||
    canonicalResolution.canonical_company_id?.trim() ||
    null

  const leadResolution = await resolveAndBackfillApolloPipelineGrowthLeadForSequenceExecution(admin, {
    enrollment_candidate_id: enrollment.candidate_id,
    company_candidate_id,
    company_contact_id: enrollment.company_contact_id,
    created_by_user_id: input.acting_user_id,
  })
  stage_ids.growth_lead_id = leadResolution.growth_lead_id ?? enrollment.growth_lead_id

  let { data: playbookRow } = await admin
    .schema("growth")
    .from("account_playbooks")
    .select("*")
    .eq("enrollment_candidate_id", enrollment.candidate_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!playbookRow) {
    const handoff = await handoffEnrollmentApprovedToAccountPlaybook(
      admin,
      buildPlaybookHandoffInput(enrollment, canonical_company_id),
    )
    if (!handoff.ok && handoff.error) blockers.push(`account_playbook_handoff:${handoff.error}`)
    if (handoff.playbook_id) {
      const { data } = await admin
        .schema("growth")
        .from("account_playbooks")
        .select("*")
        .eq("id", handoff.playbook_id)
        .maybeSingle()
      playbookRow = data as Record<string, unknown> | null
    }
  }

  const playbook = playbookRow ? mapApolloAccountPlaybookDbRow(playbookRow) : null
  stage_ids.account_playbook_id = playbook?.playbook_id ?? null

  if (!playbook) {
    blockers.push("account_playbook_missing")
  } else if (playbook.status === "pending_playbook_approval") {
    const approved = await approveApolloAccountPlaybook(admin, {
      playbook_id: playbook.playbook_id,
      approver_user_id: input.acting_user_id,
      approver_email: input.acting_user_email,
      note: `pilot-asset-materialization:${input.execution_id}`,
    })
    if (!approved.ok) blockers.push(`account_playbook_approval:${approved.error ?? "failed"}`)
  }

  let { data: voiceDropRow } = await admin
    .schema("growth")
    .from("apollo_voice_drop_candidates")
    .select("*")
    .eq("enrollment_candidate_id", enrollment.candidate_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const voiceDrop = voiceDropRow
    ? mapApolloVoiceDropCandidateDbRow(voiceDropRow as Record<string, unknown>)
    : null
  stage_ids.voice_drop_candidate_id = voiceDrop?.candidate_id ?? null

  if (!voiceDrop) {
    blockers.push("voice_drop_candidate_missing")
  } else if (voiceDrop.status === "pending_voice_drop_approval") {
    const approved = await approveApolloVoiceDropCandidate(admin, {
      candidate_id: voiceDrop.candidate_id,
      approver_user_id: input.acting_user_id,
      approver_email: input.acting_user_email,
      note: `pilot-asset-materialization:${input.execution_id}`,
    })
    if (!approved.ok) blockers.push(`voice_drop_approval:${approved.error ?? "failed"}`)
    const { data } = await admin
      .schema("growth")
      .from("apollo_voice_drop_candidates")
      .select("*")
      .eq("id", voiceDrop.candidate_id)
      .maybeSingle()
    voiceDropRow = data as Record<string, unknown> | null
  }

  const voiceDropFresh = voiceDropRow
    ? mapApolloVoiceDropCandidateDbRow(voiceDropRow as Record<string, unknown>)
    : null
  stage_ids.voice_drop_candidate_id = voiceDropFresh?.candidate_id ?? null

  let { data: multichannelRow } = voiceDropFresh
    ? await admin
        .schema("growth")
        .from("apollo_multichannel_sequence_candidates")
        .select("*")
        .eq("voice_drop_candidate_id", voiceDropFresh.candidate_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null }

  const multichannel = multichannelRow
    ? mapApolloMultichannelSequenceCandidateDbRow(multichannelRow as Record<string, unknown>)
    : null
  stage_ids.multichannel_sequence_candidate_id = multichannel?.candidate_id ?? null

  if (!multichannel) {
    blockers.push("multichannel_candidate_missing")
  } else if (multichannel.status === "pending_sequence_approval") {
    const approved = await approveApolloMultichannelSequenceCandidate(admin, {
      candidate_id: multichannel.candidate_id,
      approver_user_id: input.acting_user_id,
      approver_email: input.acting_user_email,
      note: `pilot-asset-materialization:${input.execution_id}`,
    })
    if (!approved.ok) blockers.push(`multichannel_approval:${approved.error ?? "failed"}`)
    const { data } = await admin
      .schema("growth")
      .from("apollo_multichannel_sequence_candidates")
      .select("*")
      .eq("id", multichannel.candidate_id)
      .maybeSingle()
    multichannelRow = data as Record<string, unknown> | null
  }

  let multichannelFresh = multichannelRow
    ? mapApolloMultichannelSequenceCandidateDbRow(multichannelRow as Record<string, unknown>)
    : null
  stage_ids.multichannel_sequence_candidate_id = multichannelFresh?.candidate_id ?? null

  if (multichannelFresh) {
    const templateOverride = await applyApolloCertificationMultichannelTemplateOverride(admin, {
      candidate_id: multichannelFresh.candidate_id,
      email: enrollment.email,
      phone: enrollment.phone,
      sequence_ready_contact: true,
      verified_email_contact: Boolean(enrollment.email?.trim()),
      channel_availability_overlay: multichannelFresh.channel_availability,
      preferred_keys: APOLLO_PILOT_COHORT_MATERIALIZATION_PREFERRED_SEQUENCE_KEYS,
    })
    if (!templateOverride.ok) {
      blockers.push(
        `multichannel_template_override:${templateOverride.evidence.template_override_blockers.join(" | ") || "failed"}`,
      )
    } else {
      const { data: reloadedMultichannel } = await admin
        .schema("growth")
        .from("apollo_multichannel_sequence_candidates")
        .select("*")
        .eq("id", multichannelFresh.candidate_id)
        .maybeSingle()
      if (reloadedMultichannel) {
        multichannelRow = reloadedMultichannel as Record<string, unknown>
        multichannelFresh = mapApolloMultichannelSequenceCandidateDbRow(multichannelRow)
      }
    }
  }

  let { data: executionRow } = multichannelFresh
    ? await admin
        .schema("growth")
        .from("apollo_sequence_execution_candidates")
        .select("*")
        .eq("multichannel_sequence_candidate_id", multichannelFresh.candidate_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null }

  if (!executionRow && multichannelFresh?.status === "sequence_approved") {
    const handoff = await handoffMultichannelApprovedToSequenceExecution(
      admin,
      buildApolloSequenceExecutionHandoffInput({
        multichannel: multichannelFresh,
        growth_lead_id: stage_ids.growth_lead_id,
        voice_drop_script_reference: voiceDropFresh?.voice_drop_script.full_script ?? null,
        created_by_user_id: input.acting_user_id,
      }),
    )
    if (!handoff.ok) blockers.push(`sequence_execution_handoff:${handoff.error ?? "failed"}`)
    if (handoff.candidate_id) {
      const { data } = await admin
        .schema("growth")
        .from("apollo_sequence_execution_candidates")
        .select("*")
        .eq("id", handoff.candidate_id)
        .maybeSingle()
      executionRow = data as Record<string, unknown> | null
    }
  }

  const execution = executionRow
    ? mapApolloSequenceExecutionCandidateDbRow(executionRow as Record<string, unknown>)
    : null
  stage_ids.sequence_execution_candidate_id = execution?.candidate_id ?? null
  stage_ids.growth_lead_id = execution?.growth_lead_id ?? stage_ids.growth_lead_id

  if (!execution) {
    blockers.push("sequence_execution_candidate_missing")
  } else {
    const missingPhone = !normalizeToE164(execution.phone)
    const personalization = await personalizeApolloSequenceCandidateContent(admin, {
      candidate: execution,
      acting_user_id: input.acting_user_id,
      acting_user_email: input.acting_user_email,
    })
    const channelDrafts = evaluateApolloExecutionMaterializationChannelDrafts(
      personalization.materialization.drafts,
    )
    const shouldPersistPersonalizedDrafts =
      personalization.ok ||
      (channelDrafts.email_assets && channelDrafts.voice_drop_assets) ||
      (channelDrafts.email_assets && channelDrafts.sms_assets && channelDrafts.voice_drop_assets)

    if (shouldPersistPersonalizedDrafts) {
      await persistPersonalizedExecutionCandidate(admin, {
        candidate_id: execution.candidate_id,
        materialization: personalization.materialization,
        execution_jobs: personalization.execution_jobs,
        readiness_detail: personalization.readiness.detail,
        acting_user_id: input.acting_user_id,
        acting_user_email: input.acting_user_email,
      })
    }

    if (missingPhone && isApolloSmsPersonalizationRequired({
      sequence_key: execution.materialization.sequence_key,
      selected_channels: execution.materialization.steps.map((step) => step.orchestration_channel),
      materialization_steps: execution.materialization.steps,
      expected_draft_types: execution.materialization.drafts.map((draft) => draft.draft_type),
    })) {
      blockers.push(APOLLO_SMS_PERSONALIZATION_MISSING_PHONE_BLOCKER)
    }

    if (!personalization.ok) {
      blockers.push(`personalization:${personalization.code ?? "failed"}`)
    }
  }

  if (stage_ids.growth_lead_id) {
    try {
      await generatePersonalizationDraft(admin, {
        leadId: stage_ids.growth_lead_id,
        actorUserId: input.acting_user_id,
        actorEmail: input.acting_user_email,
      })
    } catch (error) {
      blockers.push(
        `personalization_generation:${error instanceof Error ? error.message : String(error)}`,
      )
    }
  } else {
    blockers.push("growth_lead_missing_for_personalization")
  }

  const materialization_by_company = await loadPilotPersonalizationMaterializationByCompany(admin, [
    company_candidate_id,
  ])
  const personalizationReport = evaluateApollo25CompanyPilotCohortPersonalization({
    snapshot_companies: [input.snapshot_company],
    materialization_by_company,
  })
  const personalizationCompany = personalizationReport.companies[0]

  const artifacts = personalizationCompany?.assets ?? {
    account_playbook: false,
    personalization: false,
    content_quality_optimization: false,
    voice_drop_assets: false,
    email_assets: false,
    sms_assets: false,
  }

  const ready = Boolean(personalizationCompany?.ready)

  if (canonicalId && input.materialized_canonical_company_ids) {
    input.materialized_canonical_company_ids.add(canonicalId)
  }

  return {
    company_candidate_id,
    company_name: input.snapshot_company.company_name,
    ready,
    blockers,
    artifacts,
    stage_ids,
  }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logGrowthEngine("apollo_25_pilot_asset_materialization_company_failed", {
      cohort_company_candidate_id: company_candidate_id,
      execution_id: input.execution_id,
      enrollment_candidate_id: stage_ids.enrollment_candidate_id,
      error: message,
    })
    return {
      company_candidate_id,
      company_name: input.snapshot_company.company_name,
      ready: false,
      blockers: [`materialization_error:${message}`],
      artifacts: emptyArtifacts,
      stage_ids,
    }
  }
}

async function loadPilotPersonalizationMaterializationByCompany(
  admin: SupabaseClient,
  companyIds: string[],
): Promise<
  Record<string, import("@/lib/growth/apollo/apollo-25-company-pilot-cohort-personalization-validation").Apollo25CompanyPilotPersonalizationMaterializationState>
> {
  const map: Record<
    string,
    import("@/lib/growth/apollo/apollo-25-company-pilot-cohort-personalization-validation").Apollo25CompanyPilotPersonalizationMaterializationState
  > = {}
  for (const companyId of companyIds) {
    map[companyId] = {
      has_account_playbook: false,
      has_personalization_generation: false,
      execution_drafts: [],
      has_voice_drop_candidate: false,
      sequence_key: null,
      selected_channels: [],
      materialization_steps: [],
    }
  }
  if (companyIds.length === 0) return map

  const enrollmentState: Record<string, { growth_lead_id: string | null }> = {}
  const { data: enrollmentRows } = await admin
    .schema("growth")
    .from("apollo_enrollment_candidates")
    .select("company_candidate_id, growth_lead_id")
    .in("company_candidate_id", companyIds)

  const leadIds: string[] = []
  for (const row of enrollmentRows ?? []) {
    const record = row as Record<string, unknown>
    const companyId = asString(record.company_candidate_id)
    const leadId = asString(record.growth_lead_id) || null
    if (companyId) enrollmentState[companyId] = { growth_lead_id: leadId }
    if (leadId) leadIds.push(leadId)
  }

  const [playbookRes, executionRes, voiceDropRes, personalizationRes] = await Promise.all([
    admin
      .schema("growth")
      .from("account_playbooks")
      .select("company_candidate_id")
      .in("company_candidate_id", companyIds),
    admin
      .schema("growth")
      .from("apollo_sequence_execution_candidates")
      .select("*")
      .in("company_candidate_id", companyIds),
    admin
      .schema("growth")
      .from("apollo_voice_drop_candidates")
      .select("company_candidate_id")
      .in("company_candidate_id", companyIds),
    leadIds.length > 0
      ? admin
          .schema("growth")
          .from("personalization_generations")
          .select("lead_id")
          .in("lead_id", [...new Set(leadIds)])
      : Promise.resolve({ data: [], error: null }),
  ])

  if (playbookRes.error) throw new Error(playbookRes.error.message)
  if (executionRes.error) throw new Error(executionRes.error.message)
  if (voiceDropRes.error) throw new Error(voiceDropRes.error.message)
  if (personalizationRes.error) throw new Error(personalizationRes.error.message)

  for (const row of playbookRes.data ?? []) {
    const companyId = asString((row as Record<string, unknown>).company_candidate_id)
    if (companyId && map[companyId]) map[companyId].has_account_playbook = true
  }
  for (const row of voiceDropRes.data ?? []) {
    const companyId = asString((row as Record<string, unknown>).company_candidate_id)
    if (companyId && map[companyId]) map[companyId].has_voice_drop_candidate = true
  }
  const leadsWithPersonalization = new Set<string>()
  for (const row of personalizationRes.data ?? []) {
    const leadId = asString((row as Record<string, unknown>).lead_id)
    if (leadId) leadsWithPersonalization.add(leadId)
  }
  for (const companyId of companyIds) {
    const leadId = enrollmentState[companyId]?.growth_lead_id
    if (leadId && leadsWithPersonalization.has(leadId)) {
      map[companyId].has_personalization_generation = true
    }
  }
  for (const row of executionRes.data ?? []) {
    const candidate = mapApolloSequenceExecutionCandidateDbRow(row as Record<string, unknown>)
    const companyId = candidate.company_candidate_id?.trim()
    if (!companyId || !map[companyId]) continue
    map[companyId].execution_drafts = candidate.materialization.drafts
    map[companyId].sequence_key = candidate.materialization.sequence_key
    map[companyId].selected_channels = candidate.materialization.steps.map(
      (step) => step.orchestration_channel,
    )
    map[companyId].materialization_steps = candidate.materialization.steps
  }

  return map
}

export async function materializeApollo25CompanyPilotCohortAssets(
  admin: SupabaseClient,
  input: {
    cohort_id: string
    acting_user_id: string
    acting_user_email: string
  },
): Promise<Apollo25CompanyPilotAssetMaterializationReport> {
  const loaded = await loadApolloPilotCohort(admin, input.cohort_id)
  if (!loaded) throw new Error("cohort_not_found")

  const rawSnapshot =
    parseApollo25CompanyPilotCohortSnapshotFromMetadata(loaded.cohort.metadata) ??
    (() => {
      const companies = snapshotCompaniesFromCohortCompanyRows(loaded.companies)
      if (companies.length === 0) throw new Error("cohort_snapshot_missing")
      return {
        qa_marker: APOLLO_25_COMPANY_PILOT_COHORT_SNAPSHOT_QA_MARKER,
        snapshot_id: asString(loaded.cohort.metadata.snapshot_id) || input.cohort_id,
        generated_at: loaded.cohort.created_at,
        pilot_selection_mode: "greenfield" as const,
        target_size: loaded.cohort.target_company_count,
        cohort_size: companies.length,
        production_qualification_threshold: 70,
        immutable: true as const,
        companies,
      }
    })()
  const snapshot = ensureApollo25CompanyPilotCanonicalUniqueSnapshot(rawSnapshot)
  const canonical_dedupe = snapshot.canonical_dedupe
  const materializedCanonicalIds = new Set<string>()

  const execution_id = randomUUID()
  logGrowthEngine("apollo_25_pilot_asset_materialization_started", {
    cohort_id: input.cohort_id,
    execution_id,
    cohort_size: snapshot.cohort_size,
  })

  const companies: Apollo25CompanyPilotAssetMaterializationCompanyResult[] = []
  for (const snapshotCompany of snapshot.companies) {
    try {
      companies.push(
        await materializeApollo25CompanyPilotCompanyAssets(admin, {
          snapshot_company: snapshotCompany,
          acting_user_id: input.acting_user_id,
          acting_user_email: input.acting_user_email,
          execution_id,
          canonical_dedupe,
          materialized_canonical_company_ids: materializedCanonicalIds,
        }),
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logGrowthEngine("apollo_25_pilot_asset_materialization_company_failed", {
        cohort_id: input.cohort_id,
        execution_id,
        company_candidate_id: snapshotCompany.company_candidate_id,
        error: message,
      })
      companies.push({
        company_candidate_id: snapshotCompany.company_candidate_id,
        company_name: snapshotCompany.company_name,
        ready: false,
        blockers: [`materialization_error:${message}`],
        artifacts: {
          account_playbook: false,
          personalization: false,
          content_quality_optimization: false,
          voice_drop_assets: false,
          email_assets: false,
          sms_assets: false,
        },
        stage_ids: {
          enrollment_candidate_id: null,
          account_playbook_id: null,
          voice_drop_candidate_id: null,
          multichannel_sequence_candidate_id: null,
          sequence_execution_candidate_id: null,
          growth_lead_id: null,
        },
      })
    }
  }

  const { buildApollo25CompanyPilotSelectionInputs } = await import(
    "@/lib/growth/apollo/apollo-25-company-pilot-route"
  )
  const selection_inputs = await buildApollo25CompanyPilotSelectionInputs(admin)
  const materialization_by_company = await loadPilotPersonalizationMaterializationByCompany(
    admin,
    snapshot.companies.map((row) => row.company_candidate_id),
  )

  const review = buildApollo25CompanyPilotCohortReview({
    selection_inputs,
    snapshot,
    cohort_id: input.cohort_id,
    cohort_name: loaded.cohort.cohort_name,
    cohort_status: loaded.cohort.status,
    materialization_by_company,
  })

  const canonical_dedupe_audit = buildApollo25CompanyPilotCanonicalDedupeAudit({
    snapshot_companies: snapshot.companies,
  })

  const companies_ready = companies.filter((row) => row.ready).length
  const companies_processed = companies.length

  const now = new Date().toISOString()
  await admin
    .schema("growth")
    .from("apollo_pilot_cohorts")
    .update({
      updated_at: now,
      metadata: {
        ...loaded.cohort.metadata,
        canonical_cohort_dedupe_v14_2g_1: snapshot.canonical_dedupe ?? null,
        pilot_asset_materialization_v14_2g: {
          execution_id,
          materialized_at: now,
          companies_processed,
          companies_ready,
          readiness_pct: review.personalization.readiness_pct,
          ready_for_launch: review.launch_recommendation.ready_for_launch,
          canonical_company_count: review.canonical_company_count,
          duplicate_canonical_companies: review.duplicate_canonical_companies,
        },
      },
    })
    .eq("id", input.cohort_id)

  logGrowthEngine("apollo_25_pilot_asset_materialization_completed", {
    cohort_id: input.cohort_id,
    execution_id,
    companies_ready,
    companies_processed,
    ready_for_launch: review.launch_recommendation.ready_for_launch,
  })

  return {
    qa_marker: APOLLO_25_COMPANY_PILOT_ASSET_MATERIALIZATION_QA_MARKER,
    cohort_id: input.cohort_id,
    execution_id,
    companies_processed,
    companies_ready,
    readiness_pct:
      companies_processed > 0 ? Math.round((companies_ready / companies_processed) * 100) : 0,
    companies,
    canonical_dedupe_audit,
    review,
    no_outreach_side_effects: true,
    no_sequence_execution: true,
  }
}
