/**
 * LE-3 — seed one Apollo live pilot test discovery candidate (no Apollo HTTP).
 * Production-safe: uses production env bootstrap — never reads .env.local.
 *
 * Run:
 *   pnpm seed:apollo-live-pilot-test-company:production
 *
 * Requires:
 *   APOLLO_TEST_COMPANY_SEED_ACK=1
 *   APOLLO_TEST_COMPANY_NAME=...
 *   APOLLO_TEST_COMPANY_DOMAIN=...
 *   APOLLO_TEST_COMPANY_WEBSITE=...
 *
 * Or preset:
 *   APOLLO_TEST_COMPANY_SEED_ACK=1 APOLLO_TEST_COMPANY_PROFILE=henry_schein \
 *   pnpm seed:apollo-live-pilot-test-company:production
 */
import { createClient } from "@supabase/supabase-js"
import { mergeApolloLivePilotTestCompanySeedEnv } from "../lib/growth/apollo/apollo-live-pilot-test-company-presets"
import {
  seedApolloLivePilotTestCompany,
  validateApolloLivePilotTestCompanySeedEnv,
} from "../lib/growth/apollo/apollo-live-pilot-test-company-seed"
import { bootstrapApolloLivePilotCliEnv } from "./apollo-live-pilot-cli-env-bootstrap"

async function main(): Promise<void> {
  const envCheck = validateApolloLivePilotTestCompanySeedEnv()
  if (!envCheck.ok || !envCheck.input) {
    console.error(JSON.stringify({ ok: false, errors: envCheck.errors }, null, 2))
    process.exit(1)
  }

  const boot = bootstrapApolloLivePilotCliEnv()
  if (!boot) {
    console.error(JSON.stringify({ ok: false, error: "Supabase credentials unavailable." }))
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const result = await seedApolloLivePilotTestCompany(admin, envCheck.input)
  const preset = mergeApolloLivePilotTestCompanySeedEnv()

  console.log(
    JSON.stringify(
      {
        ok: result.ok,
        created: result.created,
        message: result.message,
        company_candidate_id: result.company_candidate_id,
        company_name: result.company_name,
        domain: result.domain,
        website: result.website,
        source_marker: result.source_marker,
        pilot_profile: preset.pilot_profile,
        coverage_tier: preset.coverage_tier,
        env_hint: result.env_hint,
        next_steps: result.ok
          ? [
              "Add env_hint to Vercel Production as GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID",
              "pnpm select:apollo-live-pilot-test-company-ai-4:production",
              "pnpm dry-run:apollo-live-pilot-ai-4:production",
            ]
          : [],
      },
      null,
      2,
    ),
  )

  if (!result.ok) process.exit(1)
}

void main().catch((err) => {
  console.error(err)
  process.exit(1)
})
