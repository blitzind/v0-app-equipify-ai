/**
 * Phase 14.3F — Deployed Vercel Production Apollo enrichment probe (single company).
 *
 * Run:
 *   vercel env run -e production -- node -r ./scripts/server-only-shim.cjs --import tsx scripts/probe-apollo-deployed-enrichment-production.ts
 */
import { createClient } from "@supabase/supabase-js"
import { APOLLO_SINGLE_COMPANY_ENRICHMENT_DIAGNOSTIC_EXECUTE_CONFIRM } from "../lib/growth/apollo/apollo-single-company-enrichment-diagnostic-gates"
import { resolveGrowthDeployedRuntimeBaseUrl } from "../lib/growth/qa/growth-provider-deployed-runtime-probe"
import { mintGrowthPlatformAdminBearerToken } from "../lib/growth/qa/growth-platform-admin-bearer-probe"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

const PRODUCTION_VALIDATION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

const COMPANY_CANDIDATE_ID = "0719a17c-49c7-42f1-a758-f120313c7b11"
const COMPANY_NAME = "Pulse Biomedical Service"

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
  console.error(JSON.stringify({ ok: false, error: "Supabase production credentials unavailable" }))
  process.exit(1)
}

async function findPlatformAdminBearer(input: {
  supabase_url: string
  service_role_key: string
  anon_key: string
  admin: ReturnType<typeof createClient>
  base_url: string
}): Promise<{ access_token: string; email: string } | null> {
  const { listGrowthRepRoster } = await import("../lib/growth/assignment/rep-roster-repository")
  const reps = await listGrowthRepRoster(input.admin)
  const preferred = [
    ...reps.map((rep) => rep.email.trim()),
    "mike@blitzind.com",
  ].filter((email, index, all) => email && all.indexOf(email) === index)

  for (const email of preferred) {
    const minted = await mintGrowthPlatformAdminBearerToken({
      supabase_url: input.supabase_url,
      service_role_key: input.service_role_key,
      anon_key: input.anon_key,
      admin_email: email,
    })
    if (!minted.access_token) continue

    const authProbe = await fetch(`${input.base_url.replace(/\/$/, "")}/api/platform/growth/access-diagnostic`, {
      headers: { Authorization: `Bearer ${minted.access_token}` },
    })
    const authBody = (await authProbe.json()) as { diagnostic?: Record<string, unknown> }
    if (authBody.diagnostic?.access_decision === "allowed") {
      return { access_token: minted.access_token, email }
    }
  }

  return null
}

async function loadVerifiedEmailContacts(
  admin: ReturnType<typeof createClient>,
  company_candidate_id: string,
): Promise<number> {
  const { buildApollo25CompanyPilotSelectionInputs } = await import(
    "../lib/growth/apollo/apollo-25-company-pilot-route"
  )
  const inputs = await buildApollo25CompanyPilotSelectionInputs(admin, {
    company_ids: [company_candidate_id],
  })
  return inputs[0]?.snapshot_summary.verified_email_contacts ?? 0
}

async function fetchDeployedJson(input: {
  base_url: string
  path: string
  method: "GET" | "POST"
  bearer: string
  body?: Record<string, unknown>
}): Promise<{ ok: boolean; status: number; body: Record<string, unknown> | null; raw: string }> {
  const url = `${input.base_url.replace(/\/$/, "")}${input.path}`
  const response = await fetch(url, {
    method: input.method,
    headers: {
      Authorization: `Bearer ${input.bearer}`,
      Accept: "application/json",
      ...(input.body ? { "Content-Type": "application/json" } : {}),
    },
    body: input.body ? JSON.stringify(input.body) : undefined,
    signal: AbortSignal.timeout(120_000),
  })

  const raw = await response.text()
  let body: Record<string, unknown> | null = null
  try {
    body = JSON.parse(raw) as Record<string, unknown>
  } catch {
    body = { raw: raw.slice(0, 500) }
  }

  return { ok: response.ok, status: response.status, body, raw }
}

function readinessSummary(body: Record<string, unknown> | null): Record<string, unknown> {
  const config =
    body?.config_diagnostics && typeof body.config_diagnostics === "object"
      ? (body.config_diagnostics as Record<string, unknown>)
      : {}
  return {
    apollo_api_key_present: config.api_key_present === true,
    enrich_emails_enabled: body?.enrich_emails_enabled === true,
    enrich_emails_ack: body?.enrich_emails_ack === true,
    ready_for_enrichment: config.ready_for_enrichment === true,
    ready: body?.ready === true,
    production_runtime: body?.production_runtime === true,
    blockers: body?.blockers ?? [],
  }
}

function bulkMatchInvoked(body: Record<string, unknown> | null): boolean {
  const evidence =
    body?.enrichment_evidence && typeof body.enrichment_evidence === "object"
      ? (body.enrichment_evidence as Record<string, unknown>)
      : null
  if (!evidence) return false
  if (evidence.enrichment_attempted !== true) return false
  const blockers = Array.isArray(evidence.enrichment_blockers)
    ? evidence.enrichment_blockers.map(String)
    : []
  if (blockers.includes("enrichment_provider_disabled")) return false
  if (blockers.includes("enrichment_gates_blocked")) return false
  return evidence.enrichment_provider === "apollo_bulk_match" || evidence.enrichment_attempted === true
}

async function main(): Promise<void> {
  const base_url =
    process.env.GROWTH_ENGINE_PUBLIC_BASE_URL?.trim() ||
    resolveGrowthDeployedRuntimeBaseUrl() ||
    "https://v0-app-equipify-ai-53-qi2f2mzu4-blitzify.vercel.app"
  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })

  const adminAuth = await findPlatformAdminBearer({
    supabase_url: boot.url,
    service_role_key: boot.jwt,
    anon_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? boot.jwt,
    admin,
    base_url,
  })

  if (!adminAuth) {
    console.error(
      JSON.stringify({
        ok: false,
        error: "platform_admin_bearer_unavailable",
        detail: "No auth user could access Growth platform admin routes on deployed runtime.",
      }),
    )
    process.exit(1)
  }

  const bearer = { access_token: adminAuth.access_token, email: adminAuth.email, error: null }

  const verified_before = await loadVerifiedEmailContacts(admin, COMPANY_CANDIDATE_ID)

  const readiness = await fetchDeployedJson({
    base_url,
    path: "/api/platform/growth/apollo-single-company-enrichment/readiness",
    method: "GET",
    bearer: bearer.access_token,
  })

  const readiness_summary = readinessSummary(readiness.body)

  const execute = await fetchDeployedJson({
    base_url,
    path: "/api/platform/growth/apollo-single-company-enrichment/execute",
    method: "POST",
    bearer: bearer.access_token,
    body: {
      confirm: APOLLO_SINGLE_COMPANY_ENRICHMENT_DIAGNOSTIC_EXECUTE_CONFIRM,
      company_candidate_id: COMPANY_CANDIDATE_ID,
      company_name: COMPANY_NAME,
    },
  })

  const verified_after = await loadVerifiedEmailContacts(admin, COMPANY_CANDIDATE_ID)
  const evidence =
    execute.body?.enrichment_evidence && typeof execute.body.enrichment_evidence === "object"
      ? (execute.body.enrichment_evidence as Record<string, unknown>)
      : {}

  const apollo_api_accessible = readiness_summary.apollo_api_key_present === true
  const bulk_match_invoked = execute.ok && bulkMatchInvoked(execute.body)
  const contacts_enriched =
    typeof evidence.enrichment_candidates_updated === "number"
      ? evidence.enrichment_candidates_updated
      : 0
  const emails_recovered =
    typeof evidence.enrichment_verified_email_contacts === "number"
      ? evidence.enrichment_verified_email_contacts
      : 0

  const errors: string[] = []
  if (!readiness.ok) errors.push(`readiness_http_${readiness.status}`)
  if (!execute.ok) errors.push(`execute_http_${execute.status}`)
  if (execute.body?.error) errors.push(String(execute.body.error))
  for (const blocker of (execute.body?.blockers as string[] | undefined) ?? []) {
    errors.push(String(blocker))
  }

  const probe_success = apollo_api_accessible && bulk_match_invoked

  const payload = {
    ok: probe_success,
    recommendation: probe_success
      ? "PROCEED_TO_FULL_RECOVERY"
      : readiness_summary.apollo_api_key_present === false ||
          readiness_summary.enrich_emails_enabled === false
        ? "FIX_RUNTIME_CONFIG_FIRST"
        : "INVESTIGATE_PROVIDER_ERROR",
    runtime_readiness: {
      http_status: readiness.status,
      ...readiness_summary,
    },
    single_company_probe: {
      company_tested: COMPANY_NAME,
      company_candidate_id: COMPANY_CANDIDATE_ID,
      http_status: execute.status,
      apollo_api_accessible,
      bulk_match_invoked,
      contacts_enriched,
      emails_recovered,
      verified_email_contacts_before: verified_before,
      verified_email_contacts_after: verified_after,
      company_now_verified_email_ready: verified_after > verified_before,
      enrichment_attempted: evidence.enrichment_attempted === true,
      enrichment_provider: evidence.enrichment_provider ?? null,
      enrichment_blockers: evidence.enrichment_blockers ?? [],
      safety: execute.body?.safety ?? null,
      errors,
    },
    validation_evidence: {
      company_tested: COMPANY_NAME,
      company_candidate_id: COMPANY_CANDIDATE_ID,
      apollo_api_accessible,
      bulk_match_invoked,
      contacts_enriched,
      emails_recovered,
      verified_email_contacts_before: verified_before,
      verified_email_contacts_after: verified_after,
      company_now_verified_email_ready: verified_after > verified_before,
      errors,
    },
    deployed_base_url: base_url,
    platform_admin_email: bearer.email,
  }

  console.log(JSON.stringify(payload, null, 2))
  process.exit(probe_success ? 0 : 1)
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  process.exit(1)
})
