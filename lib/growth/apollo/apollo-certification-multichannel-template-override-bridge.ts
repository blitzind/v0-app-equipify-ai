/** Apollo Full Pipeline Certification — multichannel template override bridge (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildApolloCertificationMultichannelTemplateOverrideEvidence,
  countMaterializableSequenceStepsFromChannelOrder,
  countMaterializableSequenceStepsFromSchedulingPlan,
  inferApolloCertificationChannelAvailability,
  needsApolloCertificationMultichannelTemplateOverride,
  selectApolloCertificationMaterializableSequenceTemplate,
  type ApolloCertificationMultichannelTemplateOverrideEvidence,
} from "@/lib/growth/apollo/apollo-certification-multichannel-template-override"
import { mapApolloMultichannelSequenceCandidateDbRow } from "@/lib/growth/apollo/apollo-multichannel-orchestration-evidence"
import { APOLLO_MULTICHANNEL_ORCHESTRATION_QA_MARKER } from "@/lib/growth/apollo/apollo-multichannel-orchestration-types"
import {
  buildApolloMultichannelSchedulingPlan,
  formatSchedulingPlanSummary,
} from "@/lib/growth/apollo/apollo-multichannel-scheduling-layer"

const TABLE = "apollo_multichannel_sequence_candidates"

export async function applyApolloCertificationMultichannelTemplateOverride(
  admin: SupabaseClient,
  input: {
    candidate_id: string
    email?: string | null
    phone?: string | null
    prior_outreach_count?: number
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
      }),
    }
  }

  const availability = inferApolloCertificationChannelAvailability({
    stored: row.channel_availability,
    email: input.email ?? row.email,
    phone: input.phone ?? row.phone,
  })

  const overrideTemplate = selectApolloCertificationMaterializableSequenceTemplate({
    availability,
  })

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
      }),
    }
  }

  return {
    ok: true,
    candidate_id: input.candidate_id,
    evidence,
  }
}
