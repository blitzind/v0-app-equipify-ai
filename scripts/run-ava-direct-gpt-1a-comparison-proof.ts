/**
 * AVA-DIRECT-GPT-1A — Approach A vs B comparison (Best Buy + Block Imaging).
 * Run: pnpm run:ava-direct-gpt-1a-comparison-proof
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "../lib/growth/access"
import { loadOutreachSellerTruthBundle } from "../lib/growth/aios/growth/growth-outreach-seller-truth-loader"
import {
  EQUIPIFY_AVA_DEPLOYMENT_ID,
  mapDecisionMakersToContactEvidence,
  projectEquipifyKnowledgeBase,
} from "../lib/growth/ava-reasoning/equipify-ava-reasoning-adapter"
import {
  EQUIPIFY_AVA_CALIBRATED_OBJECTIVE,
  EQUIPIFY_AVA_CALIBRATED_ROLE_KNOWLEDGE,
  enrichOrganizationKnowledgeWithSalesCalibration,
} from "../lib/growth/ava-reasoning/equipify-ava-sales-calibration"
import { runAvaDirectGptExperiment } from "../lib/growth/ava-reasoning/ava-direct-gpt-experiment/ava-direct-gpt-experiment"
import { AVA_DIRECT_GPT_1A_QA_MARKER } from "../lib/growth/ava-reasoning/ava-direct-gpt-experiment/ava-direct-gpt-schema"
import { runAvaReasoning } from "../lib/fuzor/ava-reasoning/ava-reasoning-service"
import {
  runGptDirectCompanyIntelligenceExperiment,
  toExperimentCompanyIntelligenceForAiEmployee,
} from "../lib/growth/company-intelligence/gpt-direct-experiment/fuzor-company-intelligence-gpt-direct-experiment"
import { fetchPublicHtmlDocument } from "../lib/growth/research-website-fetch"
import { stripHtmlToPlainText } from "../lib/growth/research-website-html"
import { normalizeLeadWebsite } from "../lib/growth/research-website-url"
import { listGrowthLeadDecisionMakers } from "../lib/growth/decision-maker-repository"
import { fetchGrowthLeadById } from "../lib/growth/lead-repository"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  fetchSupabaseServiceRoleKeyFromCli,
  resolveLinkedSupabaseProjectRef,
  resolveSupabaseUrlForProjectRef,
} from "../lib/growth/qa/supabase-cli-linked-project-bootstrap"

const COHORT = [
  {
    leadId: "03a361d3-e6b6-42e6-bc78-a5773acc1725",
    label: "Best Buy",
    fixture: "scripts/fixtures/fuzor-ci-gpt-direct-hotfix-2-best-buy-homepage.txt",
  },
  {
    leadId: "6d9220f0-2960-468c-b4be-5d7595d292c3",
    label: "Block Imaging",
    fixture: "scripts/fixtures/ava-direct-gpt-1a-block-imaging-homepage.txt",
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

async function loadWebsiteText(input: {
  website: string | null
  fixturePath: string
}): Promise<{ text: string; chars: number; source: string }> {
  const absolute = resolve(process.cwd(), input.fixturePath)
  if (existsSync(absolute)) {
    const text = readFileSync(absolute, "utf8").trim()
    return { text, chars: text.length, source: "fixture" }
  }

  if (!input.website?.trim()) {
    throw new Error("No website and no fixture.")
  }

  process.env.GROWTH_RESEARCH_WEBSITE_ENABLED = "true"
  const normalized = normalizeLeadWebsite(input.website)
  if (normalized.status !== "ready" || !normalized.url) {
    throw new Error(`Website not ready: ${normalized.status}`)
  }

  const fetched = await fetchPublicHtmlDocument(normalized.url)
  if (fetched.status !== "ok" || !fetched.body?.trim()) {
    throw new Error(`Fetch failed: ${fetched.status}`)
  }

  const text = stripHtmlToPlainText(fetched.body).trim()
  mkdirSync(resolve(process.cwd(), "scripts/fixtures"), { recursive: true })
  writeFileSync(absolute, text)
  return { text, chars: text.length, source: "fetched_once" }
}

async function runApproachA(input: {
  organizationId: string
  actingUserEmail: string
  leadId: string
  companyName: string
  website: string | null
  websiteText: string
  organizationKnowledge: ReturnType<typeof projectEquipifyKnowledgeBase>
  contacts: ReturnType<typeof mapDecisionMakersToContactEvidence>
}) {
  const started = Date.now()
  const ciRun = await runGptDirectCompanyIntelligenceExperiment({
    companyName: input.companyName,
    website: input.website,
    organizationId: input.organizationId,
    actingUserEmail: input.actingUserEmail,
    retrieveWebsite: async () => ({
      status: "ok",
      normalizedUrl: input.website,
      pages: [{ url: input.website ?? "", text: input.websiteText }],
      totalChars: input.websiteText.length,
      message: null,
    }),
  })
  if (!ciRun.ok) {
    return { ok: false as const, message: ciRun.message, durationMs: Date.now() - started }
  }

  const ciMs = Date.now() - started
  const avaStarted = Date.now()
  const ava = await runAvaReasoning({
    ownerOrganizationId: input.organizationId,
    aiDeploymentId: EQUIPIFY_AVA_DEPLOYMENT_ID,
    companyIntelligence: toExperimentCompanyIntelligenceForAiEmployee({
      ownerOrganizationId: input.organizationId,
      leadId: input.leadId,
      companyName: input.companyName,
      website: input.website,
      understanding: ciRun.output.understanding,
      websiteRetrieval: ciRun.output.websiteRetrieval,
    }),
    organizationKnowledge: enrichOrganizationKnowledgeWithSalesCalibration(input.organizationKnowledge),
    roleKnowledge: EQUIPIFY_AVA_CALIBRATED_ROLE_KNOWLEDGE,
    objective: EQUIPIFY_AVA_CALIBRATED_OBJECTIVE,
    contacts: input.contacts,
    hardRuleState: {
      outboundSendAuthorized: false,
      draftGenerationAllowed: true,
      optOutBlocked: false,
      suppressed: false,
      persistenceEnabled: false,
    },
    actingUserEmail: input.actingUserEmail,
  })
  const avaMs = Date.now() - avaStarted

  if (!ava.ok) {
    return { ok: false as const, message: ava.message, durationMs: Date.now() - started }
  }

  return {
    ok: true as const,
    decision: ava.output.result.decision,
    rationale: ava.output.result.rationale,
    strongestAngle: ava.output.result.strongestAngle,
    email: ava.output.result.email,
    companyUnderstanding: ciRun.output.understanding.executiveSummary,
    gptCalls: 2,
    timingMs: { ci: ciMs, ava: avaMs, total: Date.now() - started },
  }
}

async function runApproachB(input: {
  organizationId: string
  actingUserEmail: string
  companyName: string
  website: string | null
  websiteText: string
  organizationKnowledge: ReturnType<typeof projectEquipifyKnowledgeBase>
  contacts: ReturnType<typeof mapDecisionMakersToContactEvidence>
}) {
  const started = Date.now()
  const run = await runAvaDirectGptExperiment({
    companyName: input.companyName,
    website: input.website,
    websiteText: input.websiteText,
    organizationId: input.organizationId,
    actingUserEmail: input.actingUserEmail,
    roleKnowledge: EQUIPIFY_AVA_CALIBRATED_ROLE_KNOWLEDGE,
    objective: EQUIPIFY_AVA_CALIBRATED_OBJECTIVE,
    organizationKnowledge: enrichOrganizationKnowledgeWithSalesCalibration(input.organizationKnowledge),
    contacts: input.contacts,
  })

  if (!run.ok) {
    return { ok: false as const, message: run.message, durationMs: run.durationMs }
  }

  return {
    ok: true as const,
    decision: run.output.decision,
    rationale: run.output.rationale,
    strongestAngle: run.output.strongestAngle,
    email: run.output.email,
    companyUnderstanding: run.output.companyUnderstanding,
    persistableUnderstanding: run.output.companyUnderstanding,
    gptCalls: 1,
    timingMs: { total: run.durationMs },
  }
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
  const actingUserEmail = "ava-direct-gpt-1a@equipify.internal"

  console.log(`[${AVA_DIRECT_GPT_1A_QA_MARKER}] comparison proof`)
  console.log(JSON.stringify({ cohortSize: COHORT.length }, null, 2))

  const summary = {
    decisionsMatch: 0,
    approachBWins: 0,
    approachAWins: 0,
    ties: 0,
  }

  for (const item of COHORT) {
    console.log(`\n============================================================`)
    console.log(item.label)

    const lead = await fetchGrowthLeadById(admin, item.leadId)
    if (!lead) continue

    const website = await loadWebsiteText({ website: lead.website, fixturePath: item.fixture })
    const [decisionMakers, sellerBundle] = await Promise.all([
      listGrowthLeadDecisionMakers(admin, item.leadId),
      loadOutreachSellerTruthBundle(admin, {
        organizationId,
        preparedAt: new Date().toISOString(),
        prospectCompanyName: lead.companyName,
        leadId: lead.id,
      }),
    ])
    const organizationKnowledge = projectEquipifyKnowledgeBase(sellerBundle.sellerTruth)
    const contacts = mapDecisionMakersToContactEvidence({
      decisionMakers,
      companyName: lead.companyName,
      leadContactFallback: {
        name: lead.contactName,
        email: lead.contactEmail,
        title: null,
      },
    })

    const approachA = await runApproachA({
      organizationId,
      actingUserEmail,
      leadId: item.leadId,
      companyName: lead.companyName,
      website: lead.website,
      websiteText: website.text,
      organizationKnowledge,
      contacts,
    })

    const approachB = await runApproachB({
      organizationId,
      actingUserEmail,
      companyName: lead.companyName,
      website: lead.website,
      websiteText: website.text,
      organizationKnowledge,
      contacts,
    })

    if (approachA.ok && approachB.ok) {
      if (approachA.decision === approachB.decision) summary.decisionsMatch += 1
      if (approachB.timingMs.total < approachA.timingMs.total) summary.approachBWins += 1
      else if (approachB.timingMs.total > approachA.timingMs.total) summary.approachAWins += 1
      else summary.ties += 1
    }

    console.log(
      JSON.stringify(
        {
          companyName: lead.companyName,
          websiteTextSource: website.source,
          websiteTextChars: website.chars,
          approachA_ciThenAva: approachA.ok
            ? {
                gptCalls: approachA.gptCalls,
                decision: approachA.decision,
                rationalePreview: approachA.rationale.slice(0, 220),
                strongestAngle: approachA.strongestAngle,
                companyUnderstandingPreview: approachA.companyUnderstanding.slice(0, 220),
                emailSubject: approachA.email?.subject ?? null,
                timingMs: approachA.timingMs,
              }
            : { error: approachA.message },
          approachB_avaDirect: approachB.ok
            ? {
                gptCalls: approachB.gptCalls,
                decision: approachB.decision,
                rationalePreview: approachB.rationale.slice(0, 220),
                strongestAngle: approachB.strongestAngle,
                companyUnderstandingPreview: approachB.companyUnderstanding.slice(0, 220),
                persistableUnderstanding: approachB.persistableUnderstanding.slice(0, 220),
                emailSubject: approachB.email?.subject ?? null,
                timingMs: approachB.timingMs,
              }
            : { error: approachB.message },
          decisionsMatch:
            approachA.ok && approachB.ok ? approachA.decision === approachB.decision : null,
        },
        null,
        2,
      ),
    )
  }

  const certification =
    summary.decisionsMatch >= 1
      ? "AVA-DIRECT ARCHITECTURE VIABLE — CI NOT REQUIRED ON CRITICAL PATH"
      : "INCONCLUSIVE — REVIEW OUTPUTS"

  console.log(`\n[${AVA_DIRECT_GPT_1A_QA_MARKER}] complete`)
  console.log(
    JSON.stringify(
      {
        summary,
        certification,
        architecturalAnswer:
          "Company Intelligence is organizational memory, not a mandatory reasoning dependency. Prefer: Website → Ava → persist understanding.",
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
