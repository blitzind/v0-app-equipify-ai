/**
 * Apollo-Primary-5 — enrollment confirmation production certification.
 *
 * Run (production env, confirm enabled):
 *   GROWTH_APOLLO_PRIMARY_5_CONFIRM_ENABLED=true \
 *   pnpm certify:apollo-primary-contact-acquisition-5:production
 *
 * Read-only audit (no confirm):
 *   pnpm certify:apollo-primary-contact-acquisition-5:production
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

const COMPANY_CANDIDATE_ID = "d2e669d5-e912-4fb7-992a-b4f9a92ff56a"
const GROWTH_LEAD_ID = "7bf7a767-ef0f-4441-af6e-d0f3ffa81d56"
const ENROLLMENT_DRAFT_ID = "d5fa5558-08ff-4504-ab55-a925e26e6c29"

const boot = bootstrapVerifiedChannelsCertEnv()
if (!boot) {
  console.error(JSON.stringify({ ok: false, error: "Supabase credentials unavailable." }))
  process.exit(1)
}

async function main(): Promise<void> {
  const { APOLLO_PRIMARY_5_QA_MARKER, certifyApolloPrimaryContactEnrollmentConfirmation } = await import(
    "../lib/growth/apollo/apollo-primary-contact-enrollment-confirmation-certification"
  )

  const confirmEnabled = process.env.GROWTH_APOLLO_PRIMARY_5_CONFIRM_ENABLED === "true"
  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })

  const report = await certifyApolloPrimaryContactEnrollmentConfirmation(admin, {
    company_candidate_id: COMPANY_CANDIDATE_ID,
    growth_lead_id: GROWTH_LEAD_ID,
    enrollment_draft_id: ENROLLMENT_DRAFT_ID,
    confirm_enabled: confirmEnabled,
    materialize_enabled: process.env.GROWTH_APOLLO_PRIMARY_5_MATERIALIZE_ENABLED === "true",
    acting_user_email: process.env.GROWTH_APOLLO_PRIMARY_5_ACTING_USER_EMAIL?.trim() || undefined,
    acting_user_id: process.env.GROWTH_APOLLO_PRIMARY_5_ACTING_USER_ID?.trim() || undefined,
  })

  const payload = {
    ok: report.certification === "PASS" || report.certification === "PASS_PARTIAL",
    qa_marker: APOLLO_PRIMARY_5_QA_MARKER,
    confirm_enabled: confirmEnabled,
    fixtures: {
      company_candidate_id: COMPANY_CANDIDATE_ID,
      growth_lead_id: GROWTH_LEAD_ID,
      enrollment_draft_id: ENROLLMENT_DRAFT_ID,
    },
    report,
  }

  console.log(JSON.stringify(payload, null, 2))

  if (report.certification === "FAIL") {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  process.exit(1)
})
