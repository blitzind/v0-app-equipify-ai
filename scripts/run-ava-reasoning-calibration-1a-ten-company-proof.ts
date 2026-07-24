/**
 * AVA-REASONING-CALIBRATION-1A — Ten-company calibration proof (fixed cohort).
 * Run: pnpm run:ava-reasoning-calibration-1a-ten-company-proof
 */

import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "../lib/growth/access"
import { AVA_REASONING_CALIBRATION_1A_QA_MARKER } from "../lib/growth/ava-reasoning/equipify-ava-sales-calibration"
import { runEquipifySupervisedAvaOutreach } from "../lib/growth/ava-reasoning/equipify-supervised-cutover-service"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  fetchSupabaseServiceRoleKeyFromCli,
  resolveLinkedSupabaseProjectRef,
  resolveSupabaseUrlForProjectRef,
} from "../lib/growth/qa/supabase-cli-linked-project-bootstrap"

/** Same ten-company cohort as AVA-SUPERVISED-CUTOVER-1A proof for before/after comparison. */
const COHORT = [
  { leadId: "6d9220f0-2960-468c-b4be-5d7595d292c3", label: "Block Imaging", priorDecision: "pursue" },
  {
    leadId: "34b85fb6-dc58-44db-8483-8cf12bdebce8",
    label: "Hughes Property Management",
    priorDecision: "hold",
  },
  { leadId: "03a361d3-e6b6-42e6-bc78-a5773acc1725", label: "Best Buy", priorDecision: "hold" },
  { leadId: "5599b1b3-36c1-4da3-bbef-1e293b3c965c", label: "vivint smart home", priorDecision: "hold" },
  { leadId: "b06417cf-8c67-4705-82f3-0b62e3d08ca2", label: "naes", priorDecision: "hold" },
  { leadId: "03f6dd92-1057-4b16-ae17-c18a16d8fc89", label: "solar turbines", priorDecision: "hold" },
  { leadId: "5f937f96-d0a1-41d5-82ae-ca10482443b1", label: "superior lift", priorDecision: "hold" },
  {
    leadId: "450f7bdf-0f93-40ca-a27f-02d0273a0254",
    label: "blackhawk engineering",
    priorDecision: "reject",
  },
  {
    leadId: "dc60de5c-225d-475b-9832-60bdba5e28e4",
    label: "nextier oilfield solutions",
    priorDecision: "hold",
  },
  {
    leadId: "9706297b-5ab8-4d82-b2aa-dd3262487f16",
    label: "gcp applied technologies",
    priorDecision: "hold",
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

async function main(): Promise<void> {
  bootstrapVerifiedChannelsCertEnv()
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    const ref = resolveLinkedSupabaseProjectRef()
    if (!ref) throw new Error("Supabase credentials unavailable.")
    process.env.NEXT_PUBLIC_SUPABASE_URL = resolveSupabaseUrlForProjectRef(ref)
    process.env.SUPABASE_SERVICE_ROLE_KEY = await fetchSupabaseServiceRoleKeyFromCli(ref)
  }
  bootstrapOpenAiKeyFromLegacyHideFiles()
  if (!process.env.OPENAI_API_KEY?.trim()) throw new Error("OPENAI_API_KEY unavailable.")

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) throw new Error("GROWTH_ENGINE_AI_ORG_ID unavailable.")

  console.log(`[${AVA_REASONING_CALIBRATION_1A_QA_MARKER}] ten-company calibration proof`)
  console.log(JSON.stringify({ organizationId, cohortSize: COHORT.length }, null, 2))

  const results: Array<Record<string, unknown>> = []

  for (const item of COHORT) {
    console.log(`\n============================================================`)
    console.log(`${item.label} (${item.leadId}) — prior: ${item.priorDecision}`)

    const run = await runEquipifySupervisedAvaOutreach({
      admin: createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
        process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
        { auth: { persistSession: false, autoRefreshToken: false } },
      ),
      leadId: item.leadId,
      actingUserId: "00000000-0000-4000-8000-000000000001",
      actingUserEmail: process.env.GROWTH_PROOF_ACTOR_EMAIL?.trim() || "proof@equipify.local",
      organizationId,
      persist: false,
    })

    if (!run.ok) {
      results.push({ ok: false, ...item, code: run.code, message: run.message })
      console.log(JSON.stringify({ ok: false, code: run.code, message: run.message }, null, 2))
      continue
    }

    const o = run.output
    const row = {
      ok: true,
      companyName: o.companyName,
      leadId: item.leadId,
      priorDecision: item.priorDecision,
      decision: o.decision,
      decisionChanged: o.decision !== item.priorDecision,
      rationale: o.rationale,
      evidenceUsed: o.evidenceReferences,
      whySufficientOrNot: o.rationale,
      strongestAngle: o.strongestAngle,
      recommendedContact: o.recommendedContact,
      missingInformation: o.missingInformation,
      email: o.email,
      signatureApplied: o.signatureApplied,
      companyIdentityUnresolved: o.companyIdentityUnresolved,
      model: o.model,
      runtimeMs: o.durationMs,
    }
    results.push(row)
    console.log(JSON.stringify(row, null, 2))
  }

  const holds = results.filter((r) => r.ok && r.decision === "hold").length
  const pursues = results.filter((r) => r.ok && r.decision === "pursue").length
  const rejects = results.filter((r) => r.ok && r.decision === "reject").length
  const changed = results.filter((r) => r.ok && r.decisionChanged).length
  const priorHolds = COHORT.filter((c) => c.priorDecision === "hold").length
  const thinEvidenceNowPursue = results.filter(
    (r) =>
      r.ok &&
      r.priorDecision === "hold" &&
      r.decision === "pursue" &&
      r.leadId !== "34b85fb6-dc58-44db-8483-8cf12bdebce8",
  )

  console.log(`\n[${AVA_REASONING_CALIBRATION_1A_QA_MARKER}] complete`)
  console.log(
    JSON.stringify(
      {
        total: results.length,
        pursue: pursues,
        hold: holds,
        reject: rejects,
        priorHoldCount: priorHolds,
        holdReduction: priorHolds - holds,
        decisionsChanged: changed,
        thinEvidenceUpgradedToPursue: thinEvidenceNowPursue.map((r) => r.companyName),
        pursueWithEmail: results.filter((r) => r.ok && r.decision === "pursue" && r.email).length,
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
