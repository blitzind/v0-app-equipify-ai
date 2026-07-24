/**
 * AVA-PERSISTED-OPERATOR-VALIDATION-1A — Persisted operator workflow proof.
 *
 * Usage:
 *   pnpm run:ava-persisted-operator-validation-1a
 */

import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import {
  fetchGrowthAiCopilotGenerationById,
  listGrowthAiCopilotGenerationsForLead,
} from "../lib/growth/ai-copilot-repository"
import { getGrowthEngineAiOrgId } from "../lib/growth/access"
import { getPlatformAdminEmails } from "../lib/platform-admin-policy"
import { listGrowthLeadDecisionMakers } from "../lib/growth/decision-maker-repository"
import { fetchGrowthLeadById } from "../lib/growth/lead-repository"
import { AVA_DIRECT_PRODUCTION_CUTOVER_1A_QA_MARKER } from "../lib/growth/ava-reasoning/ava-direct/equipify-ava-direct-reasoning"
import { findExistingAvaSupervisedSendableDraft } from "../lib/growth/ava-reasoning/equipify-supervised-draft-persistence"
import { runEquipifySupervisedAvaOutreach } from "../lib/growth/ava-reasoning/equipify-supervised-cutover-service"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  fetchSupabaseServiceRoleKeyFromCli,
  resolveLinkedSupabaseProjectRef,
  resolveSupabaseUrlForProjectRef,
} from "../lib/growth/qa/supabase-cli-linked-project-bootstrap"

export const AVA_PERSISTED_OPERATOR_VALIDATION_1A_QA_MARKER =
  "ava-persisted-operator-validation-1a-v1" as const

const CORE_COHORT = [
  {
    leadId: "6d9220f0-2960-468c-b4be-5d7595d292c3",
    label: "Block Imaging",
    role: "pursue_with_contact",
  },
  {
    leadId: "b06417cf-8c67-4705-82f3-0b62e3d08ca2",
    label: "NAES",
    role: "pursue_without_contact",
  },
  {
    leadId: "03a361d3-e6b6-42e6-bc78-a5773acc1725",
    label: "Best Buy",
    role: "reject",
  },
  {
    leadId: "34b85fb6-dc58-44db-8483-8cf12bdebce8",
    label: "Hughes Property Management",
    role: "hold",
  },
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

async function resolveActingUser(admin: SupabaseClient): Promise<{ userId: string; email: string }> {
  const preferredEmail = (
    process.env.GROWTH_PROOF_ACTOR_EMAIL?.trim() ||
    getPlatformAdminEmails()[0] ||
    "mike@blitzind.com"
  )
    .trim()
    .toLowerCase()
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw new Error(error.message)
  const match = data.users.find((user) => user.email?.trim().toLowerCase() === preferredEmail)
  if (!match?.id) throw new Error(`acting_user_not_found:${preferredEmail}`)
  return { userId: match.id, email: match.email ?? preferredEmail }
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

async function findAdditionalFitWithNamedDm(
  admin: SupabaseClient,
  exclude: Set<string>,
): Promise<{ leadId: string; label: string } | null> {
  const { data: rows } = await admin
    .schema("growth")
    .from("leads")
    .select("id, company_name, website")
    .not("website", "is", null)
    .order("updated_at", { ascending: false })
    .limit(60)

  for (const row of rows ?? []) {
    const leadId = String(row.id)
    if (exclude.has(leadId)) continue
    const website = typeof row.website === "string" ? row.website.trim() : ""
    if (!website) continue
    const dms = await listGrowthLeadDecisionMakers(admin, leadId)
    const named = dms.find(
      (dm) =>
        dm.status !== "rejected" &&
        dm.fullName?.trim() &&
        dm.email?.trim() &&
        !/block imaging|best buy|naes|hughes/i.test(String(row.company_name ?? "")),
    )
    if (named) {
      return { leadId, label: String(row.company_name ?? "Unknown") }
    }
  }
  return null
}

function countSignatureBlocks(body: string): number {
  return (body.match(/Ava Sinclair/gi) ?? []).length
}

function proxyOperatorReview(input: {
  label: string
  subject: string | null
  body: string | null
}): { verdict: string; edit: string | null } {
  if (!input.body?.trim()) {
    return { verdict: "n/a (no sendable draft)", edit: null }
  }
  const body = input.body
  const signatures = countSignatureBlocks(body)
  if (signatures !== 1) {
    return {
      verdict: "Would send with small edit",
      edit: signatures > 1 ? "Remove duplicate signature blocks." : "Ensure Ava signature is present once.",
    }
  }
  if (/pain point|struggling|broken|failing/i.test(body)) {
    return {
      verdict: "Would not send",
      edit: "Remove invented pain language; keep to public evidence only.",
    }
  }
  if (body.length > 2200) {
    return {
      verdict: "Would send with small edit",
      edit: "Trim one paragraph for tighter first-touch length.",
    }
  }
  return { verdict: "Would send", edit: null }
}

async function runLead(input: {
  admin: SupabaseClient
  organizationId: string
  leadId: string
  label: string
  role: string
  persist: boolean
  actingUserId: string
  actingUserEmail: string
}) {
  const lead = await fetchGrowthLeadById(input.admin, input.leadId)
  const beforeDrafts = await listGrowthAiCopilotGenerationsForLead(input.admin, input.leadId, 20)
  const started = Date.now()
  const run = await runEquipifySupervisedAvaOutreach({
    admin: input.admin,
    leadId: input.leadId,
    actingUserId: input.actingUserId,
    actingUserEmail: input.actingUserEmail,
    organizationId: input.organizationId,
    persist: input.persist,
  })
  const totalMs = Date.now() - started
  const afterDrafts = await listGrowthAiCopilotGenerationsForLead(input.admin, input.leadId, 20)

  if (!run.ok) {
    return {
      label: input.label,
      role: input.role,
      ok: false,
      code: run.code,
      message: run.message,
      totalMs,
    }
  }

  const o = run.output
  let persistedRecord = o.persistedGenerationId
    ? await fetchGrowthAiCopilotGenerationById(input.admin, o.persistedGenerationId)
    : null

  const sendableDrafts = afterDrafts.filter(
    (g) =>
      g.generationType === "cold_email" &&
      g.promptVariant === "ava_direct_production_cutover_1a" &&
      (g.status === "draft" || g.status === "approved") &&
      Boolean(g.generatedSubject?.trim()) &&
      Boolean(g.generatedContent?.trim()),
  )

  const review = proxyOperatorReview({
    label: input.label,
    subject: persistedRecord?.generatedSubject ?? o.email?.subject ?? null,
    body: persistedRecord?.generatedContent ?? o.email?.body ?? null,
  })

  return {
    label: input.label,
    role: input.role,
    ok: true,
    companyName: lead?.companyName ?? o.companyName,
    decision: o.decision,
    rationale: o.rationale,
    recommendedContact: o.recommendedContact,
    missingInformation: o.missingInformation,
    email: o.email,
    signatureApplied: o.signatureApplied,
    outboundSendAuthorized: o.outboundSendAuthorized,
    persistedGenerationId: o.persistedGenerationId,
    persistenceStatus: o.persistenceStatus,
    reasoningMs: o.durationMs,
    totalMs,
    draftCountBefore: beforeDrafts.length,
    draftCountAfter: afterDrafts.length,
    sendableDraftCount: sendableDrafts.length,
    persistedDraft: persistedRecord
      ? {
          id: persistedRecord.id,
          status: persistedRecord.status,
          subject: persistedRecord.generatedSubject,
          body: persistedRecord.generatedContent,
          promptVersion: persistedRecord.promptVersion,
          promptVariant: persistedRecord.promptVariant,
          classification: persistedRecord.classification,
        }
      : null,
    operatorReview: review,
  }
}

async function main(): Promise<void> {
  const admin = await bootstrapProductionAdminAsync()
  bootstrapOpenAiKeyFromLegacyHideFiles()
  if (!process.env.OPENAI_API_KEY?.trim()) throw new Error("OPENAI_API_KEY unavailable.")

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) throw new Error("GROWTH_ENGINE_AI_ORG_ID unavailable.")

  const actingUser = await resolveActingUser(admin)

  const exclude = new Set(CORE_COHORT.map((c) => c.leadId))
  const additional = await findAdditionalFitWithNamedDm(admin, exclude)
  if (!additional) throw new Error("Could not find additional fit lead with named DM.")

  const cohort = [
    CORE_COHORT[0],
    {
      leadId: additional.leadId,
      label: additional.label,
      role: "pursue_with_named_dm" as const,
    },
    CORE_COHORT[1],
    CORE_COHORT[2],
    CORE_COHORT[3],
  ]

  console.log(`\n=== ${AVA_PERSISTED_OPERATOR_VALIDATION_1A_QA_MARKER} ===\n`)
  console.log(`directQaMarker=${AVA_DIRECT_PRODUCTION_CUTOVER_1A_QA_MARKER}`)
  console.log(`organizationId=${organizationId}`)
  console.log(`persistence=enabled\n`)

  const results: Array<Record<string, unknown>> = []

  for (const item of cohort) {
    console.log(`--- Running ${item.label} (${item.role}) ---`)
    const row = await runLead({
      admin,
      organizationId,
      leadId: item.leadId,
      label: item.label,
      role: item.role,
      persist: true,
      actingUserId: actingUser.userId,
      actingUserEmail: actingUser.email,
    })
    results.push(row)
    console.log(JSON.stringify(row, null, 2))
    console.log("")
  }

  console.log("--- Duplicate run: Block Imaging (second pass) ---")
  const beforeDup = await findExistingAvaSupervisedSendableDraft(admin, CORE_COHORT[0].leadId)
  const dupRun = await runLead({
    admin,
    organizationId,
    leadId: CORE_COHORT[0].leadId,
    label: "Block Imaging (duplicate run)",
    role: "duplicate_proof",
    persist: true,
    actingUserId: actingUser.userId,
    actingUserEmail: actingUser.email,
  })
  const afterDup = await findExistingAvaSupervisedSendableDraft(admin, CORE_COHORT[0].leadId)
  const dupResult = {
    ...dupRun,
    existingBeforeId: beforeDup?.id ?? null,
    existingAfterId: afterDup?.id ?? null,
    duplicatePrevented:
      dupRun.ok === true &&
      dupRun.persistenceStatus === "duplicate_reused" &&
      beforeDup?.id === afterDup?.id,
  }
  results.push(dupResult)
  console.log(JSON.stringify(dupResult, null, 2))

  console.log("\n=== SUMMARY JSON ===")
  console.log(JSON.stringify(results, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
