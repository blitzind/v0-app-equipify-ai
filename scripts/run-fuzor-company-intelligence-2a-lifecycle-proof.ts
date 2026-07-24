/**
 * FUZOR-PLATFORM-LIFT-1A — Lifecycle proof (org-owned Company Intelligence).
 *
 * Raw Evidence → Company Intelligence → Persist → Reload → AI Employee consume
 * Also verifies reuse when evidence fingerprint is unchanged + tenant isolation.
 *
 * Usage:
 *   pnpm run:fuzor-company-intelligence-2a-lifecycle-proof -- <leadId1> <leadId2> <leadId3>
 */

import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "../lib/growth/access"
import { resolveCanonicalCompanyIdForLead } from "../lib/growth/canonical-persons/canonical-person-repository-core"
import {
  companyIntelligenceUnderstandingFingerprint,
  consumeCompanyIntelligenceForAiEmployee,
  ensureCompanyIntelligence,
  loadCompanyIntelligence,
} from "../lib/fuzor/company-intelligence"
import { isFuzorCompanyIntelligenceVersionsSchemaReady } from "../lib/fuzor/company-intelligence"
import {
  FUZOR_COMPANY_INTELLIGENCE_2A_QA_MARKER,
  FUZOR_PLATFORM_LIFT_1A_QA_MARKER,
} from "../lib/fuzor/company-intelligence"
import {
  FUZOR_COMPANY_INTELLIGENCE_CONSUMER_MIGRATION_AUDIT,
  estimateDuplicatedInterpretationReductionPercent,
} from "../lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-consumer-migration-audit"
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
      return `legacy_hide_file:${relative}`
    }
  }
  return null
}

async function bootstrapProductionAdminAsync() {
  const boot = bootstrapVerifiedChannelsCertEnv()
  let envSource = boot.source
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    const ref = resolveLinkedSupabaseProjectRef()
    if (!ref) throw new Error("Supabase credentials unavailable.")
    process.env.NEXT_PUBLIC_SUPABASE_URL = resolveSupabaseUrlForProjectRef(ref)
    process.env.SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
    process.env.SUPABASE_SERVICE_ROLE_KEY = await fetchSupabaseServiceRoleKeyFromCli(ref)
    envSource = `linked_supabase_api_keys:${ref}`
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim()
  return {
    admin: createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
    envSource,
  }
}

function parseLeadIds(argv: string[]): string[] {
  const ids = argv.filter((a) => /^[0-9a-f-]{36}$/i.test(a))
  if (ids.length !== 3) throw new Error("Provide exactly three lead UUIDs.")
  return ids
}

async function main(): Promise<void> {
  const leadIds = parseLeadIds(process.argv.slice(2))
  const { admin, envSource } = await bootstrapProductionAdminAsync()
  const openAiSource = bootstrapOpenAiKeyFromLegacyHideFiles()
  if (!process.env.OPENAI_API_KEY?.trim()) throw new Error("OPENAI_API_KEY unavailable.")

  const ownerOrganizationId = getGrowthEngineAiOrgId()
  if (!ownerOrganizationId) throw new Error("GROWTH_ENGINE_AI_ORG_ID unavailable.")

  const dedicatedTableReady = await isFuzorCompanyIntelligenceVersionsSchemaReady(admin)
  const foreignOrgId = "00000000-0000-4000-8000-000000000099"

  console.log(`[${FUZOR_PLATFORM_LIFT_1A_QA_MARKER}] lifecycle proof starting`)
  console.log(
    JSON.stringify(
      {
        qaMarkers: [FUZOR_PLATFORM_LIFT_1A_QA_MARKER, FUZOR_COMPANY_INTELLIGENCE_2A_QA_MARKER],
        ownerOrganizationId,
        leadIds,
        expectedModel: "gpt-5.5",
        dedicatedTableReady,
        storageMode: dedicatedTableReady
          ? "fuzor_versions_table"
          : "company_intelligence_runs_bridge",
        envBootstrapMethod: envSource,
        openAiBootstrapMethod: openAiSource ?? "process_env",
        duplicatedInterpretationReductionEstimatePct:
          estimateDuplicatedInterpretationReductionPercent(),
        consumerMigrationCount: FUZOR_COMPANY_INTELLIGENCE_CONSUMER_MIGRATION_AUDIT.length,
      },
      null,
      2,
    ),
  )

  for (const leadId of leadIds) {
    console.log("\n============================================================")
    console.log(`LIFECYCLE ${leadId}`)

    const companyId = await resolveCanonicalCompanyIdForLead(admin, leadId)

    const first = await ensureCompanyIntelligence({
      admin,
      ownerOrganizationId,
      leadId,
      actingUserEmail: process.env.GROWTH_PROOF_ACTOR_EMAIL?.trim() || "proof@equipify.local",
    })

    if (!first.ok) {
      console.log(JSON.stringify({ ok: false, leadId, companyId, phase: "ensure", ...first }, null, 2))
      continue
    }

    const reloaded = await loadCompanyIntelligence({
      admin,
      ownerOrganizationId,
      externalCompanyId: first.record.companyId,
      leadId,
      versionId: first.record.id,
    })

    const reloadMatch =
      reloaded != null &&
      reloaded.ownerOrganizationId === ownerOrganizationId &&
      companyIntelligenceUnderstandingFingerprint(reloaded.understanding) ===
        companyIntelligenceUnderstandingFingerprint(first.record.understanding) &&
      reloaded.evidenceFingerprint === first.record.evidenceFingerprint

    const crossTenant = await loadCompanyIntelligence({
      admin,
      ownerOrganizationId: foreignOrgId,
      externalCompanyId: first.record.companyId,
      versionId: first.record.id,
    })

    const consume = await consumeCompanyIntelligenceForAiEmployee({
      admin,
      ownerOrganizationId,
      externalCompanyId: first.record.companyId,
      leadId,
    })

    const consumeMatch =
      consume.ok &&
      consume.intelligence.ownerOrganizationId === ownerOrganizationId &&
      companyIntelligenceUnderstandingFingerprint(consume.intelligence.understanding) ===
        companyIntelligenceUnderstandingFingerprint(first.record.understanding)

    // Second ensure should reuse (no GPT) when fingerprint unchanged.
    const second = await ensureCompanyIntelligence({
      admin,
      ownerOrganizationId,
      leadId,
      actingUserEmail: process.env.GROWTH_PROOF_ACTOR_EMAIL?.trim() || "proof@equipify.local",
    })

    console.log(
      JSON.stringify(
        {
          ok: true,
          leadId,
          companyId,
          ownerOrganizationId: first.record.ownerOrganizationId,
          storageBackend: first.record.storageBackend,
          ensure: {
            reused: first.reused,
            regenerated: first.regenerated,
            reason: first.reason,
            versionId: first.record.id,
            evidenceFingerprint: first.record.evidenceFingerprint,
            model: first.record.model,
            durationMs: first.record.generationDurationMs,
            promptTokens: first.record.promptTokens,
            completionTokens: first.record.completionTokens,
          },
          reloadIdentical: reloadMatch,
          crossTenantDenied: crossTenant === null,
          aiEmployeeConsumeIdentical: consumeMatch,
          secondEnsure: second.ok
            ? {
                reused: second.reused,
                regenerated: second.regenerated,
                reason: second.reason,
                versionId: second.record.id,
                sameVersionAsFirst: second.record.id === first.record.id,
              }
            : { ok: false, code: second.code, message: second.message },
          understanding: first.record.understanding,
          evidenceRefs: first.record.evidenceRefs,
        },
        null,
        2,
      ),
    )
  }

  console.log(`\n[${FUZOR_PLATFORM_LIFT_1A_QA_MARKER}] lifecycle proof complete`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
