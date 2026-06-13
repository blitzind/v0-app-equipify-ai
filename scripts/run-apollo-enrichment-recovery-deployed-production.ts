/**
 * Phase 14.3G — Deployed Vercel Production Apollo batch enrichment recovery.
 *
 * Run:
 *   vercel env run -e production -- node -r ./scripts/server-only-shim.cjs --import tsx scripts/run-apollo-enrichment-recovery-deployed-production.ts
 *
 * Dry run:
 *   DRY_RUN=1 vercel env run -e production -- node -r ./scripts/server-only-shim.cjs --import tsx scripts/run-apollo-enrichment-recovery-deployed-production.ts
 */
import { createClient } from "@supabase/supabase-js"
import {
  APOLLO_ENRICHMENT_RECOVERY_DEFAULT_CHUNK_LIMIT,
  APOLLO_ENRICHMENT_RECOVERY_EXECUTE_CONFIRM,
} from "../lib/growth/apollo/apollo-enrichment-recovery-route-gates"
import { resolveGrowthDeployedRuntimeBaseUrl } from "../lib/growth/qa/growth-provider-deployed-runtime-probe"
import { mintGrowthPlatformAdminBearerToken } from "../lib/growth/qa/growth-platform-admin-bearer-probe"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

const PRODUCTION_VALIDATION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

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

type ChunkExecuteBody = {
  ok?: boolean
  dry_run?: boolean
  safety?: Record<string, unknown>
  recovery_results?: {
    companies_targeted?: number
    companies_processed?: number
    companies_recovered?: number
    contacts_enriched?: number
    emails_recovered?: number
    companies_promoted_to_verified?: number
    errors?: string[]
    provider_blockers?: string[]
  }
  company_summaries?: Array<Record<string, unknown>>
  before_after?: Record<string, unknown>
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

async function fetchDeployedJson(input: {
  base_url: string
  path: string
  method: "GET" | "POST"
  bearer: string
  body?: Record<string, unknown>
}): Promise<{ ok: boolean; status: number; body: ChunkExecuteBody | Record<string, unknown> | null; raw: string }> {
  const url = `${input.base_url.replace(/\/$/, "")}${input.path}`
  const response = await fetch(url, {
    method: input.method,
    headers: {
      Authorization: `Bearer ${input.bearer}`,
      Accept: "application/json",
      ...(input.body ? { "Content-Type": "application/json" } : {}),
    },
    body: input.body ? JSON.stringify(input.body) : undefined,
    signal: AbortSignal.timeout(600_000),
  })

  const raw = await response.text()
  let body: ChunkExecuteBody | Record<string, unknown> | null = null
  try {
    body = JSON.parse(raw) as ChunkExecuteBody
  } catch {
    body = { raw: raw.slice(0, 2000) }
  }

  return { ok: response.ok, status: response.status, body, raw }
}

function mergeRecoveryResults(
  aggregate: {
    companies_targeted: number
    companies_processed: number
    companies_recovered: number
    contacts_enriched: number
    emails_recovered: number
    companies_promoted_to_verified: number
    errors: string[]
    provider_blockers: string[]
    company_summaries: Array<Record<string, unknown>>
  },
  chunk: ChunkExecuteBody,
): void {
  const results = chunk.recovery_results
  if (!results) return

  aggregate.companies_targeted += results.companies_targeted ?? 0
  aggregate.companies_processed += results.companies_processed ?? 0
  aggregate.companies_recovered += results.companies_recovered ?? 0
  aggregate.contacts_enriched += results.contacts_enriched ?? 0
  aggregate.emails_recovered += results.emails_recovered ?? 0
  aggregate.companies_promoted_to_verified += results.companies_promoted_to_verified ?? 0

  for (const error of results.errors ?? []) {
    if (!aggregate.errors.includes(error)) aggregate.errors.push(error)
  }
  for (const blocker of results.provider_blockers ?? []) {
    if (!aggregate.provider_blockers.includes(blocker)) aggregate.provider_blockers.push(blocker)
  }
  if (chunk.company_summaries?.length) {
    aggregate.company_summaries.push(...chunk.company_summaries)
  }
}

async function main(): Promise<void> {
  const base_url =
    process.env.GROWTH_ENGINE_PUBLIC_BASE_URL?.trim() ||
    resolveGrowthDeployedRuntimeBaseUrl() ||
    "https://app.equipify.ai"
  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const dry_run = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true"
  const totalLimitRaw = process.env.LIMIT?.trim()
  const totalLimit = totalLimitRaw ? Number.parseInt(totalLimitRaw, 10) : 32
  const chunkLimitRaw = process.env.CHUNK_LIMIT?.trim()
  const chunkLimit = chunkLimitRaw
    ? Number.parseInt(chunkLimitRaw, 10)
    : APOLLO_ENRICHMENT_RECOVERY_DEFAULT_CHUNK_LIMIT

  const adminAuth = await findPlatformAdminBearer({
    supabase_url: boot.url,
    service_role_key: boot.jwt,
    anon_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? boot.jwt,
    admin,
    base_url,
  })

  if (!adminAuth) {
    console.error(JSON.stringify({ ok: false, error: "platform_admin_bearer_unavailable" }))
    process.exit(1)
  }

  const readiness = await fetchDeployedJson({
    base_url,
    path: "/api/platform/growth/apollo-enrichment-recovery/readiness",
    method: "GET",
    bearer: adminAuth.access_token,
  })

  const aggregate = {
    companies_targeted: 0,
    companies_processed: 0,
    companies_recovered: 0,
    contacts_enriched: 0,
    emails_recovered: 0,
    companies_promoted_to_verified: 0,
    errors: [] as string[],
    provider_blockers: [] as string[],
    company_summaries: [] as Array<Record<string, unknown>>,
  }

  const chunk_runs: Array<{ offset: number; limit: number; http_status: number; ok: boolean }> = []
  let lastBeforeAfter: Record<string, unknown> | null = null
  let lastSafety: Record<string, unknown> | null = null
  let allOk = true

  for (let offset = 0; offset < totalLimit; offset += chunkLimit) {
    const limit = Math.min(chunkLimit, totalLimit - offset)
    const execute = await fetchDeployedJson({
      base_url,
      path: "/api/platform/growth/apollo-enrichment-recovery/execute",
      method: "POST",
      bearer: adminAuth.access_token,
      body: {
        confirm: APOLLO_ENRICHMENT_RECOVERY_EXECUTE_CONFIRM,
        limit,
        offset,
        dry_run,
      },
    })

    chunk_runs.push({ offset, limit, http_status: execute.status, ok: execute.ok })
    if (!execute.ok) {
      allOk = false
      aggregate.errors.push(`chunk_offset_${offset}_http_${execute.status}`)
      break
    }

    const body = execute.body as ChunkExecuteBody
    mergeRecoveryResults(aggregate, body)
    if (body.before_after) lastBeforeAfter = body.before_after
    if (body.safety) lastSafety = body.safety

    const processed = body.recovery_results?.companies_processed ?? 0
    if (processed < limit) break
  }

  const payload = {
    ok: allOk,
    dry_run,
    deployed_base_url: base_url,
    platform_admin_email: adminAuth.email,
    chunk_limit: chunkLimit,
    total_limit: totalLimit,
    readiness: {
      http_status: readiness.status,
      body: readiness.body,
    },
    chunk_runs,
    safety: lastSafety,
    recovery_results: aggregate,
    before_after: lastBeforeAfter,
    company_summaries: aggregate.company_summaries,
  }

  console.log(JSON.stringify(payload, null, 2))
  process.exit(allOk ? 0 : 1)
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  process.exit(1)
})
