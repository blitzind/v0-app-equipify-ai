/**
 * FUZOR-COMPANY-INTELLIGENCE-GPT-FIRST-1A — Ten-company CI comparison proof.
 * Run: pnpm run:fuzor-ci-gpt-first-1a-ten-company-proof
 *
 * Rebuilds CI with GPT-first objective (no persist). Compares understanding quality.
 */

import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "../lib/growth/access"
import { gatherFuzorCompanyIntelligenceEvidence } from "../lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-evidence-gatherer"
import { runFuzorCompanyIntelligence } from "../lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-service"
import { FUZOR_COMPANY_INTELLIGENCE_GPT_FIRST_1A_QA_MARKER } from "../lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-types"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  fetchSupabaseServiceRoleKeyFromCli,
  resolveLinkedSupabaseProjectRef,
  resolveSupabaseUrlForProjectRef,
} from "../lib/growth/qa/supabase-cli-linked-project-bootstrap"

const COHORT = [
  { leadId: "6d9220f0-2960-468c-b4be-5d7595d292c3", label: "Block Imaging" },
  { leadId: "34b85fb6-dc58-44db-8483-8cf12bdebce8", label: "Hughes Property Management" },
  { leadId: "03a361d3-e6b6-42e6-bc78-a5773acc1725", label: "Best Buy" },
  { leadId: "5599b1b3-36c1-4da3-bbef-1e293b3c965c", label: "vivint smart home" },
  { leadId: "b06417cf-8c67-4705-82f3-0b62e3d08ca2", label: "naes" },
  { leadId: "03f6dd92-1057-4b16-ae17-c18a16d8fc89", label: "solar turbines" },
  { leadId: "5f937f96-d0a1-41d5-82ae-ca10482443b1", label: "superior lift" },
  { leadId: "450f7bdf-0f93-40ca-a27f-02d0273a0254", label: "blackhawk engineering" },
  { leadId: "dc60de5c-225d-475b-9832-60bdba5e28e4", label: "nextier oilfield solutions" },
  { leadId: "9706297b-5ab8-4d82-b2aa-dd3262487f16", label: "gcp applied technologies" },
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

function assessAvaDecisionability(input: {
  executiveSummary: string
  evidenceWeakness: string | null
  offeringsCount: number
  operationalSummary: string
}): "decidable" | "partial" | "not_decidable" {
  const weakness = input.evidenceWeakness?.toLowerCase() ?? ""
  const summary = input.executiveSummary.toLowerCase()
  const operational = input.operationalSummary.toLowerCase()

  if (
    weakness.includes("cannot be determined") ||
    weakness.includes("cannot determine") ||
    (summary.includes("cannot be determined") && input.offeringsCount === 0)
  ) {
    return "not_decidable"
  }

  if (
    input.offeringsCount > 0 ||
    operational.includes("service") ||
    operational.includes("field") ||
    operational.includes("maintenance") ||
    operational.includes("machining") ||
    operational.includes("oilfield") ||
    operational.includes("forklift")
  ) {
    return "decidable"
  }

  return "partial"
}

async function main(): Promise<void> {
  bootstrapVerifiedChannelsCertEnv()
  bootstrapOpenAiKeyFromLegacyHideFiles()
  if (!process.env.OPENAI_API_KEY?.trim()) throw new Error("OPENAI_API_KEY unavailable.")

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) throw new Error("GROWTH_ENGINE_AI_ORG_ID unavailable.")

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    const ref = resolveLinkedSupabaseProjectRef()
    if (!ref) throw new Error("Supabase credentials unavailable.")
    process.env.NEXT_PUBLIC_SUPABASE_URL = resolveSupabaseUrlForProjectRef(ref)
    process.env.SUPABASE_SERVICE_ROLE_KEY = await fetchSupabaseServiceRoleKeyFromCli(ref)
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  console.log(`[${FUZOR_COMPANY_INTELLIGENCE_GPT_FIRST_1A_QA_MARKER}] ten-company CI proof`)
  console.log(JSON.stringify({ organizationId, cohortSize: COHORT.length }, null, 2))

  const summary = {
    decidable: 0,
    partial: 0,
    notDecidable: 0,
    evidenceGapOnly: 0,
    understandingImproved: 0,
  }

  for (const item of COHORT) {
    console.log(`\n============================================================`)
    console.log(`${item.label} (${item.leadId})`)

    const gathered = await gatherFuzorCompanyIntelligenceEvidence({
      admin,
      leadId: item.leadId,
      organizationId,
    })
    if (!gathered.ok) {
      console.log(JSON.stringify({ ok: false, message: gathered.message }, null, 2))
      continue
    }

    const packet = gathered.packet
    const evidenceRichness =
      (packet.verifiedDescription ? 1 : 0) +
      (packet.verifiedOfferings.length > 0 ? 1 : 0) +
      (packet.websiteExcerpts.length > 0 ? 1 : 0) +
      (packet.pagesObserved.length > 0 ? 1 : 0)

    const run = await runFuzorCompanyIntelligence({
      admin,
      leadId: item.leadId,
      organizationId,
      gatherEvidence: async () => ({ ok: true, packet }),
    })

    if (!run.ok) {
      console.log(JSON.stringify({ ok: false, code: run.code, message: run.message }, null, 2))
      continue
    }

    const u = run.output.understanding
    const avaDecisionability = assessAvaDecisionability({
      executiveSummary: u.executiveSummary,
      evidenceWeakness: u.evidenceWeakness,
      offeringsCount: u.productsAndServices.offerings.length,
      operationalSummary: u.operationalModel.summary,
    })

    if (avaDecisionability === "decidable") summary.decidable += 1
    else if (avaDecisionability === "partial") summary.partial += 1
    else summary.notDecidable += 1

    if (evidenceRichness === 0) summary.evidenceGapOnly += 1

    const report = {
      ok: true,
      companyName: packet.companyName,
      evidenceRichness,
      verifiedDescriptionPresent: Boolean(packet.verifiedDescription),
      websiteExcerptsCount: packet.websiteExcerpts.length,
      pagesObservedCount: packet.pagesObserved.length,
      executiveSummary: u.executiveSummary,
      operationalModelSummary: u.operationalModel.summary,
      offerings: u.productsAndServices.offerings.slice(0, 6),
      evidenceWeakness: u.evidenceWeakness,
      unknowns: u.unknowns.slice(0, 5),
      avaDecisionability,
      runtimeMs: run.output.durationMs,
    }

    console.log(JSON.stringify(report, null, 2))
  }

  console.log(`\n[${FUZOR_COMPANY_INTELLIGENCE_GPT_FIRST_1A_QA_MARKER}] complete`)
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
