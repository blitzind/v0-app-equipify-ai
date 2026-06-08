/**
 * Phase 7.PCA-3 — Identify or remove Apollo benchmark contact_candidates.
 *
 * Dry-run (default): reports counts only.
 * Apply: pass --apply to delete Apollo-sourced candidates for benchmark cohort companies.
 *
 * Run:
 *   pnpm cleanup:apollo-benchmark-candidates-7-pca-3
 *   pnpm cleanup:apollo-benchmark-candidates-7-pca-3 --apply
 */
import { createClient } from "@supabase/supabase-js"
import { loadApolloReplacementBenchmarkCohort } from "../lib/growth/benchmark/apollo-replacement-benchmark-storage"
import { APOLLO_REPLACEMENT_BENCHMARK_ID } from "../lib/growth/benchmark/apollo-replacement-benchmark-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

async function main() {
  const apply = process.argv.includes("--apply")
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) {
    console.error(JSON.stringify({ error: "missing_supabase_credentials" }))
    process.exit(1)
  }

  const admin = createClient(url, key, { auth: { persistSession: false } })
  const benchmark_id = process.env.APOLLO_BENCHMARK_ID ?? APOLLO_REPLACEMENT_BENCHMARK_ID
  const cohort = await loadApolloReplacementBenchmarkCohort(admin, benchmark_id)
  const company_ids = cohort?.company_ids ?? []

  const { data: candidates } = await admin
    .schema("growth")
    .from("discovery_candidates")
    .select("id, company_id, canonical_company_id")
    .in("canonical_company_id", company_ids.length > 0 ? company_ids : ["__none__"])

  const candidateIds = new Set<string>()
  for (const row of candidates ?? []) {
    const record = row as Record<string, unknown>
    const id = asString(record.id)
    const company_id = asString(record.company_id)
    if (id) candidateIds.add(id)
    if (company_id) candidateIds.add(company_id)
  }

  const { data: apolloRows } = await admin
    .schema("growth")
    .from("contact_candidates")
    .select("id, company_candidate_id, provider_name, provider_type, metadata, full_name, created_at")
    .in("company_candidate_id", candidateIds.size > 0 ? [...candidateIds] : ["__none__"])
    .or("provider_name.eq.apollo,provider_type.eq.future_apollo")

  const apolloCandidates = (apolloRows ?? []).filter((row) => {
    const record = row as Record<string, unknown>
    const metadata =
      record.metadata && typeof record.metadata === "object"
        ? (record.metadata as Record<string, unknown>)
        : {}
    return metadata.provider === "apollo" || asString(record.provider_name) === "apollo"
  })

  const summary = {
    qa_marker: "growth-apollo-benchmark-cleanup-7-pca-3-v1",
    benchmark_id,
    cohort_companies: company_ids.length,
    apollo_candidates_found: apolloCandidates.length,
    apply,
    deleted: 0,
    sample_ids: apolloCandidates.slice(0, 5).map((r) => asString((r as Record<string, unknown>).id)),
  }

  if (apply && apolloCandidates.length > 0) {
    const ids = apolloCandidates.map((r) => asString((r as Record<string, unknown>).id)).filter(Boolean)
    const { error } = await admin.schema("growth").from("contact_candidates").delete().in("id", ids)
    if (error) {
      console.error(JSON.stringify({ ...summary, error: error.message }))
      process.exit(1)
    }
    summary.deleted = ids.length
  }

  console.log(JSON.stringify(summary, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
