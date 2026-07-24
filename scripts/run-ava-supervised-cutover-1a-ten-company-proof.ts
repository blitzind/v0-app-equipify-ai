/**
 * AVA-SUPERVISED-CUTOVER-1A — Ten-company supervised cutover proof.
 * Persistence disabled for proof safety unless --persist flag passed.
 *
 * Usage:
 *   pnpm run:ava-supervised-cutover-1a-ten-company-proof
 *   pnpm run:ava-supervised-cutover-1a-ten-company-proof -- --persist
 */

import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "../lib/growth/access"
import { listGrowthLeadDecisionMakers } from "../lib/growth/decision-maker-repository"
import {
  AVA_SUPERVISED_CUTOVER_1A_QA_MARKER,
  runEquipifySupervisedAvaOutreach,
} from "../lib/growth/ava-reasoning/equipify-supervised-cutover-service"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  fetchSupabaseServiceRoleKeyFromCli,
  resolveLinkedSupabaseProjectRef,
  resolveSupabaseUrlForProjectRef,
} from "../lib/growth/qa/supabase-cli-linked-project-bootstrap"

const SEED_LEADS = [
  { leadId: "6d9220f0-2960-468c-b4be-5d7595d292c3", label: "Block Imaging" },
  { leadId: "34b85fb6-dc58-44db-8483-8cf12bdebce8", label: "Hughes Property Management" },
  { leadId: "03a361d3-e6b6-42e6-bc78-a5773acc1725", label: "Best Buy" },
] as const

function bootstrapOpenAiKeyFromLegacyHideFiles(cwd = process.cwd()): string | null {
  if (process.env.OPENAI_API_KEY?.trim()) return "process_env"
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
  return {
    admin: createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(), process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(), {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    envSource,
  }
}

async function selectAdditionalLeadIds(
  admin: SupabaseClient,
  exclude: Set<string>,
  targetCount: number,
): Promise<Array<{ leadId: string; companyName: string }>> {
  const { data: rows } = await admin
    .schema("growth")
    .from("leads")
    .select("id, company_name, website, contact_email, updated_at")
    .not("company_name", "is", null)
    .order("updated_at", { ascending: false })
    .limit(80)

  const selected: Array<{ leadId: string; companyName: string }> = []
  const seen = new Set<string>()

  for (const row of rows ?? []) {
    const leadId = String(row.id)
    if (exclude.has(leadId)) continue
    const companyName = String(row.company_name ?? "Unknown")
    const key = companyName.trim().toLowerCase()
    if (seen.has(key)) continue
    const website = typeof row.website === "string" ? row.website.trim() : ""
    const dms = await listGrowthLeadDecisionMakers(admin, leadId).catch(() => [])
    const hasDm = dms.some((d) => d.status !== "rejected")
    if (!website && !hasDm && selected.filter((s) => s.companyName.toLowerCase().includes("property")).length >= 1) {
      continue
    }
    selected.push({ leadId, companyName })
    seen.add(key)
    exclude.add(leadId)
    if (selected.length >= targetCount) break
  }

  return selected
}

async function main(): Promise<void> {
  const persist = process.argv.includes("--persist")
  const { admin, envSource } = await bootstrapProductionAdminAsync()
  bootstrapOpenAiKeyFromLegacyHideFiles()
  if (!process.env.OPENAI_API_KEY?.trim()) throw new Error("OPENAI_API_KEY unavailable.")

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) throw new Error("GROWTH_ENGINE_AI_ORG_ID unavailable.")

  const exclude = new Set<string>(SEED_LEADS.map((s) => s.leadId))
  const additional = await selectAdditionalLeadIds(admin, exclude, 7)
  const queue = [...SEED_LEADS.map((s) => ({ ...s, sampleReason: "seed" })), ...additional.map((a) => ({ ...a, sampleReason: "inventory" }))].slice(0, 10)

  console.log(`[${AVA_SUPERVISED_CUTOVER_1A_QA_MARKER}] ten-company proof starting`)
  console.log(
    JSON.stringify(
      {
        organizationId,
        persist,
        outboundSendAuthorized: false,
        openAiBootstrap: envSource,
        queue: queue.map((q) => ({ leadId: q.leadId, label: q.label })),
      },
      null,
      2,
    ),
  )

  const results: Array<Record<string, unknown>> = []

  for (const item of queue) {
    console.log(`\n============================================================`)
    console.log(`SUPERVISED CUTOVER ${item.label} (${item.leadId})`)

    const run = await runEquipifySupervisedAvaOutreach({
      admin,
      leadId: item.leadId,
      actingUserId: "00000000-0000-4000-8000-000000000001",
      actingUserEmail: process.env.GROWTH_PROOF_ACTOR_EMAIL?.trim() || "proof@equipify.local",
      organizationId,
      persist,
    })

    if (!run.ok) {
      const row = { ok: false, companyName: item.label, leadId: item.leadId, code: run.code, message: run.message }
      results.push(row)
      console.log(JSON.stringify(row, null, 2))
      continue
    }

    const o = run.output
    const row = {
      ok: true,
      companyName: o.companyName,
      leadId: item.leadId,
      decision: o.decision,
      rationale: o.rationale,
      recommendedContact: o.recommendedContact,
      missingInformation: o.missingInformation,
      email: o.email,
      signatureApplied: o.signatureApplied,
      approvedSender: o.approvedSender,
      companyIdentityUnresolved: o.companyIdentityUnresolved,
      companyIntelligenceVersionId: o.companyIntelligenceVersionId,
      ciReused: o.ciReused,
      persistenceStatus: o.persistenceStatus,
      model: o.model,
      runtimeMs: o.durationMs,
      operatorReviewPrompt: o.decision === "pursue" && o.email ? "Michael: Would send / small edit / would not send?" : null,
    }
    results.push(row)
    console.log(JSON.stringify(row, null, 2))
  }

  console.log(`\n[${AVA_SUPERVISED_CUTOVER_1A_QA_MARKER}] complete`)
  console.log(
    JSON.stringify(
      {
        total: results.length,
        ok: results.filter((r) => r.ok).length,
        pursueWithEmail: results.filter((r) => r.ok && r.decision === "pursue" && r.email).length,
        holdOrRejectNoEmail: results.filter(
          (r) => r.ok && (r.decision === "hold" || r.decision === "reject") && r.email == null,
        ).length,
        identityUnresolved: results.filter((r) => r.ok && r.companyIdentityUnresolved).length,
        signaturesApplied: results.filter((r) => r.ok && r.signatureApplied).length,
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
