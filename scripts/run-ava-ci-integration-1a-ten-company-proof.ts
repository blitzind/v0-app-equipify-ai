/**
 * AVA-COMPANY-INTELLIGENCE-INTEGRATION-1A — Ten-company production proof.
 * Persistence disabled. Outbound unauthorized. Does not change live operator routes.
 *
 * Usage:
 *   pnpm run:ava-ci-integration-1a-ten-company-proof
 *   pnpm run:ava-ci-integration-1a-ten-company-proof -- <leadId...>
 */

import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "../lib/growth/access"
import { listGrowthLeadDecisionMakers } from "../lib/growth/decision-maker-repository"
import { AVA_CI_INTEGRATION_1A_QA_MARKER } from "../lib/fuzor/ava-reasoning"
import { loadCompanyIntelligence } from "../lib/fuzor/company-intelligence"
import {
  EQUIPIFY_AVA_DEPLOYMENT_OBJECTIVE,
  runEquipifyAvaReasoning,
} from "../lib/growth/ava-reasoning/equipify-ava-reasoning-adapter"
import {
  modulesToBypassImmediately,
  modulesToDeleteAfterValidation,
} from "../lib/growth/ava-reasoning/ava-legacy-interpretation-audit"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  fetchSupabaseServiceRoleKeyFromCli,
  resolveLinkedSupabaseProjectRef,
  resolveSupabaseUrlForProjectRef,
} from "../lib/growth/qa/supabase-cli-linked-project-bootstrap"

const SEED_LEADS = [
  { leadId: "6d9220f0-2960-468c-b4be-5d7595d292c3", label: "Block Imaging", expected: "pursue" },
  {
    leadId: "9ac9c211-f856-4caf-b41b-d8a96e756291",
    label: "Blitz Industries",
    expected: "hold_unless_richer_evidence",
  },
  {
    leadId: "03a361d3-e6b6-42e6-bc78-a5773acc1725",
    label: "Best Buy",
    expected: "hold_or_reject",
  },
] as const

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

function parseExplicitLeadIds(argv: string[]): string[] {
  return argv.filter((a) => /^[0-9a-f-]{36}$/i.test(a))
}

async function selectAdditionalLeadIds(
  admin: SupabaseClient,
  exclude: Set<string>,
  targetCount: number,
): Promise<Array<{ leadId: string; companyName: string; reason: string }>> {
  const { data: rows, error } = await admin
    .schema("growth")
    .from("leads")
    .select("id, company_name, website, contact_email, contact_name, status, updated_at")
    .not("company_name", "is", null)
    .order("updated_at", { ascending: false })
    .limit(80)

  if (error) throw new Error(`lead inventory query failed: ${error.message}`)

  const selected: Array<{ leadId: string; companyName: string; reason: string }> = []
  const seenNames = new Set<string>()
  const buckets = {
    withWebsite: 0,
    withoutWebsite: 0,
    withoutContact: 0,
    nonFit: 0,
    serviceName: 0,
    ambiguous: 0,
  }

  for (const row of rows ?? []) {
    const leadId = String(row.id)
    if (exclude.has(leadId)) continue
    const companyName = String(row.company_name ?? "Unknown")
    const nameKey = companyName.trim().toLowerCase()
    if (seenNames.has(nameKey)) continue
    const website = typeof row.website === "string" ? row.website.trim() : ""
    const contactEmail = typeof row.contact_email === "string" ? row.contact_email.trim() : ""

    const dms = await listGrowthLeadDecisionMakers(admin, leadId).catch(() => [])
    const hasDm = dms.some((d) => d.status !== "rejected")

    let reason: string | null = null
    if (website && hasDm && buckets.withWebsite < 2) {
      reason = "inventory_with_website_and_dm"
      buckets.withWebsite += 1
    } else if (website && !hasDm && !contactEmail && buckets.withoutContact < 2) {
      reason = "thin_or_no_decision_maker"
      buckets.withoutContact += 1
    } else if (!website && buckets.withoutWebsite < 1) {
      // One thin no-website sample is enough; bridge may fail without company_id.
      reason = "thin_evidence_no_website"
      buckets.withoutWebsite += 1
    } else if (
      website &&
      /retail|store|consumer|walmart|amazon|target\b/i.test(companyName) &&
      buckets.nonFit < 1
    ) {
      reason = "likely_non_fit_name"
      buckets.nonFit += 1
    } else if (
      website &&
      /service|equipment|repair|field|imaging|medical|hvac|fleet|lift/i.test(companyName) &&
      buckets.serviceName < 2
    ) {
      reason = "name_suggests_equipment_service"
      buckets.serviceName += 1
    } else if (website && buckets.ambiguous < 2) {
      reason = "ambiguous_inventory_sample"
      buckets.ambiguous += 1
    }

    if (!reason) continue
    selected.push({ leadId, companyName, reason })
    seenNames.add(nameKey)
    exclude.add(leadId)
    if (selected.length >= targetCount) break
  }

  return selected
}

async function main(): Promise<void> {
  const { admin, envSource } = await bootstrapProductionAdminAsync()
  const openAiSource = bootstrapOpenAiKeyFromLegacyHideFiles()
  if (!process.env.OPENAI_API_KEY?.trim()) throw new Error("OPENAI_API_KEY unavailable.")

  const ownerOrganizationId = getGrowthEngineAiOrgId()
  if (!ownerOrganizationId) throw new Error("GROWTH_ENGINE_AI_ORG_ID unavailable.")

  const explicit = parseExplicitLeadIds(process.argv.slice(2))
  const exclude = new Set<string>(SEED_LEADS.map((s) => s.leadId))
  const additional =
    explicit.length >= 10
      ? explicit.slice(3, 10).map((leadId) => ({
          leadId,
          companyName: "(explicit)",
          reason: "explicit_cli",
        }))
      : await selectAdditionalLeadIds(admin, exclude, 7)

  const queue: Array<{
    leadId: string
    label: string
    expected: string
    sampleReason?: string
  }> = [
    ...SEED_LEADS.map((s) => ({
      leadId: s.leadId,
      label: s.label,
      expected: s.expected,
      sampleReason: "seed",
    })),
    ...additional.map((a) => ({
      leadId: a.leadId,
      label: a.companyName,
      expected: "open",
      sampleReason: a.reason,
    })),
  ].slice(0, 10)

  console.log(`[${AVA_CI_INTEGRATION_1A_QA_MARKER}] ten-company proof starting`)
  console.log(
    JSON.stringify(
      {
        ownerOrganizationId,
        objective: EQUIPIFY_AVA_DEPLOYMENT_OBJECTIVE,
        persistence: "disabled",
        outboundSendAuthorized: false,
        companyCount: queue.length,
        envBootstrapMethod: envSource,
        openAiBootstrapMethod: openAiSource ?? "process_env",
        bypassImmediately: modulesToBypassImmediately().map((m) => m.module),
        deleteAfterValidation: modulesToDeleteAfterValidation().map((m) => m.module),
        queue: queue.map((q) => ({
          leadId: q.leadId,
          label: q.label,
          expected: q.expected,
          sampleReason: q.sampleReason,
        })),
      },
      null,
      2,
    ),
  )

  const foreignOrgId = "00000000-0000-4000-8000-000000000099"
  const results: Array<Record<string, unknown>> = []

  for (const item of queue) {
    console.log("\n============================================================")
    console.log(`AVA REASONING ${item.label} (${item.leadId})`)

    const run = await runEquipifyAvaReasoning({
      admin,
      leadId: item.leadId,
      actingUserEmail: process.env.GROWTH_PROOF_ACTOR_EMAIL?.trim() || "proof@equipify.local",
      ownerOrganizationId,
      persist: false,
    })

    if (!run.ok) {
      const row = {
        ok: false,
        companyName: item.label,
        leadId: item.leadId,
        expected: item.expected,
        sampleReason: item.sampleReason,
        code: run.code,
        message: run.message,
        persistenceStatus: "disabled",
      }
      results.push(row)
      console.log(JSON.stringify(row, null, 2))
      continue
    }

    const ci = await loadCompanyIntelligence({
      admin,
      ownerOrganizationId,
      versionId: run.companyIntelligenceVersionId,
    })

    const crossTenant = await loadCompanyIntelligence({
      admin,
      ownerOrganizationId: foreignOrgId,
      versionId: run.companyIntelligenceVersionId,
    })

    const row = {
      ok: true,
      companyName: run.output.companyName,
      leadId: item.leadId,
      expected: item.expected,
      sampleReason: item.sampleReason,
      ownerOrganizationId: run.output.ownerOrganizationId,
      companyIntelligenceVersionId: run.companyIntelligenceVersionId,
      evidenceFingerprint: run.evidenceFingerprint,
      ciReused: run.ciReused,
      ciRegenerated: run.ciRegenerated,
      companyIntelligenceSummary: ci?.understanding.executiveSummary ?? null,
      equipifyKnowledgeBase: {
        source: run.organizationKnowledge.source,
        versionId: run.organizationKnowledge.versionId,
        organizationName: run.organizationKnowledge.organizationName,
      },
      contactsSupplied: run.output.contactsSupplied.map((c) => ({
        contactId: c.contactId,
        name: c.name,
        title: c.title,
        email: c.email,
        contactabilityStatus: c.contactabilityStatus,
        evidenceSource: c.evidenceSource,
      })),
      decision: run.output.result.decision,
      rationale: run.output.result.rationale,
      strongestAngle: run.output.result.strongestAngle,
      recommendedContact: run.output.result.recommendedContact,
      missingInformation: run.output.result.missingInformation,
      email: run.output.result.email,
      evidenceReferences: run.output.result.evidenceReferences,
      model: run.output.model,
      provider: run.output.provider,
      runtimeMs: run.output.durationMs,
      promptTokens: run.output.promptTokens,
      completionTokens: run.output.completionTokens,
      persistenceStatus: run.output.persistenceStatus,
      outboundSendAuthorized: run.output.outboundSendAuthorized,
      crossTenantDenied: crossTenant === null,
      emailPolicyOk:
        run.output.result.decision === "pursue"
          ? // pursue may omit email when no responsible recipient exists
            run.output.result.email == null ||
            Boolean(run.output.result.email.subject && run.output.result.email.body)
          : run.output.result.email == null,
    }

    results.push(row)
    console.log(JSON.stringify(row, null, 2))
  }

  const pursueWithEmail = results.filter(
    (r) => r.ok && r.decision === "pursue" && r.email != null,
  ).length
  const holdOrRejectNoEmail = results.filter(
    (r) =>
      r.ok &&
      (r.decision === "hold" || r.decision === "reject") &&
      r.email == null,
  ).length
  const crossTenantOk = results.every((r) => !r.ok || r.crossTenantDenied === true)

  console.log(`\n[${AVA_CI_INTEGRATION_1A_QA_MARKER}] ten-company proof complete`)
  console.log(
    JSON.stringify(
      {
        total: results.length,
        ok: results.filter((r) => r.ok).length,
        pursueWithEmail,
        holdOrRejectNoEmail,
        crossTenantOk,
        decisions: results.map((r) => ({
          companyName: r.companyName,
          decision: r.decision ?? null,
          ok: r.ok,
          emailPolicyOk: r.emailPolicyOk ?? null,
        })),
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
