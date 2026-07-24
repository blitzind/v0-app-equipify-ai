/**
 * AVA-SIMPLE-OUTREACH-2A — Three-lead live proof (operator-selected IDs).
 *
 * Usage:
 *   pnpm run:ava-simple-outreach-1a-three-lead-proof -- <leadId1> <leadId2> <leadId3>
 *
 * Uses approved Production env bootstrap (vercel env run + verified-channels cert
 * fallback / linked Supabase CLI when Vercel encrypted secrets are empty locally).
 * Persistence defaults to OFF (`AVA_DIRECT_OUTREACH_PERSIST=1` to enable).
 * Does not send outbound.
 */

import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"
import { runAvaDirectOutreach } from "../lib/growth/ava-direct-outreach/ava-direct-outreach-service"
import { AVA_SIMPLE_OUTREACH_2A_QA_MARKER } from "../lib/growth/ava-direct-outreach/ava-direct-outreach-types"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  fetchSupabaseServiceRoleKeyFromCli,
  resolveLinkedSupabaseProjectRef,
  resolveSupabaseUrlForProjectRef,
} from "../lib/growth/qa/supabase-cli-linked-project-bootstrap"

/**
 * Vercel marks OPENAI_API_KEY as Encrypted — `vercel env run` materializes empty
 * placeholders locally (same class of issue as empty Supabase service role).
 * Approved local cert runners recover provider keys from renamed legacy hide files
 * created by `hideLegacyLocalEnvFiles` (never from an active `.env.local`).
 */
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

function bootstrapProductionAdmin(): {
  admin: ReturnType<typeof createClient>
  envSource: string
} {
  const boot = bootstrapVerifiedChannelsCertEnv({
    inheritProcessEnvProviderKeys: true,
    protectedSnapshot: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      SUPABASE_URL: process.env.SUPABASE_URL ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      GROWTH_ENGINE_AI_ORG_ID: process.env.GROWTH_ENGINE_AI_ORG_ID ?? "",
    },
  })

  let url = boot?.url ?? ""
  let jwt = boot?.jwt ?? ""
  let envSource = boot?.env_source ?? "none"

  const linkedRef = resolveLinkedSupabaseProjectRef()
  const linkedJwt = linkedRef ? fetchSupabaseServiceRoleKeyFromCli(linkedRef) : null
  if (linkedRef && linkedJwt) {
    url = resolveSupabaseUrlForProjectRef(linkedRef)
    jwt = linkedJwt
    envSource = `linked_supabase_api_keys:${linkedRef}`
    process.env.NEXT_PUBLIC_SUPABASE_URL = url
    process.env.SUPABASE_URL = url
    process.env.SUPABASE_SERVICE_ROLE_KEY = jwt
  }

  if (!url || !jwt) {
    throw new Error(
      "Production Supabase credentials unavailable after vercel env run + linked Supabase CLI bootstrap.",
    )
  }

  return {
    admin: createClient(url, jwt, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    envSource,
  }
}

async function main(): Promise<void> {
  const leadIds = process.argv.slice(2).filter((arg) => !arg.startsWith("-"))
  if (leadIds.length !== 3) {
    console.error(
      "Usage: pnpm run:ava-simple-outreach-1a-three-lead-proof -- <leadId1> <leadId2> <leadId3>",
    )
    process.exit(1)
  }

  const { admin, envSource } = bootstrapProductionAdmin()
  const openAiSource = bootstrapOpenAiKeyFromLegacyHideFiles()
  const persist = process.env.AVA_DIRECT_OUTREACH_PERSIST?.trim() === "1"

  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error(
      "OPENAI_API_KEY unavailable after vercel env run (encrypted empty placeholder) and legacy hide-file fallback.",
    )
  }

  console.log(`[${AVA_SIMPLE_OUTREACH_2A_QA_MARKER}] three-lead proof starting`)
  console.log(
    JSON.stringify(
      {
        leadIds,
        persist,
        outboundAuthorized: false,
        architecture: "ava-simple-outreach-2a-lean-reasoning",
        expectedModel: "gpt-5.5",
        envBootstrapMethod: envSource,
        openAiBootstrapMethod: openAiSource ?? "process_env",
        openAiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
        growthOrgConfigured: Boolean(process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()),
        vercelProductionEnvRun: process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN === "1",
      },
      null,
      2,
    ),
  )

  for (const leadId of leadIds) {
    console.log("\n============================================================")
    console.log(`LEAD ${leadId}`)
    const started = Date.now()
    const result = await runAvaDirectOutreach({
      admin,
      leadId,
      actingUserId:
        process.env.GROWTH_PROOF_ACTOR_USER_ID?.trim() || "00000000-0000-4000-8000-000000000001",
      actingUserEmail: process.env.GROWTH_PROOF_ACTOR_EMAIL?.trim() || "proof@equipify.local",
      persist,
    })
    const durationMs = Date.now() - started

    if (!result.ok) {
      console.log(
        JSON.stringify(
          {
            ok: false,
            leadId,
            code: result.code,
            message: result.message,
            durationMs,
            persist,
          },
          null,
          2,
        ),
      )
      continue
    }

    const { output } = result
    console.log(
      JSON.stringify(
        {
          ok: true,
          company: output.companyName,
          website: output.context.company.website,
          contact: output.contact,
          verifiedCompanyDescription: output.context.verifiedCompanyDescription,
          verifiedProductsServices: output.context.verifiedProductsServices,
          verifiedOperationalCapabilities: output.context.verifiedOperationalCapabilities,
          researchSummary: output.context.researchSummary,
          relevantWebsiteExcerpts: output.context.relevantWebsiteExcerpts,
          datamoonFindings: output.context.datamoonFindings,
          knownRisks: output.context.knownRisks,
          contextMissingInformation: output.context.missingInformation,
          decision: output.result.decision,
          confidence: output.result.confidence,
          fitSummary: output.result.fitSummary,
          supportingReasons: output.result.supportingReasons,
          concerns: output.result.concerns,
          salesAngle: output.result.salesAngle,
          recommendedContactRole: output.result.recommendedContactRole,
          subject: output.result.email?.subject ?? null,
          body: output.result.email?.body ?? null,
          evidenceUsed: output.result.evidenceUsed,
          missingInformation: output.result.missingInformation,
          persistedGenerationId: output.persistedGenerationId,
          provider: output.provider,
          model: output.model,
          modelAttempts: output.modelAttempts,
          retryOccurred: output.modelAttempts > 1,
          generationMode: output.generationMode,
          outboundAuthorized: output.outboundAuthorized,
          durationMs,
          persist,
        },
        null,
        2,
      ),
    )
  }

  console.log(`\n[${AVA_SIMPLE_OUTREACH_2A_QA_MARKER}] three-lead proof complete`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
