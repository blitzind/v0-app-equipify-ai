/**
 * AVA-DIRECT-PRODUCTION-CUTOVER-1A — Five-company production proof (persistence off).
 *
 * Usage:
 *   pnpm run:ava-direct-production-cutover-1a-five-company-proof
 */

import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "../lib/growth/access"
import {
  AVA_DIRECT_PRODUCTION_CUTOVER_1A_QA_MARKER,
} from "../lib/growth/ava-reasoning/ava-direct/equipify-ava-direct-reasoning"
import {
  runEquipifySupervisedAvaOutreach,
} from "../lib/growth/ava-reasoning/equipify-supervised-cutover-service"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  fetchSupabaseServiceRoleKeyFromCli,
  resolveLinkedSupabaseProjectRef,
  resolveSupabaseUrlForProjectRef,
} from "../lib/growth/qa/supabase-cli-linked-project-bootstrap"

const COHORT = [
  { leadId: "6d9220f0-2960-468c-b4be-5d7595d292c3", label: "Block Imaging", expected: "pursue" },
  { leadId: "03a361d3-e6b6-42e6-bc78-a5773acc1725", label: "Best Buy", expected: "reject" },
  { leadId: "b06417cf-8c67-4705-82f3-0b62e3d08ca2", label: "NAES", expected: "judgment" },
  { leadId: "5f937f96-d0a1-41d5-82ae-ca10482443b1", label: "Superior Lift", expected: "pursue" },
  { leadId: "34b85fb6-dc58-44db-8483-8cf12bdebce8", label: "Hughes Property Management", expected: "hold-or-judgment" },
] as const

function bootstrapOpenAiKeyFromLegacyHideFiles(cwd = process.cwd()): void {
  if (process.env.OPENAI_API_KEY?.trim()) return
  for (const relative of [
    ".env.local.rebuild.equipify-build-hidden",
    ".env.local.active.equipify-vercel-run-hidden",
  ]) {
    const absolute = resolve(cwd, relative)
    if (!existsSync(absolute)) continue
    for (const line of readFileSync(absolute, "utf8").split("\n")) {
      if (!line.startsWith("OPENAI_API_KEY=")) continue
      let value = line.slice("OPENAI_API_KEY=".length).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (value.length < 20) continue
      process.env.OPENAI_API_KEY = value
      if (!process.env.AI_ENABLED_PROVIDERS?.trim()) process.env.AI_ENABLED_PROVIDERS = "openai"
      return
    }
  }
}

async function bootstrapProductionAdminAsync() {
  bootstrapVerifiedChannelsCertEnv()
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    const ref = resolveLinkedSupabaseProjectRef()
    if (!ref) throw new Error("Supabase credentials unavailable.")
    process.env.NEXT_PUBLIC_SUPABASE_URL = resolveSupabaseUrlForProjectRef(ref)
    process.env.SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
    process.env.SUPABASE_SERVICE_ROLE_KEY = await fetchSupabaseServiceRoleKeyFromCli(ref)
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

async function main(): Promise<void> {
  const admin = await bootstrapProductionAdminAsync()
  bootstrapOpenAiKeyFromLegacyHideFiles()
  if (!process.env.OPENAI_API_KEY?.trim()) throw new Error("OPENAI_API_KEY unavailable.")

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) throw new Error("GROWTH_ENGINE_AI_ORG_ID unavailable.")

  console.log(`\n=== ${AVA_DIRECT_PRODUCTION_CUTOVER_1A_QA_MARKER} five-company proof ===\n`)
  console.log(`organizationId=${organizationId}`)
  console.log(`persistence=disabled\n`)

  const results: Array<Record<string, unknown>> = []

  for (const item of COHORT) {
    const started = Date.now()
    const run = await runEquipifySupervisedAvaOutreach({
      admin,
      leadId: item.leadId,
      actingUserId: "00000000-0000-4000-8000-000000000001",
      actingUserEmail: "ava-proof@equipify.ai",
      organizationId,
      persist: false,
    })
    const wallMs = Date.now() - started

    if (!run.ok) {
      results.push({
        label: item.label,
        leadId: item.leadId,
        ok: false,
        code: run.code,
        message: run.message,
        totalRuntimeMs: wallMs,
      })
      console.log(`--- ${item.label} FAILED (${run.code}) ---`)
      console.log(run.message)
      continue
    }

    const o = run.output
    const retrieval = o.websiteRetrieval
    const row = {
      label: item.label,
      leadId: item.leadId,
      ok: true,
      expected: item.expected,
      retrieval: retrieval
        ? retrieval.ok
          ? {
              ok: true,
              normalizedUrl: retrieval.normalizedUrl,
              charCount: retrieval.charCount,
              truncated: retrieval.truncated,
              partialFetch: retrieval.partialFetch,
            }
          : { ok: false, code: retrieval.code, message: retrieval.message }
        : null,
      companyUnderstanding: o.companyUnderstanding,
      decision: o.decision,
      rationale: o.rationale,
      strongestAngle: o.strongestAngle,
      recommendedContact: o.recommendedContact,
      missingInformation: o.missingInformation,
      email: o.email,
      model: o.model,
      reasoningDurationMs: o.durationMs,
      totalRuntimeMs: wallMs,
      modelAttempts: o.modelAttempts,
    }
    results.push(row)

    console.log(`--- ${item.label} (${item.expected}) ---`)
    console.log(`retrieval: ${JSON.stringify(row.retrieval)}`)
    console.log(`decision: ${o.decision}`)
    console.log(`rationale: ${o.rationale}`)
    console.log(`companyUnderstanding: ${o.companyUnderstanding?.slice(0, 400) ?? "(none)"}`)
    console.log(`recommendedContact: ${JSON.stringify(o.recommendedContact)}`)
    if (o.email) {
      console.log(`email.subject: ${o.email.subject}`)
      console.log(`email.body:\n${o.email.body}`)
    } else {
      console.log("email: null")
    }
    console.log(`runtime: reasoning=${o.durationMs}ms total=${wallMs}ms\n`)
  }

  console.log("\n=== SUMMARY JSON ===")
  console.log(JSON.stringify(results, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
