/**
 * FUZOR-COMPANY-INTELLIGENCE-1A — Three-company GPT business understanding proof.
 *
 * Usage:
 *   pnpm run:fuzor-company-intelligence-1a-three-company-proof -- <leadId1> <leadId2> <leadId3>
 *
 * Compares legacy deterministic interpretation vs GPT understanding.
 * Does not persist. Does not touch Outreach / Home / outbound.
 */

import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "../lib/growth/access"
import {
  loadLegacyDeterministicCompanyInterpretation,
} from "../lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-legacy-comparison"
import { runFuzorCompanyIntelligence } from "../lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-service"
import { FUZOR_COMPANY_INTELLIGENCE_1A_QA_MARKER } from "../lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-types"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  fetchSupabaseServiceRoleKeyFromCli,
  resolveLinkedSupabaseProjectRef,
  resolveSupabaseUrlForProjectRef,
} from "../lib/growth/qa/supabase-cli-linked-project-bootstrap"

function bootstrapOpenAiKeyFromLegacyHideFiles(cwd = process.cwd()): string | null {
  if (process.env.OPENAI_API_KEY?.trim()) return "process_env"

  const candidates = [
    ".env.local.rebuild.equipify-build-hidden",
    ".env.local.active.equipify-vercel-run-hidden",
    ".env.local.rebuild.equipify-vercel-run-hidden",
  ]

  for (const relative of candidates) {
    const absolute = resolve(cwd, relative)
    if (!existsSync(absolute)) continue
    const raw = readFileSync(absolute, "utf8")
    for (const line of raw.split("\n")) {
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
      if (!process.env.AI_ENABLED_PROVIDERS?.trim()) {
        process.env.AI_ENABLED_PROVIDERS = "openai"
      }
      return `legacy_hide_file:${relative}`
    }
  }

  return null
}

async function bootstrapProductionAdminAsync(): Promise<{
  admin: ReturnType<typeof createClient>
  envSource: string
}> {
  const boot = bootstrapVerifiedChannelsCertEnv()
  let envSource = boot.source

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    const ref = resolveLinkedSupabaseProjectRef()
    if (!ref) {
      throw new Error("Supabase credentials unavailable after vercel env run and linked CLI fallback.")
    }
    process.env.NEXT_PUBLIC_SUPABASE_URL = resolveSupabaseUrlForProjectRef(ref)
    process.env.SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
    process.env.SUPABASE_SERVICE_ROLE_KEY = await fetchSupabaseServiceRoleKeyFromCli(ref)
    envSource = `linked_supabase_api_keys:${ref}`
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim()
  if (!url || !key) {
    throw new Error("Supabase URL/service role still unavailable after bootstrap.")
  }

  return {
    admin: createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
    envSource,
  }
}

function parseLeadIds(argv: string[]): string[] {
  const ids = argv.filter((a) => /^[0-9a-f-]{36}$/i.test(a))
  if (ids.length !== 3) {
    throw new Error("Provide exactly three lead UUIDs.")
  }
  return ids
}

async function main(): Promise<void> {
  const leadIds = parseLeadIds(process.argv.slice(2))
  const { admin, envSource } = await bootstrapProductionAdminAsync()
  const openAiSource = bootstrapOpenAiKeyFromLegacyHideFiles()

  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error(
      "OPENAI_API_KEY unavailable after vercel env run (encrypted empty placeholder) and legacy hide-file fallback.",
    )
  }

  if (!getGrowthEngineAiOrgId()) {
    throw new Error("GROWTH_ENGINE_AI_ORG_ID is not configured.")
  }

  console.log(`[${FUZOR_COMPANY_INTELLIGENCE_1A_QA_MARKER}] three-company proof starting`)
  console.log(
    JSON.stringify(
      {
        leadIds,
        architecture: "fuzor-company-intelligence-1a-gpt-business-understanding",
        expectedModel: "gpt-5.5",
        persist: false,
        envBootstrapMethod: envSource,
        openAiBootstrapMethod: openAiSource ?? "process_env",
        growthOrgConfigured: Boolean(process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()),
        vercelProductionEnvRun: process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN === "1",
      },
      null,
      2,
    ),
  )

  for (const leadId of leadIds) {
    console.log("\n============================================================")
    console.log(`COMPANY LEAD ${leadId}`)

    const legacy = await loadLegacyDeterministicCompanyInterpretation({ admin, leadId })
    const result = await runFuzorCompanyIntelligence({
      admin,
      leadId,
      actingUserEmail: process.env.GROWTH_PROOF_ACTOR_EMAIL?.trim() || "proof@equipify.local",
    })

    if (!result.ok) {
      console.log(
        JSON.stringify(
          {
            ok: false,
            leadId,
            code: result.code,
            message: result.message,
            legacyDeterministic: legacy,
          },
          null,
          2,
        ),
      )
      continue
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          leadId,
          company: result.output.companyName,
          website: result.output.website,
          evidencePacket: result.output.evidencePacket,
          legacyDeterministic: legacy,
          understanding: result.output.understanding,
          provider: result.output.provider,
          model: result.output.model,
          modelAttempts: result.output.modelAttempts,
          retryOccurred: result.output.modelAttempts > 1,
          generationMode: result.output.generationMode,
          durationMs: result.output.durationMs,
          persist: false,
        },
        null,
        2,
      ),
    )
  }

  console.log(`\n[${FUZOR_COMPANY_INTELLIGENCE_1A_QA_MARKER}] three-company proof complete`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
