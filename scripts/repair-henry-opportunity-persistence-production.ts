/**
 * Human-triggered Henry Schein opportunity persistence repair (production).
 *
 *   pnpm repair:henry-opportunity-persistence:production
 *   pnpm repair:henry-opportunity-persistence:production -- --dry-run
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  REVENUE_INTEGRITY_HENRY_DRAFT_ID,
  REVENUE_INTEGRITY_HENRY_LEAD_ID,
  REVENUE_INTEGRITY_HENRY_MEETING_ID,
  REVENUE_INTEGRITY_HENRY_OPPORTUNITY_ID,
} from "../lib/growth/revenue-integrity/revenue-integrity-types"

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run")

  const boot = bootstrapVerifiedChannelsCertEnv({
    sources: [".env.vercel.production", ".vercel/.env.production.local", ".env.production.local", ".env.local.rebuild"],
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
  const { investigateOpportunityDraftPersistence } = await import(
    "../lib/growth/revenue-integrity/investigate-opportunity-draft-persistence"
  )
  const { repairOpportunityDraftPersistence } = await import(
    "../lib/growth/revenue-integrity/repair-opportunity-draft-persistence"
  )

  const pre = await investigateOpportunityDraftPersistence(admin, REVENUE_INTEGRITY_HENRY_DRAFT_ID)
  const repair = await repairOpportunityDraftPersistence(admin, {
    draft_id: REVENUE_INTEGRITY_HENRY_DRAFT_ID,
    operator_email: "revenue-integrity-repair@equipify.internal",
    dry_run: dryRun,
  })

  const post = dryRun ? pre : await investigateOpportunityDraftPersistence(admin, REVENUE_INTEGRITY_HENRY_DRAFT_ID)

  console.log(
    JSON.stringify(
      {
        ok: repair.ok,
        phase: "RV-1B",
        dry_run: dryRun,
        henry: {
          lead_id: REVENUE_INTEGRITY_HENRY_LEAD_ID,
          meeting_id: REVENUE_INTEGRITY_HENRY_MEETING_ID,
          draft_id: REVENUE_INTEGRITY_HENRY_DRAFT_ID,
          opportunity_id: REVENUE_INTEGRITY_HENRY_OPPORTUNITY_ID,
        },
        pre_investigation: pre,
        repair,
        post_investigation: post,
      },
      null,
      2,
    ),
  )

  if (!repair.ok) process.exit(1)
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  process.exit(1)
})
