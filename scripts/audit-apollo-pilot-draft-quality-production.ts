/**
 * Phase 15.0C — First draft quality audit (read-only, no approvals).
 *
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/audit-apollo-pilot-draft-quality-production.ts
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

const COHORT_ID = "c04a1a26-9e22-4aa7-b1b3-025ffdfc591a"

const PRODUCTION_VALIDATION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

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
  const { loadApolloSequenceExecutionQueue } = await import(
    "../lib/growth/apollo/apollo-sequence-execution-queue"
  )
  const { classifyApolloSequenceDraftReadiness, isApolloSequenceDraftPlaceholderContent } =
    await import("../lib/growth/apollo/apollo-sequence-draft-readiness")

  const cohort = await loadApolloPilotCohort(admin, COHORT_ID)
  if (!cohort) {
    console.error(JSON.stringify({ ok: false, error: "cohort_not_found" }))
    process.exit(1)
  }

  const companyIds = cohort.companies.map((c) => c.company_candidate_id)
  const queue = await loadApolloSequenceExecutionQueue(admin, { status: "all", limit: 500 })
  const items = queue.items.filter(
    (row) =>
      companyIds.includes(row.company_candidate_id) && row.status === "pending_draft_approval",
  )

  const drafts = items.map((row) => {
    const emailDraft =
      row.materialization.drafts.find((d) => d.draft_type === "email") ?? row.materialization.drafts[0]
    const readiness = emailDraft ? classifyApolloSequenceDraftReadiness(emailDraft) : null
    return {
      candidate_id: row.candidate_id,
      company_candidate_id: row.company_candidate_id,
      growth_lead_id: row.growth_lead_id,
      company: row.company_name,
      contact: row.full_name,
      title: row.title,
      status: row.status,
      sequence_template: row.materialization.sequence_label,
      sequence_key: row.materialization.sequence_key,
      pattern_key: row.materialization.pattern_key,
      draft_readiness_label: row.draft_readiness_label,
      subject: emailDraft?.subject_placeholder ?? null,
      body: emailDraft?.body_placeholder ?? null,
      content_summary: emailDraft?.content_summary ?? null,
      generation_id: emailDraft?.generation_id ?? null,
      personalization_packet_marker: emailDraft?.personalization_packet_marker ?? null,
      is_placeholder: emailDraft
        ? isApolloSequenceDraftPlaceholderContent(emailDraft.body_placeholder)
        : true,
      readiness,
      attribution: row.attribution_display,
      operator_summary: row.operator_summary,
      all_drafts: row.materialization.drafts.map((d) => ({
        type: d.draft_type,
        step: d.step_number,
        subject: d.subject_placeholder,
        body: d.body_placeholder,
        summary: d.content_summary,
        is_placeholder: isApolloSequenceDraftPlaceholderContent(d.body_placeholder),
      })),
    }
  })

  const leadIds = [...new Set(drafts.map((d) => d.growth_lead_id).filter(Boolean))] as string[]
  const leads =
    leadIds.length > 0
      ? (
          await admin
            .schema("growth")
            .from("leads")
            .select("id, company_name, contact_name, metadata")
            .in("id", leadIds)
        ).data ?? []
      : []

  console.log(
    JSON.stringify({ ok: true, cohort_id: COHORT_ID, count: drafts.length, drafts, leads }, null, 2),
  )
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }))
  process.exit(1)
})
