/**
 * Phase 15.0D — Regenerate failed pilot drafts (Henry Schein, Ballard) in production.
 *
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/regenerate-apollo-pilot-failed-drafts-production.ts
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import { resolveApolloPilotMaterializationValidationActor } from "../lib/growth/apollo/apollo-pilot-materialization-validation-actor"

const COHORT_ID = "c04a1a26-9e22-4aa7-b1b3-025ffdfc591a"

const TARGETS = [
  {
    label: "Henry Schein",
    candidate_id: "4423d691-5213-476d-8cd2-66c6205fac26",
  },
  {
    label: "Ballard Health Medical Equipment",
    candidate_id: "b017cad6-2f81-48e5-93f9-7717e4d5e0d8",
  },
] as const

const PRODUCTION_VALIDATION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

const ACTOR = {
  user_id: process.env.GROWTH_APOLLO_PILOT_MATERIALIZE_ACTING_USER_ID ?? null,
  email: process.env.GROWTH_APOLLO_PILOT_MATERIALIZE_ACTING_USER_EMAIL ?? null,
}

async function main(): Promise<void> {
  const boot = bootstrapVerifiedChannelsCertEnv({
    sources: PRODUCTION_VALIDATION_ENV_SOURCES,
    inheritProcessEnvProviderKeys: true,
    protectedSnapshot: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      SUPABASE_URL: process.env.SUPABASE_URL ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    },
  })

  if (!boot) {
    console.error(JSON.stringify({ ok: false, error: "production_supabase_unavailable" }))
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })

  const { loadApolloPilotCohort } = await import("../lib/growth/apollo/apollo-pilot-route")
  const { regenerateApolloSequenceExecutionDrafts } = await import(
    "../lib/growth/apollo/apollo-sequence-execution-queue"
  )
  const { personalizeApolloSequenceCandidateContent } = await import(
    "../lib/growth/apollo/apollo-sequence-personalization-service"
  )
  const { mapApolloSequenceExecutionCandidateDbRow } = await import(
    "../lib/growth/apollo/apollo-sequence-execution-automation-evidence"
  )
  const { fetchGrowthLeadById } = await import("../lib/growth/lead-repository")
  const { classifyApolloSequenceDraftReadiness } = await import(
    "../lib/growth/apollo/apollo-sequence-draft-readiness"
  )
  const {
    isAutoReplyEvidence,
    isRedactedContactName,
    isUnusableOutreachMemoryEvidence,
  } = await import("../lib/growth/lead-memory/outreach-memory-evidence-guard")

  const cohort = await loadApolloPilotCohort(admin, COHORT_ID)
  if (!cohort) {
    console.error(JSON.stringify({ ok: false, error: "cohort_not_found" }))
    process.exit(1)
  }

  const actor = await resolveApolloPilotMaterializationValidationActor(admin, {
    acting_user_id: ACTOR.user_id,
    acting_user_email: ACTOR.email,
  })

  const results: Array<Record<string, unknown>> = []

  for (const target of TARGETS) {
    const regenerate = await regenerateApolloSequenceExecutionDrafts(admin, {
      candidate_id: target.candidate_id,
    })
    if (!regenerate.ok) {
      results.push({
        label: target.label,
        candidate_id: target.candidate_id,
        ok: false,
        stage: "regenerate",
        error: regenerate.error,
      })
      continue
    }

    const { data, error } = await admin
      .schema("growth")
      .from("apollo_sequence_execution_candidates")
      .select("*")
      .eq("id", target.candidate_id)
      .maybeSingle()

    if (error || !data) {
      results.push({
        label: target.label,
        candidate_id: target.candidate_id,
        ok: false,
        stage: "reload",
        error: error?.message ?? "candidate_not_found",
      })
      continue
    }

    const candidate = mapApolloSequenceExecutionCandidateDbRow(data as Record<string, unknown>)
    const lead = candidate.growth_lead_id ? await fetchGrowthLeadById(admin, candidate.growth_lead_id) : null

    const personalization = await personalizeApolloSequenceCandidateContent(admin, {
      candidate,
      acting_user_id: actor.acting_user_id,
      acting_user_email: actor.acting_user_email,
    })

    if (!personalization.ok) {
      results.push({
        label: target.label,
        candidate_id: target.candidate_id,
        ok: false,
        stage: "personalize",
        error: personalization.code,
        detail: personalization.detail,
      })
      continue
    }

    const emailDraft =
      personalization.materialization.drafts.find((draft) => draft.draft_type === "email") ??
      personalization.materialization.drafts[0]
    const readiness = emailDraft ? classifyApolloSequenceDraftReadiness(emailDraft) : null
    const subject = emailDraft?.subject_placeholder ?? null
    const body = emailDraft?.body_placeholder ?? null
    const metadata =
      data.metadata && typeof data.metadata === "object"
        ? (data.metadata as Record<string, unknown>)
        : {}

    const companyName = lead?.companyName?.trim() || candidate.company_name
    const contactName = lead?.contactName?.trim() || candidate.full_name

    await admin
      .schema("growth")
      .from("apollo_sequence_execution_candidates")
      .update({
        status: "pending_draft_approval",
        sequence_materialization: personalization.materialization,
        sequence_steps: personalization.materialization.steps,
        draft_records: personalization.materialization.drafts,
        execution_jobs: personalization.execution_jobs,
        updated_at: new Date().toISOString(),
        metadata: {
          ...metadata,
          company_name: companyName,
          full_name: contactName,
          title: candidate.title,
          draft_regenerated_at: new Date().toISOString(),
          phase_15_0d_regeneration: true,
          personalization_packet_marker: personalization.unified_context?.qa_marker ?? null,
          content_readiness_detail: personalization.readiness.detail,
        },
      })
      .eq("id", target.candidate_id)

    const validation = {
      company: companyName,
      subject,
      placeholder_content_present: body
        ? isUnusableOutreachMemoryEvidence({ evidence: body }) ||
          /\[Draft placeholder/i.test(body)
        : true,
      internal_signal_leak: body
        ? /Meeting interest detected|Automatic reply|Committee context:/i.test(body)
        : true,
      truncation_present: body
        ? /\bBallad…|\bHealth Med…|\bMedical Equip…/.test(body)
        : true,
      cta_present: body ? /\?\s*$|worth|open to|still worth|picking this up|workflow review/i.test(body) : false,
      redacted_contact: contactName ? isRedactedContactName(contactName) : true,
      auto_reply_leak: body ? isAutoReplyEvidence(body) || /\[EXTERNAL\]/i.test(body) : false,
      approve_recommendation: false,
    }

    validation.approve_recommendation =
      !validation.placeholder_content_present &&
      !validation.internal_signal_leak &&
      !validation.truncation_present &&
      !validation.auto_reply_leak &&
      !validation.redacted_contact &&
      validation.cta_present &&
      Boolean(subject && body)

    results.push({
      label: target.label,
      candidate_id: target.candidate_id,
      ok: true,
      generation_id: emailDraft?.generation_id ?? null,
      readiness_label: readiness?.readiness_label ?? null,
      validation,
      body_preview: body?.slice(0, 220) ?? null,
    })
  }

  console.log(
    JSON.stringify(
      {
        ok: results.every((row) => row.ok === true),
        cohort_id: COHORT_ID,
        regenerated_count: results.filter((row) => row.ok).length,
        results,
      },
      null,
      2,
    ),
  )

  if (!results.every((row) => row.ok === true)) process.exit(1)
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  process.exit(1)
})
