/**
 * FUZOR-COMPANY-INTELLIGENCE-GPT-FIRST-1A — Read-only evidence packet audit.
 * Run: pnpm run:audit-fuzor-ci-gpt-first-1a-evidence-packets
 */

import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"
import { gatherFuzorCompanyIntelligenceEvidence } from "../lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-evidence-gatherer"
import { loadLatestFuzorCompanyIntelligence } from "../lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-repository"
import { getGrowthEngineAiOrgId } from "../lib/growth/access"
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
      return
    }
  }
}

async function main(): Promise<void> {
  bootstrapVerifiedChannelsCertEnv()
  bootstrapOpenAiKeyFromLegacyHideFiles()
  const orgId = getGrowthEngineAiOrgId()
  if (!orgId) throw new Error("GROWTH_ENGINE_AI_ORG_ID unavailable")

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

  console.log("[fuzor-ci-gpt-first-1a] evidence packet audit")
  console.log(JSON.stringify({ organizationId: orgId, cohortSize: COHORT.length }, null, 2))

  for (const item of COHORT) {
    console.log("\n" + "=".repeat(60))
    console.log(`${item.label} (${item.leadId})`)

    const gathered = await gatherFuzorCompanyIntelligenceEvidence({
      admin,
      leadId: item.leadId,
      organizationId: orgId,
    })

    if (!gathered.ok) {
      console.log(JSON.stringify({ ok: false, code: gathered.code, message: gathered.message }, null, 2))
      continue
    }

    const p = gathered.packet
    const prior = await loadLatestFuzorCompanyIntelligence({
      admin,
      ownerOrganizationId: orgId,
      leadId: item.leadId,
    })

    const summary = {
      ok: true,
      companyName: p.companyName,
      website: p.website,
      verifiedDescriptionPresent: Boolean(p.verifiedDescription),
      verifiedDescriptionPreview: p.verifiedDescription?.slice(0, 120) ?? null,
      verifiedOfferingsCount: p.verifiedOfferings.length,
      verifiedOfferingsPreview: p.verifiedOfferings.slice(0, 4),
      verifiedIndustriesCount: p.verifiedIndustries.length,
      websiteExcerptsCount: p.websiteExcerpts.length,
      websiteExcerptsPreview: p.websiteExcerpts.slice(0, 2).map((e) => e.slice(0, 120)),
      pagesObservedCount: p.pagesObserved.length,
      pagesObservedPreview: p.pagesObserved.slice(0, 4),
      datamoonFindingsCount: p.datamoonFindings.length,
      priorResearchNotesPresent: Boolean(p.priorResearchNotes),
      priorResearchNotesPreview: p.priorResearchNotes?.slice(0, 200) ?? null,
      missingFromCollection: p.missingFromCollection,
      priorCiExecutiveSummaryPreview: prior?.understanding?.executiveSummary?.slice(0, 200) ?? null,
      priorCiEvidenceWeakness: prior?.understanding?.evidenceWeakness ?? null,
    }

    console.log(JSON.stringify(summary, null, 2))
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
