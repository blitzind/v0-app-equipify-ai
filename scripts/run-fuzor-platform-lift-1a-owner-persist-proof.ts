/**
 * FUZOR-PLATFORM-LIFT-1A — Prove durable ownerOrganizationId on a forced regenerate.
 */

import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "../lib/growth/access"
import {
  ensureCompanyIntelligence,
  loadCompanyIntelligence,
} from "../lib/fuzor/company-intelligence"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  fetchSupabaseServiceRoleKeyFromCli,
  resolveLinkedSupabaseProjectRef,
  resolveSupabaseUrlForProjectRef,
} from "../lib/growth/qa/supabase-cli-linked-project-bootstrap"

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

async function main(): Promise<void> {
  const boot = bootstrapVerifiedChannelsCertEnv()
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    const ref = resolveLinkedSupabaseProjectRef()
    if (!ref) throw new Error("Supabase credentials unavailable.")
    process.env.NEXT_PUBLIC_SUPABASE_URL = resolveSupabaseUrlForProjectRef(ref)
    process.env.SUPABASE_SERVICE_ROLE_KEY = await fetchSupabaseServiceRoleKeyFromCli(ref)
  }
  bootstrapOpenAiKeyFromLegacyHideFiles()

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const ownerOrganizationId = getGrowthEngineAiOrgId()
  if (!ownerOrganizationId) throw new Error("GROWTH_ENGINE_AI_ORG_ID unavailable.")

  const leadId = "03a361d3-e6b6-42e6-bc78-a5773acc1725"
  const ensured = await ensureCompanyIntelligence({
    admin,
    ownerOrganizationId,
    leadId,
    forceRegenerate: true,
    actingUserEmail: "proof@equipify.local",
  })
  if (!ensured.ok) {
    console.log(JSON.stringify({ ok: false, boot: boot.source, ...ensured }, null, 2))
    process.exit(1)
  }

  const { data: run } = await admin
    .schema("growth")
    .from("company_intelligence_runs")
    .select("id, metadata")
    .eq("id", ensured.record.id)
    .single()

  const meta =
    run?.metadata && typeof run.metadata === "object"
      ? (run.metadata as Record<string, unknown>)
      : {}
  const doc =
    meta.fuzor_company_intelligence_2a && typeof meta.fuzor_company_intelligence_2a === "object"
      ? (meta.fuzor_company_intelligence_2a as Record<string, unknown>)
      : {}

  const foreign = await loadCompanyIntelligence({
    admin,
    ownerOrganizationId: "00000000-0000-4000-8000-000000000099",
    versionId: ensured.record.id,
  })

  console.log(
    JSON.stringify(
      {
        ok: true,
        versionId: ensured.record.id,
        regenerated: ensured.regenerated,
        recordOwner: ensured.record.ownerOrganizationId,
        metadataOwner: meta.owner_organization_id ?? null,
        documentOwner: doc.ownerOrganizationId ?? null,
        durableOwnerPersisted:
          meta.owner_organization_id === ownerOrganizationId &&
          doc.ownerOrganizationId === ownerOrganizationId,
        crossTenantDenied: foreign === null,
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
