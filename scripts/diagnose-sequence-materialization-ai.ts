/**
 * Sequence-Materialization-1 — AI draft generation diagnostics.
 * Run: pnpm diagnose:sequence-materialization-ai
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

const HENRY_SCHEIN_LEAD_ID = "7bf7a767-ef0f-4441-af6e-d0f3ffa81d56"
const HENRY_SCHEIN_ENROLLMENT_ID = "d5fa5558-08ff-4504-ab55-a925e26e6c29"

type EnvDiagnostic = {
  GROWTH_ENGINE_AI_ORG_ID: { present: boolean; valid_uuid: boolean; value_prefix: string | null }
  OPENAI_API_KEY: { present: boolean }
  GROWTH_ENGINE_ENABLED: { present: boolean; value: string | null }
  NODE_ENV: string | null
  VERCEL_ENV: string | null
}

function envDiagnostic(): EnvDiagnostic {
  const rawOrg = process.env.GROWTH_ENGINE_AI_ORG_ID?.trim() ?? ""
  const orgParsed = z.string().uuid().safeParse(rawOrg)
  const openai = Boolean(process.env.OPENAI_API_KEY?.trim())
  return {
    GROWTH_ENGINE_AI_ORG_ID: {
      present: Boolean(rawOrg),
      valid_uuid: orgParsed.success,
      value_prefix: rawOrg ? `${rawOrg.slice(0, 8)}…` : null,
    },
    OPENAI_API_KEY: { present: openai },
    GROWTH_ENGINE_ENABLED: {
      present: Boolean(process.env.GROWTH_ENGINE_ENABLED?.trim()),
      value: process.env.GROWTH_ENGINE_ENABLED?.trim() ?? null,
    },
    NODE_ENV: process.env.NODE_ENV ?? null,
    VERCEL_ENV: process.env.VERCEL_ENV ?? null,
  }
}

async function loadCopilotSettings(admin: SupabaseClient) {
  const { data, error } = await admin
    .schema("growth")
    .from("copilot_settings")
    .select("ai_copilot_enabled, ai_copilot_default_prompt_variant, updated_at")
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

async function loadEnrollmentBundle(admin: SupabaseClient, enrollmentId: string) {
  const { data: enrollment, error: enrollmentError } = await admin
    .schema("growth")
    .from("sequence_enrollments")
    .select("id, lead_id, status, sequence_pattern_id, started_at, created_at")
    .eq("id", enrollmentId)
    .maybeSingle()
  if (enrollmentError) throw new Error(enrollmentError.message)

  const { data: steps, error: stepsError } = await admin
    .schema("growth")
    .from("sequence_enrollment_steps")
    .select("id, step_order, channel, status, generation_id, scheduled_for")
    .eq("enrollment_id", enrollmentId)
    .order("step_order", { ascending: true })
  if (stepsError) throw new Error(stepsError.message)

  const { data: pattern } = await admin
    .schema("growth")
    .from("sequence_patterns")
    .select("id, key, label")
    .eq("id", enrollment?.sequence_pattern_id ?? "")
    .maybeSingle()

  return { enrollment, steps: steps ?? [], pattern }
}

async function findNativeMaterializationSamples(admin: SupabaseClient) {
  const { data: apolloLeadIds } = await admin
    .schema("growth")
    .from("apollo_primary_contact_enrollment_drafts")
    .select("growth_lead_id")
    .not("growth_lead_id", "is", null)

  const apolloSet = new Set((apolloLeadIds ?? []).map((row) => row.growth_lead_id as string))

  const { data: materializedSteps, error } = await admin
    .schema("growth")
    .from("sequence_enrollment_steps")
    .select("id, enrollment_id, lead_id, step_order, channel, status, generation_id, updated_at")
    .eq("status", "draft_created")
    .not("generation_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(25)
  if (error) throw new Error(error.message)

  const native = (materializedSteps ?? []).filter((step) => !apolloSet.has(step.lead_id as string))
  const apollo = (materializedSteps ?? []).filter((step) => apolloSet.has(step.lead_id as string))

  const { data: pendingActiveEmailSteps, error: pendingError } = await admin
    .schema("growth")
    .from("sequence_enrollment_steps")
    .select("id, enrollment_id, lead_id, step_order, channel, status, updated_at")
    .eq("status", "pending")
    .eq("channel", "email")
    .order("updated_at", { ascending: false })
    .limit(15)
  if (pendingError) throw new Error(pendingError.message)

  const pendingEnrollments = new Set<string>()
  for (const step of pendingActiveEmailSteps ?? []) {
    const { data: enr } = await admin
      .schema("growth")
      .from("sequence_enrollments")
      .select("status")
      .eq("id", step.enrollment_id as string)
      .maybeSingle()
    if (enr?.status === "active") pendingEnrollments.add(step.enrollment_id as string)
  }

  return {
    total_draft_created_with_generation: materializedSteps?.length ?? 0,
    apollo_materialized_count: apollo.length,
    native_materialized_count: native.length,
    native_samples: native.slice(0, 5).map((row) => ({
      step_id: row.id,
      enrollment_id: row.enrollment_id,
      lead_id: row.lead_id,
      step_order: row.step_order,
      updated_at: row.updated_at,
    })),
    apollo_samples: apollo.slice(0, 5),
    active_enrollments_with_pending_email_step: pendingEnrollments.size,
    pending_email_step_samples: (pendingActiveEmailSteps ?? [])
      .filter((step) => pendingEnrollments.has(step.enrollment_id as string))
      .slice(0, 5),
  }
}

async function runProviderDiagnostics(admin: SupabaseClient, leadId: string) {
  const { getGrowthEngineAiOrgId } = await import("../lib/growth/access")
  const { getGrowthAiProvider } = await import("../lib/growth/ai-copilot-provider")
  const { fetchGrowthCopilotSettings } = await import("../lib/growth/ai-copilot-repository")
  const { runGrowthAiCopilotGeneration } = await import("../lib/growth/run-ai-copilot-generation")

  const settings = await fetchGrowthCopilotSettings(admin)
  const provider = getGrowthAiProvider()
  const health = await provider.health()
  const resolvedOrgId = getGrowthEngineAiOrgId()

  const { data: actingProfile } = await admin
    .from("profiles")
    .select("id, email")
    .ilike("email", "%blitz%")
    .limit(1)
    .maybeSingle()

  const actingUserId = actingProfile?.id ?? "631caf46-ff1d-4c12-a8aa-7c7c8953e9e4"
  const actingUserEmail = actingProfile?.email ?? "sequence-materialization-1@equipify.internal"

  let generationAttempt: Record<string, unknown> | null = null
  if (settings.aiCopilotEnabled && health.ok) {
    const result = await runGrowthAiCopilotGeneration({
      admin,
      leadId,
      generationType: "follow_up_email",
      actingUserId,
      actingUserEmail,
    })
    generationAttempt = result.ok
      ? {
          ok: true,
          generation_id: result.generation.id,
          status: result.generation.status,
          generation_type: result.generation.generationType,
        }
      : { ok: false, code: result.code, message: result.message }
  }

  return {
    copilot_settings: {
      ai_copilot_enabled: settings.aiCopilotEnabled,
      default_prompt_variant: settings.aiCopilotDefaultPromptVariant,
    },
    provider: {
      id: provider.id,
      health,
      resolved_org_id: resolvedOrgId,
    },
    generation_attempt: generationAttempt,
    blocked_before_generation: !settings.aiCopilotEnabled
      ? "copilot_disabled"
      : !health.ok
        ? "ai_not_configured"
        : null,
  }
}

async function runMaterializeAttempt(admin: SupabaseClient, enrollmentId: string) {
  const { materializeGrowthSequenceEnrollmentStep } = await import(
    "../lib/growth/sequence-enrollment/sequence-enrollment-orchestrator"
  )

  const { data: actingProfile } = await admin
    .from("profiles")
    .select("id, email")
    .ilike("email", "%blitz%")
    .limit(1)
    .maybeSingle()

  const actingUserId = actingProfile?.id ?? "631caf46-ff1d-4c12-a8aa-7c7c8953e9e4"
  const actingUserEmail = actingProfile?.email ?? "sequence-materialization-1@equipify.internal"

  try {
    await materializeGrowthSequenceEnrollmentStep(admin, {
      enrollmentId,
      stepOrder: 1,
      actingUserId,
      actingUserEmail,
    })
    return { ok: true as const }
  } catch (error) {
    return {
      ok: false as const,
      code: error instanceof Error ? error.message : String(error),
    }
  }
}

function classifyRootCause(input: {
  env: EnvDiagnostic
  providerHealth: { ok: boolean; message?: string }
  copilotEnabled: boolean
}): string {
  if (!input.copilotEnabled) return "disabled_flag"
  if (!input.env.GROWTH_ENGINE_AI_ORG_ID.present) return "missing_env"
  if (input.env.GROWTH_ENGINE_AI_ORG_ID.present && !input.env.GROWTH_ENGINE_AI_ORG_ID.valid_uuid) {
    return "invalid_env_value"
  }
  if (!input.providerHealth.ok) {
    const message = input.providerHealth.message ?? ""
    if (/GROWTH_ENGINE_AI_ORG_ID/i.test(message)) return "missing_env"
    return "provider_health_failure"
  }
  return "unknown"
}

const boot = bootstrapVerifiedChannelsCertEnv()
if (!boot) {
  console.error(JSON.stringify({ ok: false, error: "Supabase credentials unavailable." }))
  process.exit(1)
}

async function main(): Promise<void> {
  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const env = envDiagnostic()
  const copilotRow = await loadCopilotSettings(admin)
  const henryBundle = await loadEnrollmentBundle(admin, HENRY_SCHEIN_ENROLLMENT_ID)
  const nativeComparison = await findNativeMaterializationSamples(admin)
  const providerDiagnostics = await runProviderDiagnostics(admin, HENRY_SCHEIN_LEAD_ID)
  const materializeAttempt = await runMaterializeAttempt(admin, HENRY_SCHEIN_ENROLLMENT_ID)
  const henryAfter = await loadEnrollmentBundle(admin, HENRY_SCHEIN_ENROLLMENT_ID)

  const rootCause = classifyRootCause({
    env,
    providerHealth: providerDiagnostics.provider.health,
    copilotEnabled: providerDiagnostics.copilot_settings.ai_copilot_enabled,
  })

  const globalIssue =
    nativeComparison.native_materialized_count > 0 && henryBundle.steps[0]?.status === "pending"
      ? "apollo_and_cli_env_issue"
      : nativeComparison.native_materialized_count === 0 &&
          nativeComparison.active_enrollments_with_pending_email_step > 0
        ? "global_issue"
        : nativeComparison.native_materialized_count > 0
          ? "cli_env_only"
          : "global_or_untested"

  let certification: "PASS" | "PASS_PARTIAL" | "FAIL" = "FAIL"
  const henryStepStatus = henryAfter.steps[0]?.status
  const henryMaterialized = henryStepStatus === "draft_created" || henryStepStatus === "queued"

  if (henryMaterialized && providerDiagnostics.provider.health.ok) {
    certification = "PASS"
  } else if (rootCause === "missing_env" && nativeComparison.native_materialized_count > 0) {
    certification = "PASS_PARTIAL"
  } else if (providerDiagnostics.provider.health.ok && henryStepStatus === "pending") {
    certification = "PASS_PARTIAL"
  } else if (henryMaterialized) {
    certification = "PASS_PARTIAL"
  }

  const payload = {
    ok: certification !== "FAIL",
    qa_marker: "sequence-materialization-ai-v1",
    certification,
    root_cause: rootCause,
    root_cause_detail: providerDiagnostics.provider.health.message ?? null,
    scope: globalIssue,
    env,
    copilot_db_settings: copilotRow,
    henry_schein: {
      lead_id: HENRY_SCHEIN_LEAD_ID,
      enrollment_id: HENRY_SCHEIN_ENROLLMENT_ID,
      before: henryBundle,
      materialize_attempt: materializeAttempt,
      after: henryAfter,
    },
    provider_diagnostics: providerDiagnostics,
    native_comparison: nativeComparison,
    fix_recommendation:
      rootCause === "missing_env"
        ? "Set GROWTH_ENGINE_AI_ORG_ID to a valid org UUID in the runtime environment (Vercel Production + local cert scripts). OPENAI_API_KEY alone is insufficient — materialization routes through GrowthEngineAiProvider → runAiTask which requires org scoping."
        : rootCause === "disabled_flag"
          ? "Enable ai_copilot_enabled in growth.growth_copilot_settings."
          : "Investigate provider health message and runAiTask configuration.",
  }

  console.log(JSON.stringify(payload, null, 2))
  if (certification === "FAIL") process.exit(1)
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  process.exit(1)
})
