/**
 * Apollo EN-1 one-company enrichment certification (live or mock).
 *
 * Prerequisites: run search-only live pilot first so channel-less Apollo candidates exist.
 *
 * Mock (no credits):
 *   GROWTH_APOLLO_EN_1_CERT_ENABLED=true \
 *   GROWTH_APOLLO_EN_1_CERT_ACK=1 \
 *   GROWTH_APOLLO_ENRICH_EMAILS=true \
 *   GROWTH_APOLLO_ENRICH_EMAILS_ACK=1 \
 *   GROWTH_APOLLO_USE_MOCK=true \
 *   GROWTH_APOLLO_EN_1_COMPANY_CANDIDATE_ID=<id> \
 *   pnpm run:apollo-enrichment-cert-en-1
 *
 * Live (consumes Apollo credits via bulk_match):
 *   GROWTH_APOLLO_EN_1_CERT_ENABLED=true \
 *   GROWTH_APOLLO_EN_1_CERT_ACK=1 \
 *   GROWTH_APOLLO_ENRICH_EMAILS=true \
 *   GROWTH_APOLLO_ENRICH_EMAILS_ACK=1 \
 *   GROWTH_APOLLO_USE_MOCK=false \
 *   GROWTH_APOLLO_EN_1_COMPANY_CANDIDATE_ID=<id> \
 *   APOLLO_API_KEY=<key> \
 *   pnpm run:apollo-enrichment-cert-en-1
 */
import { createClient } from "@supabase/supabase-js"
import { runApolloEnrichmentCertEn1 } from "../lib/growth/apollo/apollo-enrichment-cert-runner"
import { assertApolloEnrichmentCertAllowed } from "../lib/growth/apollo/apollo-enrichment-cert-gates"
import { getRecommendedApolloEnrichmentPath } from "../lib/growth/apollo/apollo-enrichment-cert-audit"

async function main(): Promise<void> {
  const gates = assertApolloEnrichmentCertAllowed(process.env)
  if (!gates.ok) {
    console.error(JSON.stringify({ ok: false, error: "gates_failed", blockers: gates.blockers }, null, 2))
    process.exit(1)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) {
    console.error(JSON.stringify({ ok: false, error: "missing_supabase_credentials" }, null, 2))
    process.exit(1)
  }

  const admin = createClient(url, key, { auth: { persistSession: false } })
  const result = await runApolloEnrichmentCertEn1(admin, {
    company_candidate_id: gates.company_candidate_id ?? undefined,
    max_people: gates.max_people,
  })

  console.log(
    JSON.stringify(
      {
        ok: result.ok,
        recommended_path: getRecommendedApolloEnrichmentPath().path_id,
        evidence: result.evidence,
        error: result.error,
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
