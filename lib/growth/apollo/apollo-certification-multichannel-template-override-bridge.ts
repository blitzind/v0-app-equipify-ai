/** Apollo Full Pipeline Certification — multichannel template override bridge (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { ApolloChannelAvailability } from "@/lib/growth/apollo/apollo-voice-drop-automation-types"
import {
  buildApolloCertificationMultichannelTemplateOverrideEvidence,
  countMaterializableSequenceStepsFromChannelOrder,
  countMaterializableSequenceStepsFromSchedulingPlan,
  evaluateApolloCertificationTemplateSelection,
  inferApolloCertificationChannelAvailability,
  needsApolloCertificationMultichannelTemplateOverride,
  type ApolloCertificationMultichannelTemplateOverrideEvidence,
} from "@/lib/growth/apollo/apollo-certification-multichannel-template-override"
import { mapApolloMultichannelSequenceCandidateDbRow } from "@/lib/growth/apollo/apollo-multichannel-orchestration-evidence"
import { APOLLO_MULTICHANNEL_ORCHESTRATION_QA_MARKER } from "@/lib/growth/apollo/apollo-multichannel-orchestration-types"
import {
  buildApolloMultichannelSchedulingPlan,
  formatSchedulingPlanSummary,
} from "@/lib/growth/apollo/apollo-multichannel-scheduling-layer"

const TABLE = "apollo_multichannel_sequence_candidates"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function mergeChannelAvailability(
  base: ApolloChannelAvailability,
  overlay?: ApolloChannelAvailability | null,
): ApolloChannelAvailability {
  if (!overlay) return base
  return {
    verified_email: base.verified_email || overlay.verified_email,
    phone: base.phone || overlay.phone,
    mobile_phone: base.mobile_phone || overlay.mobile_phone,
    sms_capable: base.sms_capable || overlay.sms_capable,
    voice_drop_capable: base.voice_drop_capable || overlay.voice_drop_capable,
    linkedin: base.linkedin || overlay.linkedin,
  }
}

export async function applyApolloCertificationMultichannelTemplateOverride(
  admin: SupabaseClient,
  input: {
    candidate_id: string
    email?: string | null
    phone?: string | null
    sequence_ready_contact?: boolean
    verified_email_contact?: boolean
    channel_availability_overlay?: ApolloChannelAvailability | null
    prior_outreach_count?: number
    preferred_keys?: readonly string[]
  },
): Promise<{
  ok: boolean
  candidate_id: string
  evidence: ApolloCertificationMultichannelTemplateOverrideEvidence
}> {
  const { data, error } = await admin
    .schema("growth")
    .from(TABLE)
    .select("*")
    .eq("id", input.candidate_id)
    .maybeSingle()

  if (error || !data) {
    return {
      ok: false,
      candidate_id: input.candidate_id,
      evidence: buildApolloCertificationMultichannelTemplateOverrideEvidence({
        override_used: false,
        original_sequence_key: null,
        materialized_sequence_key: null,
        materializable_steps_before: 0,
        materializable_steps_after: 0,
        blockers: [error?.message ?? "multichannel_candidate_not_found"],
      }),
    }
  }

  const row = mapApolloMultichannelSequenceCandidateDbRow(data as Record<string, unknown>)
  const originalKey = row.sequence_template.sequence_key
  const originalLabel = row.sequence_template.sequence_label
  const stepsBefore = countMaterializableSequenceStepsFromSchedulingPlan(row.scheduling_plan)

  const resolvedEmail =
    asString(input.email) || asString(row.email) || null
  const resolvedPhone =
    asString(input.phone) || asString(row.phone) || null

  const storedAvailability = mergeChannelAvailability(
    row.channel_availability,
    input.channel_availability_overlay,
  )

  const availability = inferApolloCertificationChannelAvailability({
    stored: storedAvailability,
    email: resolvedEmail,
    phone: resolvedPhone,
    sequence_ready_contact: input.sequence_ready_contact,
    verified_email_contact: input.verified_email_contact,
  })

  const selection = evaluateApolloCertificationTemplateSelection({
    availability,
    preferred_keys: input.preferred_keys,
  })
  const overrideTemplate = selection.template

  if (
    !needsApolloCertificationMultichannelTemplateOverride({
      sequence_key: originalKey,
      scheduling_plan: row.scheduling_plan,
    })
  ) {
    return {
      ok: true,
      candidate_id: input.candidate_id,
      evidence: buildApolloCertificationMultichannelTemplateOverrideEvidence({
        override_used: false,
        original_sequence_key: originalKey,
        materialized_sequence_key: originalKey,
        original_sequence_label: originalLabel,
        materialized_sequence_label: originalLabel,
        materializable_steps_before: stepsBefore,
        materializable_steps_after: stepsBefore,
        selection,
      }),
    }
  }

  if (
    !overrideTemplate ||
    countMaterializableSequenceStepsFromChannelOrder(overrideTemplate.channel_order) === 0
  ) {
    return {
      ok: false,
      candidate_id: input.candidate_id,
      evidence: buildApolloCertificationMultichannelTemplateOverrideEvidence({
        override_used: false,
        original_sequence_key: originalKey,
        materialized_sequence_key: null,
        original_sequence_label: originalLabel,
        materializable_steps_before: stepsBefore,
        materializable_steps_after: 0,
        blockers: ["no_materializable_sequence_template"],
        selection,
      }),
    }
  }

  const schedulingPlan = buildApolloMultichannelSchedulingPlan({
    channel_order: overrideTemplate.channel_order,
    prior_outreach_count: input.prior_outreach_count ?? 0,
  })
  const stepsAfter = countMaterializableSequenceStepsFromSchedulingPlan(schedulingPlan)
  const now = new Date().toISOString()
  const priorMetadata =
    data.metadata && typeof data.metadata === "object"
      ? (data.metadata as Record<string, unknown>)
      : {}

  const evidence = buildApolloCertificationMultichannelTemplateOverrideEvidence({
    override_used: true,
    original_sequence_key: originalKey,
    materialized_sequence_key: overrideTemplate.sequence_key,
    original_sequence_label: originalLabel,
    materialized_sequence_label: overrideTemplate.sequence_label,
    materializable_steps_before: stepsBefore,
    materializable_steps_after: stepsAfter,
    selection,
  })

  const { error: updateError } = await admin
    .schema("growth")
    .from(TABLE)
    .update({
      sequence_template: overrideTemplate,
      scheduling_plan: schedulingPlan,
      orchestration_result: {
        ...row.orchestration_result,
        recommended_sequence: overrideTemplate.sequence_label,
        channel_order: overrideTemplate.channel_order,
        reasoning: `${row.orchestration_result.reasoning} Certification override applied: ${originalKey} → ${overrideTemplate.sequence_key}.`,
      },
      operator_summary: {
        ...row.operator_summary,
        recommended_sequence: overrideTemplate.sequence_label,
        scheduling_summary: formatSchedulingPlanSummary(schedulingPlan),
        why_selected: `Certification materialization override — ${overrideTemplate.recommendation_reason}`,
      },
      outreach_sent: false,
      voice_drop_sent: false,
      draft_created: false,
      jobs_scheduled: false,
      updated_at: now,
      metadata: {
        ...priorMetadata,
        qa_marker: APOLLO_MULTICHANNEL_ORCHESTRATION_QA_MARKER,
        certification_template_override: evidence,
        certification_template_override_at: now,
      },
    })
    .eq("id", input.candidate_id)

  if (updateError) {
    return {
      ok: false,
      candidate_id: input.candidate_id,
      evidence: buildApolloCertificationMultichannelTemplateOverrideEvidence({
        override_used: false,
        original_sequence_key: originalKey,
        materialized_sequence_key: overrideTemplate.sequence_key,
        original_sequence_label: originalLabel,
        materialized_sequence_label: overrideTemplate.sequence_label,
        materializable_steps_before: stepsBefore,
        materializable_steps_after: stepsAfter,
        blockers: [updateError.message],
        selection,
      }),
    }
  }

  return {
    ok: true,
    candidate_id: input.candidate_id,
    evidence,
  }
}
