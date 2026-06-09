/**
 * Apollo AI-4 — select one test company candidate (no Apollo API calls).
 * Run: pnpm select:apollo-live-pilot-test-company-ai-4
 *
 * Production:
 *   vercel env run -e production -- env APOLLO_TEST_COMPANY_PREFER_SEEDED=1 pnpm select:apollo-live-pilot-test-company-ai-4
 *
 * Optional:
 *   APOLLO_AI_4_COMPANY_CANDIDATE_ID=<uuid>  — validate explicit company
 *   APOLLO_AI_4_COMPANY_NAME_SEARCH=<name>   — filter by company name
 *   APOLLO_TEST_COMPANY_PREFER_SEEDED=1      — prefer LE-3 seeded candidate
 */
import { createClient } from "@supabase/supabase-js"
import { resolveApolloLivePilotTestCompany } from "../lib/growth/apollo/apollo-live-pilot-test-company-selector"
import { bootstrapApolloLivePilotCliEnv } from "./apollo-live-pilot-cli-env-bootstrap"

async function main(): Promise<void> {
  const boot = bootstrapApolloLivePilotCliEnv()
  if (!boot) {
    console.error(JSON.stringify({ ok: false, error: "Supabase credentials unavailable." }))
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const explicitId =
    process.env.APOLLO_AI_4_COMPANY_CANDIDATE_ID?.trim() ||
    process.env.GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID?.trim() ||
    null
  const nameSearch = process.env.APOLLO_AI_4_COMPANY_NAME_SEARCH?.trim() || null
  const preferSeeded = process.env.APOLLO_TEST_COMPANY_PREFER_SEEDED === "1"
  const seededDomain = process.env.APOLLO_TEST_COMPANY_DOMAIN?.trim() || null

  const result = await resolveApolloLivePilotTestCompany(admin, {
    company_candidate_id: explicitId,
    company_name_search: nameSearch,
    prefer_seeded: preferSeeded || Boolean(seededDomain),
    seeded_domain: seededDomain,
  })

  console.log(
    JSON.stringify(
      {
        ok: result.ok,
        message: result.message,
        company_candidate_id: result.company?.company_candidate_id ?? null,
        company_name: result.company?.company_name ?? null,
        domain: result.company?.domain ?? null,
        existing_apollo_contacts: result.company?.existing_apollo_contacts ?? null,
        suitable: result.company?.suitable ?? false,
        suitability_notes: result.company?.suitability_notes ?? [],
        env_hint: result.ok
          ? `GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID=${result.company!.company_candidate_id}`
          : null,
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
