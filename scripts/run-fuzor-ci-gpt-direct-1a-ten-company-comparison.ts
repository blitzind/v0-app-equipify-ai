/**
 * FUZOR-COMPANY-INTELLIGENCE-GPT-DIRECT-1A — Ten-company A/B comparison proof.
 * Run: pnpm run:fuzor-ci-gpt-direct-1a-ten-company-comparison
 */

import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "../lib/growth/access"
import {
  EQUIPIFY_AVA_CALIBRATED_OBJECTIVE,
  EQUIPIFY_AVA_CALIBRATED_ROLE_KNOWLEDGE,
  enrichOrganizationKnowledgeWithSalesCalibration,
} from "../lib/growth/ava-reasoning/equipify-ava-sales-calibration"
import {
  EQUIPIFY_AVA_DEPLOYMENT_ID,
  mapDecisionMakersToContactEvidence,
  projectEquipifyKnowledgeBase,
} from "../lib/growth/ava-reasoning/equipify-ava-reasoning-adapter"
import { runFuzorCompanyIntelligence } from "../lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-service"
import { gatherFuzorCompanyIntelligenceEvidence } from "../lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-evidence-gatherer"
import {
  runGptDirectCompanyIntelligenceExperiment,
  toExperimentCompanyIntelligenceForAiEmployee,
} from "../lib/growth/company-intelligence/gpt-direct-experiment/fuzor-company-intelligence-gpt-direct-experiment"
import { FUZOR_CI_GPT_DIRECT_1A_QA_MARKER } from "../lib/growth/company-intelligence/gpt-direct-experiment/fuzor-company-intelligence-gpt-direct-prompts"
import { loadOutreachSellerTruthBundle } from "../lib/growth/aios/growth/growth-outreach-seller-truth-loader"
import { listGrowthLeadDecisionMakers } from "../lib/growth/decision-maker-repository"
import { fetchGrowthLeadById } from "../lib/growth/lead-repository"
import { runAvaReasoning } from "../lib/fuzor/ava-reasoning/ava-reasoning-service"
import type { CompanyIntelligenceForAiEmployee } from "../lib/fuzor/company-intelligence"
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

function assessCiUsefulness(input: {
  executiveSummary: string
  evidenceWeakness: string | null
  offeringsCount: number
  operationalSummary: string
}): "useful" | "partial" | "not_useful" {
  const weakness = input.evidenceWeakness?.toLowerCase() ?? ""
  if (
    weakness.includes("cannot be determined") ||
    weakness.includes("insufficient to determine the business")
  ) {
    return "not_useful"
  }
  if (input.offeringsCount > 0 || input.operationalSummary.length > 80) return "useful"
  if (input.executiveSummary.length > 120) return "partial"
  return "not_useful"
}

function pipelineCiToAiEmployee(input: {
  ownerOrganizationId: string
  leadId: string
  companyName: string
  website: string | null
  understanding: CompanyIntelligenceForAiEmployee["understanding"]
  evidencePacketSummary: {
    verifiedDescriptionPresent: boolean
    websiteExcerptsCount: number
    pagesObservedCount: number
  }
}): CompanyIntelligenceForAiEmployee {
  return {
    ownerOrganizationId: input.ownerOrganizationId,
    aiDeploymentId: "pipeline-experiment-1a",
    companyId: null,
    externalCompanyId: null,
    leadId: input.leadId,
    companyName: input.companyName,
    website: input.website,
    companyIntelligenceVersionId: `pipeline-experiment:${input.leadId}`,
    companyIntelligenceVersion: "pipeline-approach-a",
    evidenceFingerprint: "pipeline-experiment",
    createdAt: new Date().toISOString(),
    understanding: input.understanding,
    evidenceRefs: {
      leadId: input.leadId,
      website: input.website,
      linkedinCompanyUrl: null,
      hasVerifiedDescription: input.evidencePacketSummary.verifiedDescriptionPresent,
      verifiedOfferingCount: input.understanding.productsAndServices.offerings.length,
      verifiedIndustryCount: input.understanding.industriesServed.industries.length,
      websiteExcerptCount: input.evidencePacketSummary.websiteExcerptsCount,
      pagesObserved: [],
      datamoonFindingCount: 0,
      missingFromCollection: [],
      priorResearchNotesPresent: false,
    },
  }
}

async function runAvaWithCi(input: {
  organizationId: string
  actingUserEmail: string
  companyIntelligence: CompanyIntelligenceForAiEmployee
  contacts: ReturnType<typeof mapDecisionMakersToContactEvidence>
  organizationKnowledge: ReturnType<typeof projectEquipifyKnowledgeBase>
}) {
  return runAvaReasoning({
    ownerOrganizationId: input.organizationId,
    aiDeploymentId: EQUIPIFY_AVA_DEPLOYMENT_ID,
    companyIntelligence: input.companyIntelligence,
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
  const actingUserEmail = "gpt-direct-comparison@equipify.internal"

  console.log(`[${FUZOR_CI_GPT_DIRECT_1A_QA_MARKER}] ten-company comparison`)
  console.log(JSON.stringify({ organizationId, cohortSize: COHORT.length }, null, 2))

  const rollup = {
    pipelineUseful: 0,
    gptDirectUseful: 0,
    avaDecisionChanged: 0,
    gptDirectWins: 0,
    pipelineWins: 0,
    ties: 0,
  }

  for (const item of COHORT) {
    console.log(`\n============================================================`)
    console.log(item.label)

    const lead = await fetchGrowthLeadById(admin, item.leadId)
    if (!lead) {
      console.log(JSON.stringify({ ok: false, message: "Lead not found" }, null, 2))
      continue
    }

    const gathered = await gatherFuzorCompanyIntelligenceEvidence({
      admin,
      leadId: item.leadId,
      organizationId,
    })
    const packet = gathered.ok ? gathered.packet : null

    const pipelineRun = packet
      ? await runFuzorCompanyIntelligence({
          admin,
          leadId: item.leadId,
          organizationId,
          gatherEvidence: async () => ({ ok: true, packet }),
        })
      : null

    const gptDirectRun = await runGptDirectCompanyIntelligenceExperiment({
      companyName: lead.companyName,
      website: lead.website ?? packet?.website ?? null,
      organizationId,
      actingUserEmail,
    })

    const [decisionMakers, sellerBundle] = await Promise.all([
      listGrowthLeadDecisionMakers(admin, item.leadId),
      loadOutreachSellerTruthBundle(admin, {
        organizationId,
        preparedAt: new Date().toISOString(),
        prospectCompanyName: lead.companyName,
        leadId: lead.id,
      }),
    ])
    const contacts = mapDecisionMakersToContactEvidence({
      decisionMakers,
      companyName: lead.companyName,
      leadContactFallback: {
        name: lead.contactName,
        email: lead.contactEmail,
        title: null,
      },
    })
    const organizationKnowledge = projectEquipifyKnowledgeBase(sellerBundle.sellerTruth)

    const pipelineUnderstanding = pipelineRun?.ok ? pipelineRun.output.understanding : null
    const pipelineUsefulness = pipelineUnderstanding
      ? assessCiUsefulness({
          executiveSummary: pipelineUnderstanding.executiveSummary,
          evidenceWeakness: pipelineUnderstanding.evidenceWeakness,
          offeringsCount: pipelineUnderstanding.productsAndServices.offerings.length,
          operationalSummary: pipelineUnderstanding.operationalModel.summary,
        })
      : "not_useful"

    const gptDirectUnderstanding = gptDirectRun.ok ? gptDirectRun.output.understanding : null
    const gptDirectUsefulness = gptDirectUnderstanding
      ? assessCiUsefulness({
          executiveSummary: gptDirectUnderstanding.executiveSummary,
          evidenceWeakness: gptDirectUnderstanding.evidenceWeakness,
          offeringsCount: gptDirectUnderstanding.productsAndServices.offerings.length,
          operationalSummary: gptDirectUnderstanding.operationalModel.summary,
        })
      : "not_useful"

    if (pipelineUsefulness === "useful") rollup.pipelineUseful += 1
    if (gptDirectUsefulness === "useful") rollup.gptDirectUseful += 1

    let avaPipeline: Awaited<ReturnType<typeof runAvaWithCi>> | null = null
    let avaGptDirect: Awaited<ReturnType<typeof runAvaWithCi>> | null = null

    if (pipelineUnderstanding && packet) {
      avaPipeline = await runAvaWithCi({
        organizationId,
        actingUserEmail,
        companyIntelligence: pipelineCiToAiEmployee({
          ownerOrganizationId: organizationId,
          leadId: item.leadId,
          companyName: lead.companyName,
          website: packet.website,
          understanding: pipelineUnderstanding,
          evidencePacketSummary: {
            verifiedDescriptionPresent: Boolean(packet.verifiedDescription),
            websiteExcerptsCount: packet.websiteExcerpts.length,
            pagesObservedCount: packet.pagesObserved.length,
          },
        }),
        contacts,
        organizationKnowledge,
      })
    }

    if (gptDirectRun.ok) {
      avaGptDirect = await runAvaWithCi({
        organizationId,
        actingUserEmail,
        companyIntelligence: toExperimentCompanyIntelligenceForAiEmployee({
          ownerOrganizationId: organizationId,
          leadId: item.leadId,
          companyName: lead.companyName,
          website: lead.website ?? packet?.website ?? null,
          understanding: gptDirectRun.output.understanding,
          websiteRetrieval: gptDirectRun.output.websiteRetrieval,
        }),
        contacts,
        organizationKnowledge,
      })
    }

    const pipelineDecision =
      avaPipeline?.ok ? avaPipeline.output.result.decision : null
    const gptDirectDecision =
      avaGptDirect?.ok ? avaGptDirect.output.result.decision : null

    if (
      pipelineDecision &&
      gptDirectDecision &&
      pipelineDecision !== gptDirectDecision
    ) {
      rollup.avaDecisionChanged += 1
    }

    const usefulnessRank = { useful: 3, partial: 2, not_useful: 1 } as const
    if (usefulnessRank[gptDirectUsefulness] > usefulnessRank[pipelineUsefulness]) {
      rollup.gptDirectWins += 1
    } else if (usefulnessRank[gptDirectUsefulness] < usefulnessRank[pipelineUsefulness]) {
      rollup.pipelineWins += 1
    } else {
      rollup.ties += 1
    }

    console.log(
      JSON.stringify(
        {
          companyName: lead.companyName,
          website: lead.website ?? packet?.website ?? null,
          approachA_pipeline: {
            ok: pipelineRun?.ok ?? false,
            evidenceExcerpts: packet?.websiteExcerpts.length ?? 0,
            ciUsefulness: pipelineUsefulness,
            executiveSummaryPreview: pipelineUnderstanding?.executiveSummary.slice(0, 220) ?? null,
            evidenceWeakness: pipelineUnderstanding?.evidenceWeakness ?? null,
            avaDecision: pipelineDecision,
            avaRationalePreview: avaPipeline?.ok
              ? avaPipeline.output.result.rationale.slice(0, 220)
              : null,
            emailSubject: avaPipeline?.ok ? avaPipeline.output.result.email?.subject ?? null : null,
          },
          approachB_gptDirect: {
            ok: gptDirectRun.ok,
            websitePagesRetrieved: gptDirectRun.ok
              ? gptDirectRun.output.websiteRetrieval.pages.length
              : 0,
            websiteChars: gptDirectRun.ok ? gptDirectRun.output.websiteRetrieval.totalChars : 0,
            retrievalStatus: gptDirectRun.ok
              ? gptDirectRun.output.websiteRetrieval.status
              : gptDirectRun.code,
            ciUsefulness: gptDirectUsefulness,
            executiveSummaryPreview: gptDirectUnderstanding?.executiveSummary.slice(0, 220) ?? null,
            evidenceWeakness: gptDirectUnderstanding?.evidenceWeakness ?? null,
            avaDecision: gptDirectDecision,
            avaRationalePreview: avaGptDirect?.ok
              ? avaGptDirect.output.result.rationale.slice(0, 220)
              : null,
            emailSubject: avaGptDirect?.ok ? avaGptDirect.output.result.email?.subject ?? null : null,
          },
          avaDecisionChanged:
            pipelineDecision && gptDirectDecision
              ? pipelineDecision !== gptDirectDecision
              : null,
          usefulnessWinner:
            usefulnessRank[gptDirectUsefulness] > usefulnessRank[pipelineUsefulness]
              ? "gpt_direct"
              : usefulnessRank[gptDirectUsefulness] < usefulnessRank[pipelineUsefulness]
                ? "pipeline"
                : "tie",
        },
        null,
        2,
      ),
    )
  }

  const certification =
    rollup.gptDirectUseful > rollup.pipelineUseful + 1
      ? "GPT-DIRECT READY"
      : rollup.gptDirectWins > rollup.pipelineWins + 2
        ? "GPT-DIRECT READY"
        : "EVIDENCE PIPELINE STILL REQUIRED"

  console.log(`\n[${FUZOR_CI_GPT_DIRECT_1A_QA_MARKER}] complete`)
  console.log(JSON.stringify({ rollup, certification }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
