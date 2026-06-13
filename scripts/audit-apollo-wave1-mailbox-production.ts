/**
 * Phase 15.1C — read-only mailbox + wave job audit (production Supabase).
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

const WAVE_JOB_IDS = [
  "941db1fb-fe47-4bc0-a8a7-c0913ec66260",
  "32e9cf59-98fb-4836-a050-d1b5f8e5b6bc",
  "13c17611-c4be-49c6-9f6a-36e4e70f0ca1",
] as const

const COHORT_ID = "c04a1a26-9e22-4aa7-b1b3-025ffdfc591a"

async function main(): Promise<void> {
  const boot = bootstrapVerifiedChannelsCertEnv({
    sources: [".env.vercel.production", ".vercel/.env.production.local", ".env.production.local", ".env.local.rebuild"],
    inheritProcessEnvProviderKeys: true,
    protectedSnapshot: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      SUPABASE_URL: process.env.SUPABASE_URL ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    },
  })
  if (!boot) throw new Error("production_supabase_unavailable")

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })

  const { data: jobs } = await admin
    .schema("growth")
    .from("sequence_execution_jobs")
    .select("id,status,sender_account_id,last_error,lead_id")
    .in("id", [...WAVE_JOB_IDS])

  const { data: cohortCompanies } = await admin
    .schema("growth")
    .from("apollo_pilot_cohort_companies")
    .select("company_candidate_id,growth_lead_id")
    .eq("cohort_id", COHORT_ID)

  const cohortLeadIds = [...new Set((cohortCompanies ?? []).map((c) => c.growth_lead_id).filter(Boolean))]

  const { data: allJobs } = cohortLeadIds.length
    ? await admin
        .schema("growth")
        .from("sequence_execution_jobs")
        .select("id,status,lead_id,last_error")
        .in("lead_id", cohortLeadIds)
    : { data: [] }

  const { data: routes } = await admin.schema("growth").from("delivery_routes").select("*").eq("enabled", true)
  const { data: sendersAll } = await admin
    .schema("growth")
    .from("sender_accounts")
    .select("id,email_address,status,provider_family,health_status,deleted_at")
    .is("deleted_at", null)

  const { data: mailboxesAll, error: mailboxError } = await admin
    .schema("growth")
    .from("mailbox_connections")
    .select(
      "id,sender_account_id,provider_family,email_address,status,health_reason,token_expires_at,last_validation_at,connection_health",
    )
    .is("deleted_at", null)

  const routeSenderId = routes?.[0]?.sender_account_id ?? null
  const routeMailbox = mailboxesAll?.find((m) => m.sender_account_id === routeSenderId) ?? null
  const routeSender = sendersAll?.find((s) => s.id === routeSenderId) ?? null

  const mailbox = routeMailbox
  const sender = routeSender

  console.log(
    JSON.stringify(
      {
        wave_jobs: jobs,
        enabled_route: routes?.[0] ?? null,
        sender,
        mailbox: mailbox
          ? {
              sender_mailbox_id: mailbox.id,
              provider: mailbox.provider_family,
              email: mailbox.email_address,
              health_status: mailbox.status,
              health_tier: mailbox.health_tier,
              health_reason: mailbox.health_reason,
              token_expires_at: mailbox.token_expires_at,
              last_validation_at: mailbox.last_validation_at,
              failure_reason:
                mailbox.status === "expired" ? "Mailbox connection unhealthy (expired)" : mailbox.health_reason,
            }
          : null,
        senders: sendersAll,
        mailboxes: mailboxesAll,
        mailbox_query_error: mailboxError?.message ?? null,
        queue_counts: {
          pending_approval: (allJobs ?? []).filter((j) => j.status === "pending_approval").length,
          blocked: (allJobs ?? []).filter((j) => j.status === "blocked").length,
          approved: (allJobs ?? []).filter((j) => j.status === "approved").length,
          sent: (allJobs ?? []).filter((j) => j.status === "sent").length,
          total: (allJobs ?? []).length,
        },
        all_cohort_jobs: allJobs,
      },
      null,
      2,
    ),
  )
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }))
  process.exit(1)
})
