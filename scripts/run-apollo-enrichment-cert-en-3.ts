/**
 * Apollo EN-3 promotion-only — reloads persisted enriched candidates, no Apollo credits.
 *
 *   GROWTH_APOLLO_EN_1_COMPANY_CANDIDATE_ID=d2e669d5-e912-4fb7-992a-b4f9a92ff56a \
 *   pnpm run:apollo-enrichment-cert-en-3
 */
import { createClient } from "@supabase/supabase-js"
import { resolveApolloEnrichmentCertCompanyCandidateId } from "../lib/growth/apollo/apollo-enrichment-cert-gates"
import { runApolloEnrichmentCertEn3 } from "../lib/growth/apollo/apollo-enrichment-cert-runner"
import { buildApolloEnrichmentCertEvidenceBundle } from "../lib/growth/apollo/apollo-enrichment-cert-evidence-bundle"

async function main(): Promise<void> {
  const company_candidate_id = resolveApolloEnrichmentCertCompanyCandidateId(process.env)
  if (!company_candidate_id) {
    console.error(
      JSON.stringify(
        { ok: false, error: "Set GROWTH_APOLLO_EN_1_COMPANY_CANDIDATE_ID (or AI-3 equivalent)." },
        null,
        2,
      ),
    )
    process.exit(1)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) {
    console.error(JSON.stringify({ ok: false, error: "missing_supabase_credentials" }, null, 2))
    process.exit(1)
  }

  const admin = createClient(url, key, { auth: { persistSession: false } })
  const result = await runApolloEnrichmentCertEn3(admin, { company_candidate_id })

  const bundle = result.evidence
    ? buildApolloEnrichmentCertEvidenceBundle({
        evidence: result.evidence,
        ok: result.ok,
        canonical_person_matches: result.evidence.readiness.sequence_ready,
        canonical_company_matches: result.evidence.company.canonical_company_id ? 1 : 0,
      })
    : null

  console.log(JSON.stringify({ ok: result.ok, evidence: result.evidence, evidence_bundle: bundle, error: result.error }, null, 2))
  if (!result.ok) process.exit(1)
}

void main().catch((err) => {
  console.error(err)
  process.exit(1)
})
