import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  insertGrowthSequenceEnrollment,
  insertGrowthSequenceEnrollmentStep,
} from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"

export const SR3_PHASE2_CONDITION_CERT_PATTERN_KEY = "sr3-phase2-condition-cert" as const
export const SR3_PHASE2_CONDITION_CERT_MARKER = "sr3-phase2-condition-cert-fixture" as const

export type SequenceConditionCertFixture = {
  patternId: string
  patternStepId: string
  enrollmentId: string
  enrollmentStepId: string
  leadId: string
  created: boolean
}

async function ensureCertInboxThreadForLead(
  admin: SupabaseClient,
  leadId: string,
): Promise<void> {
  const { data: existing } = await admin
    .schema("growth")
    .from("inbox_threads")
    .select("id")
    .eq("lead_id", leadId)
    .limit(1)
    .maybeSingle()

  if (existing?.id) return

  await admin.schema("growth").from("inbox_threads").insert({
    lead_id: leadId,
    subject: SR3_PHASE2_CONDITION_CERT_MARKER,
    provider_family: "custom",
  })
}

export async function ensureSequenceConditionCertFixture(
  admin: SupabaseClient,
): Promise<SequenceConditionCertFixture | null> {
  const existingPattern = await admin
    .schema("growth")
    .from("sequence_patterns")
    .select("id")
    .eq("key", SR3_PHASE2_CONDITION_CERT_PATTERN_KEY)
    .maybeSingle()

  let patternId = existingPattern.data?.id as string | undefined

  if (!patternId) {
    const { data: createdPattern, error: patternError } = await admin
      .schema("growth")
      .from("sequence_patterns")
      .insert({
        key: SR3_PHASE2_CONDITION_CERT_PATTERN_KEY,
        label: "SR-3 Phase 2 condition cert fixture",
        description: SR3_PHASE2_CONDITION_CERT_MARKER,
        pattern_kind: "catalog",
        is_active: true,
      })
      .select("id")
      .single()

    if (patternError) return null
    patternId = createdPattern.id as string
  }

  const { data: patternStep, error: stepError } = await admin
    .schema("growth")
    .from("sequence_pattern_steps")
    .select("id")
    .eq("pattern_id", patternId)
    .order("step_order", { ascending: true })
    .limit(1)
    .maybeSingle()

  let patternStepId = patternStep?.id as string | undefined
  if (!patternStepId) {
    const { data: createdStep, error: createStepError } = await admin
      .schema("growth")
      .from("sequence_pattern_steps")
      .insert({
        pattern_id: patternId,
        step_order: 1,
        channel: "email",
        delay_days_min: 0,
        delay_days_max: 0,
        required_human_approval: true,
      })
      .select("id")
      .single()

    if (createStepError) return null
    patternStepId = createdStep.id as string
  }

  const existingEnrollment = await admin
    .schema("growth")
    .from("sequence_enrollments")
    .select("id, lead_id")
    .eq("sequence_pattern_id", patternId)
    .eq("metadata->>cert_marker", SR3_PHASE2_CONDITION_CERT_MARKER)
    .maybeSingle()

  if (existingEnrollment.data?.id) {
    const enrollmentStep = await admin
      .schema("growth")
      .from("sequence_enrollment_steps")
      .select("id")
      .eq("enrollment_id", existingEnrollment.data.id)
      .limit(1)
      .maybeSingle()

    if (enrollmentStep.data?.id) {
      const leadId = existingEnrollment.data.lead_id as string
      await ensureCertInboxThreadForLead(admin, leadId)
      return {
        patternId,
        patternStepId,
        enrollmentId: existingEnrollment.data.id as string,
        enrollmentStepId: enrollmentStep.data.id as string,
        leadId,
        created: false,
      }
    }
  }

  const { data: lead, error: leadError } = await admin
    .schema("growth")
    .from("leads")
    .select("id")
    .limit(1)
    .maybeSingle()

  if (leadError || !lead?.id) return null

  const enrollment = await insertGrowthSequenceEnrollment(admin, {
    leadId: lead.id as string,
    sequencePatternId: patternId,
    sequenceVersion: 1,
    status: "draft",
  })

  await admin
    .schema("growth")
    .from("sequence_enrollments")
    .update({ metadata: { cert_marker: SR3_PHASE2_CONDITION_CERT_MARKER } })
    .eq("id", enrollment.id)

  const enrollmentStep = await insertGrowthSequenceEnrollmentStep(admin, {
    enrollmentId: enrollment.id,
    leadId: lead.id as string,
    sequencePatternStepId: patternStepId,
    stepOrder: 1,
    channel: "email",
  })

  await ensureCertInboxThreadForLead(admin, lead.id as string)

  return {
    patternId,
    patternStepId,
    enrollmentId: enrollment.id,
    enrollmentStepId: enrollmentStep.id,
    leadId: lead.id as string,
    created: true,
  }
}
