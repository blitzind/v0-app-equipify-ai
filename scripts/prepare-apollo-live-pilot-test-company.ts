/**
 * LE-3/AI-4 — seed (if needed) and select one Apollo live pilot test company.
 * Run: pnpm prepare:apollo-live-pilot-test-company:production
 *
 * Strong B2B example (Henry Schein):
 *   APOLLO_TEST_COMPANY_SEED_ACK=1 \
 *   APOLLO_TEST_COMPANY_NAME="Henry Schein" \
 *   APOLLO_TEST_COMPANY_DOMAIN="henryschein.com" \
 *   APOLLO_TEST_COMPANY_WEBSITE="https://www.henryschein.com" \
 *   pnpm prepare:apollo-live-pilot-test-company:production
 *
 * Or preset shorthand:
 *   APOLLO_TEST_COMPANY_SEED_ACK=1 APOLLO_TEST_COMPANY_PROFILE=henry_schein \
 *   pnpm prepare:apollo-live-pilot-test-company:production
 */
import { createClient } from "@supabase/supabase-js"
import { mergeApolloLivePilotTestCompanySeedEnv } from "../lib/growth/apollo/apollo-live-pilot-test-company-presets"
import {
  seedApolloLivePilotTestCompany,
  validateApolloLivePilotTestCompanySeedEnv,
} from "../lib/growth/apollo/apollo-live-pilot-test-company-seed"
import {
  resolveApolloLivePilotTestCompany,
  resolveApolloLivePilotTestCompanySelectionFromEnv,
} from "../lib/growth/apollo/apollo-live-pilot-test-company-selector"
import { bootstrapApolloLivePilotCliEnv } from "./apollo-live-pilot-cli-env-bootstrap"

async function main(): Promise<void> {
  const boot = bootstrapApolloLivePilotCliEnv()
  if (!boot) {
    console.error(JSON.stringify({ ok: false, error: "Supabase credentials unavailable." }))
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const merged = mergeApolloLivePilotTestCompanySeedEnv()
  const seedCheck = validateApolloLivePilotTestCompanySeedEnv()
  let seedResult: Awaited<ReturnType<typeof seedApolloLivePilotTestCompany>> | null = null

  if (seedCheck.ok && seedCheck.input) {
    seedResult = await seedApolloLivePilotTestCompany(admin, seedCheck.input)
    if (!seedResult.ok) {
      console.error(JSON.stringify({ ok: false, phase: "seed", message: seedResult.message }, null, 2))
      process.exit(1)
    }
  }

  const selection = resolveApolloLivePilotTestCompanySelectionFromEnv()
  const selected = await resolveApolloLivePilotTestCompany(admin, selection)

  console.log(
    JSON.stringify(
      {
        ok: selected.ok,
        message: selected.message,
        seed: seedResult
          ? {
              created: seedResult.created,
              company_candidate_id: seedResult.company_candidate_id,
              company_name: seedResult.company_name,
              domain: seedResult.domain,
            }
          : {
              skipped: true,
              reason: seedCheck.ok
                ? "Seed env not provided — selection only."
                : seedCheck.errors.join("; "),
            },
        selection: {
          company_candidate_id: selected.company?.company_candidate_id ?? null,
          company_name: selected.company?.company_name ?? null,
          domain: selected.company?.domain ?? null,
          suitable: selected.company?.suitable ?? false,
          suitability_notes: selected.company?.suitability_notes ?? [],
        },
        preset: merged.pilot_profile
          ? {
              profile: merged.pilot_profile,
              coverage_tier: merged.coverage_tier,
            }
          : null,
        env_hint: selected.ok
          ? `GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID=${selected.company!.company_candidate_id}`
          : null,
        next_steps: selected.ok
          ? [
              "Set env_hint in Vercel Production",
              "Redeploy Production",
              "POST /api/platform/growth/apollo-live-pilot/execute with confirm RUN_APOLLO_LIVE_PILOT",
            ]
          : ["Fix selection blockers or seed with APOLLO_TEST_COMPANY_SEED_ACK=1"],
      },
      null,
      2,
    ),
  )

  if (!selected.ok) process.exit(1)
}

void main().catch((err) => {
  console.error(err)
  process.exit(1)
})
