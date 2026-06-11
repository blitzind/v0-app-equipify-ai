/** Apollo pipeline growth_lead_id resolution + backfill — server-only, no outreach. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  loadApolloEnrollmentCompanyContactRow,
  resolveOrCreateLeadForEnrollmentCandidate,
} from "@/lib/growth/apollo/apollo-enrollment-growth-lead-resolution"
import {
  buildApolloPipelineGrowthLeadResolutionEvidence,
  resolveApolloPipelineGrowthLeadIdFromChain,
  type ApolloPipelineGrowthLeadResolutionEvidence,
  type ApolloPipelineGrowthLeadSource,
} from "@/lib/growth/apollo/apollo-pipeline-growth-lead-resolution-evidence"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function rowGrowthLeadId(row: Record<string, unknown> | null | undefined): string | null {
  return asString(row?.growth_lead_id) || null
}

function rowMetadata(row: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!row?.metadata || typeof row.metadata !== "object") return {}
  return row.metadata as Record<string, unknown>
}

async function backfillGrowthLeadIdOnRow(
  admin: SupabaseClient,
  input: {
    table: string
    id: string
    growth_lead_id: string
  },
): Promise<boolean> {
  const { error } = await admin
    .schema("growth")
    .from(input.table)
    .update({
      growth_lead_id: input.growth_lead_id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .is("growth_lead_id", null)

  return !error
}

export async function resolveAndBackfillApolloPipelineGrowthLeadForSequenceExecution(
  admin: SupabaseClient,
  input: {
    enrollment_candidate_id: string
    company_candidate_id: string
    company_contact_id?: string | null
    voice_drop_candidate_id?: string | null
    multichannel_sequence_candidate_id?: string | null
    created_by_user_id?: string | null
    enrollment_row?: Record<string, unknown> | null
    account_playbook_row?: Record<string, unknown> | null
    voice_drop_row?: Record<string, unknown> | null
    multichannel_row?: Record<string, unknown> | null
  },
): Promise<
  ApolloPipelineGrowthLeadResolutionEvidence & {
    growth_lead_id: string | null
  }
> {
  const blockers: string[] = []
  const backfilledRows: string[] = []

  const enrollmentRow =
    input.enrollment_row ??
    (
      await admin
        .schema("growth")
        .from("apollo_enrollment_candidates")
        .select("*")
        .eq("id", input.enrollment_candidate_id)
        .maybeSingle()
    ).data as Record<string, unknown> | null

  const accountPlaybookRow =
    input.account_playbook_row ??
    (
      await admin
        .schema("growth")
        .from("apollo_account_playbooks")
        .select("*")
        .eq("enrollment_candidate_id", input.enrollment_candidate_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    ).data as Record<string, unknown> | null

  let voiceDropRow = input.voice_drop_row ?? null
  if (!voiceDropRow) {
    if (input.voice_drop_candidate_id) {
      const { data } = await admin
        .schema("growth")
        .from("apollo_voice_drop_candidates")
        .select("*")
        .eq("id", input.voice_drop_candidate_id)
        .maybeSingle()
      voiceDropRow = (data as Record<string, unknown> | null) ?? null
    } else {
      const { data } = await admin
        .schema("growth")
        .from("apollo_voice_drop_candidates")
        .select("*")
        .eq("enrollment_candidate_id", input.enrollment_candidate_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      voiceDropRow = (data as Record<string, unknown> | null) ?? null
    }
  }

  let multichannelRow = input.multichannel_row ?? null
  if (!multichannelRow) {
    if (input.multichannel_sequence_candidate_id) {
      const { data } = await admin
        .schema("growth")
        .from("apollo_multichannel_sequence_candidates")
        .select("*")
        .eq("id", input.multichannel_sequence_candidate_id)
        .maybeSingle()
      multichannelRow = (data as Record<string, unknown> | null) ?? null
    } else if (voiceDropRow?.id) {
      const { data } = await admin
        .schema("growth")
        .from("apollo_multichannel_sequence_candidates")
        .select("*")
        .eq("voice_drop_candidate_id", asString(voiceDropRow.id))
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      multichannelRow = (data as Record<string, unknown> | null) ?? null
    }
  }

  const companyContactId =
    asString(input.company_contact_id) ||
    asString(enrollmentRow?.company_contact_id) ||
    asString(accountPlaybookRow?.company_contact_id) ||
    asString(voiceDropRow?.company_contact_id) ||
    asString(multichannelRow?.company_contact_id) ||
    null

  let companyContactGrowthLeadId: string | null = null
  if (companyContactId) {
    const companyContact = await loadApolloEnrollmentCompanyContactRow(admin, companyContactId)
    companyContactGrowthLeadId = companyContact?.growth_lead_id ?? null
  }

  const chain = resolveApolloPipelineGrowthLeadIdFromChain({
    enrollment_growth_lead_id: rowGrowthLeadId(enrollmentRow),
    account_playbook_growth_lead_id: rowGrowthLeadId(accountPlaybookRow),
    voice_drop_growth_lead_id: rowGrowthLeadId(voiceDropRow),
    multichannel_growth_lead_id: rowGrowthLeadId(multichannelRow),
    multichannel_metadata: rowMetadata(multichannelRow),
    source_attribution:
      (multichannelRow?.source_attribution as Record<string, unknown> | undefined) ??
      (voiceDropRow?.source_attribution as Record<string, unknown> | undefined) ??
      (accountPlaybookRow?.source_attribution as Record<string, unknown> | undefined) ??
      (enrollmentRow?.source_attribution as Record<string, unknown> | undefined) ??
      null,
    company_contact_growth_lead_id: companyContactGrowthLeadId,
  })

  const growthLeadIdBefore = chain.growth_lead_id
  let growthLeadIdAfter = chain.growth_lead_id
  let source: ApolloPipelineGrowthLeadSource | null = chain.source

  if (!growthLeadIdAfter) {
    const companyCandidateId =
      asString(input.company_candidate_id) ||
      asString(enrollmentRow?.company_candidate_id) ||
      asString(accountPlaybookRow?.company_candidate_id) ||
      null

    if (!companyContactId || !companyCandidateId) {
      blockers.push("growth_lead_id_unresolvable:missing_company_contact")
    } else {
      const created = await resolveOrCreateLeadForEnrollmentCandidate(admin, {
        company_candidate_id: companyCandidateId,
        company_contact_id: companyContactId,
        candidate_id: input.enrollment_candidate_id,
        created_by: input.created_by_user_id ?? null,
        source_detail: "apollo_sequence_execution_automation",
      })

      if (!created.ok) {
        blockers.push(`growth_lead_id_unresolvable:${created.code}`)
      } else {
        growthLeadIdAfter = created.lead_id
        source = "created_for_sequence_execution"
      }
    }
  }

  if (growthLeadIdAfter) {
    if (
      enrollmentRow?.id &&
      !rowGrowthLeadId(enrollmentRow) &&
      (await backfillGrowthLeadIdOnRow(admin, {
        table: "apollo_enrollment_candidates",
        id: asString(enrollmentRow.id),
        growth_lead_id: growthLeadIdAfter,
      }))
    ) {
      backfilledRows.push("apollo_enrollment_candidates")
    }

    if (
      accountPlaybookRow?.id &&
      !rowGrowthLeadId(accountPlaybookRow) &&
      (await backfillGrowthLeadIdOnRow(admin, {
        table: "apollo_account_playbooks",
        id: asString(accountPlaybookRow.id),
        growth_lead_id: growthLeadIdAfter,
      }))
    ) {
      backfilledRows.push("apollo_account_playbooks")
    }

    if (
      voiceDropRow?.id &&
      !rowGrowthLeadId(voiceDropRow) &&
      (await backfillGrowthLeadIdOnRow(admin, {
        table: "apollo_voice_drop_candidates",
        id: asString(voiceDropRow.id),
        growth_lead_id: growthLeadIdAfter,
      }))
    ) {
      backfilledRows.push("apollo_voice_drop_candidates")
    }

    if (
      multichannelRow?.id &&
      !rowGrowthLeadId(multichannelRow) &&
      (await backfillGrowthLeadIdOnRow(admin, {
        table: "apollo_multichannel_sequence_candidates",
        id: asString(multichannelRow.id),
        growth_lead_id: growthLeadIdAfter,
      }))
    ) {
      backfilledRows.push("apollo_multichannel_sequence_candidates")
    }
  }

  const evidence = buildApolloPipelineGrowthLeadResolutionEvidence({
    attempted: true,
    source,
    growth_lead_id_before: growthLeadIdBefore,
    growth_lead_id_after: growthLeadIdAfter,
    backfilled_rows: backfilledRows,
    blockers,
  })

  return {
    ...evidence,
    growth_lead_id: growthLeadIdAfter,
  }
}
