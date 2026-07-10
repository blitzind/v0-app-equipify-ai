import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId, logGrowthEngine } from "@/lib/growth/access"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { recomputeGrowthLeadWorkflowSignals } from "@/lib/growth/recompute-lead-next-best-action"
import { scheduleUnifiedRevenueWorkflowLifecycleReEvaluation } from "@/lib/growth/revenue-workflow/unified-revenue-workflow-lifecycle-runner"
import { collectProspectCompanyEvidence } from "@/lib/growth/research/company-evidence/company-evidence-collector"
import {
  enrichCompanyIntelligenceFromEvidence,
  mergeEvidenceIntoResearchSummary,
  resolveVerifiedIndustryGuess,
} from "@/lib/growth/research/company-evidence/company-evidence-intelligence-enrichment"
import { loadGrowthLeadAdmissionContext } from "@/lib/growth/revenue-workflow/growth-lead-admission-context"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { buildCompanySignals } from "@/lib/growth/research/company-signal-builder"
import { classifyProspectIndustry } from "@/lib/growth/research/industry-classifier"
import { detectProspectPainSignals } from "@/lib/growth/research/pain-signal-detector"
import {
  generateSuggestedCallOpening,
  generateSuggestedPitchAngle,
  generateSuggestedSequence,
  recommendProspectNextAction,
} from "@/lib/growth/research/pitch-angle-generator"
import {
  buildProspectResearchInputHash,
} from "@/lib/growth/research/research-input-hash"
import { scrapeProspectWebsite } from "@/lib/growth/research/website-scraper"
import { runWebsiteContactDiscoveryForCompany } from "@/lib/growth/contact-discovery/company-contact-repository"
import { isGrowthCompanyContactsSchemaReady } from "@/lib/growth/contact-discovery/company-contact-schema-health"
import { runCompanyGrowthSignalDiscovery } from "@/lib/growth/company-growth-signals/growth-signal-repository"
import { isGrowthCompanyGrowthSignalsSchemaReady } from "@/lib/growth/company-growth-signals/company-growth-signal-schema-health"
import {
  fetchActiveProspectResearchRun,
  fetchCachedProspectResearchRun,
  finishProspectResearchRun,
  insertProspectResearchRun,
  logProspectResearch,
  markLeadProspectResearchCompleted,
  markProspectResearchRunRunning,
} from "@/lib/growth/research/research-repository"
import { buildProspectResearchSummary, computeResearchConfidence } from "@/lib/growth/research/research-summary-builder"
import type { GrowthResearchRunPublicView } from "@/lib/growth/research/research-types"
import { detectWebsiteTechnologies } from "@/lib/growth/research/technology-detector"
import { detectWebsiteFeatureFlags, scoreWebsiteMaturity } from "@/lib/growth/research/website-maturity-score"
import type { GrowthLead } from "@/lib/growth/types"

export type RunProspectResearchInput = {
  admin: SupabaseClient
  leadId: string
  rebuild?: boolean
}

export type RunProspectResearchResult =
  | { ok: true; run: GrowthResearchRunPublicView; cached: boolean; lead?: GrowthLead | null }
  | { ok: false; code: string; message: string; run?: GrowthResearchRunPublicView | null }

export async function runProspectResearch(input: RunProspectResearchInput): Promise<RunProspectResearchResult> {
  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    return {
      ok: false,
      code: "server_config",
      message: "Prospect research is not configured. Set GROWTH_ENGINE_AI_ORG_ID on the server.",
    }
  }

  const lead = await fetchGrowthLeadById(input.admin, input.leadId)
  if (!lead) {
    return { ok: false, code: "not_found", message: "Lead not found." }
  }

  const rebuild = Boolean(input.rebuild)
  const inputHash = buildProspectResearchInputHash({
    companyName: lead.companyName,
    website: lead.website,
    rebuild,
  })

  if (!rebuild) {
    const cached = await fetchCachedProspectResearchRun(input.admin, lead.id, inputHash)
    if (cached) {
      logProspectResearch("cache_hit", { leadId: lead.id, runId: cached.id, inputHash })
      return { ok: true, run: cached, cached: true, lead }
    }
  }

  const active = await fetchActiveProspectResearchRun(input.admin, lead.id)
  if (active) {
    logProspectResearch("duplicate_blocked", { leadId: lead.id, runId: active.id, status: active.status })
    return {
      ok: true,
      run: active,
      cached: true,
      lead,
    }
  }

  let run = await insertProspectResearchRun(input.admin, {
    organizationId,
    leadId: lead.id,
    companyName: lead.companyName,
    websiteUrl: lead.website,
    inputHash,
  })

  logProspectResearch("started", { leadId: lead.id, runId: run.id, inputHash, rebuild })

  try {
    await markProspectResearchRunRunning(input.admin, run.id)

    const scrape = await scrapeProspectWebsite(lead.website)

    const admissionContext = await loadGrowthLeadAdmissionContext(input.admin, organizationId)
    const admissionState = resolveLeadAdmissionStateFromMetadata(lead.metadata)

    let companyEvidenceBundle = null as Awaited<ReturnType<typeof collectProspectCompanyEvidence>>["bundle"]
    if (scrape.fetchStatus === "ok" && lead.website?.trim()) {
      try {
        const evidenceResult = await collectProspectCompanyEvidence({
          organizationId,
          companyName: lead.companyName,
          websiteUrl: lead.website,
          homepageHtml: scrape.html,
          homepageFetchStatus: scrape.fetchStatus,
          approvedProfile: admissionContext.approvedProfile,
          activeMissionTitle: admissionContext.activeMissionTitle,
          admissionState,
          forceRefresh: rebuild,
        })
        companyEvidenceBundle = evidenceResult.bundle
        if (evidenceResult.warnings.length > 0) {
          logProspectResearch("company_evidence_warnings", {
            leadId: lead.id,
            runId: run.id,
            warnings: evidenceResult.warnings.slice(0, 4),
          })
        }
      } catch (error) {
        logProspectResearch("company_evidence_failed", {
          leadId: lead.id,
          runId: run.id,
          message: error instanceof Error ? error.message.slice(0, 180) : String(error).slice(0, 180),
        })
      }
    }

    const evidenceEnrichment = enrichCompanyIntelligenceFromEvidence(companyEvidenceBundle)

    if (await isGrowthCompanyContactsSchemaReady(input.admin)) {
      try {
        await runWebsiteContactDiscoveryForCompany(input.admin, {
          company_id: lead.id,
          website: lead.website,
          growth_lead_id: lead.id,
        })
      } catch {
        // Contact discovery is additive — research run continues on failure.
      }
    }

    const industry = classifyProspectIndustry(lead.companyName, scrape)
    const industryGuess = resolveVerifiedIndustryGuess(
      companyEvidenceBundle?.profile ?? {
        companyDescription: null,
        industriesServed: null,
        primaryProducts: null,
        primaryServices: null,
        targetCustomers: null,
        businessModel: null,
        geographicMarkets: null,
        estimatedCompanySize: null,
        differentiators: null,
        technologySignals: null,
        hiringSignals: null,
      },
      industry.industry,
    )
    const tech = detectWebsiteTechnologies(scrape.html, scrape.plainText)
    const maturity = scoreWebsiteMaturity(scrape.html, scrape.plainText, scrape)

    if (await isGrowthCompanyGrowthSignalsSchemaReady(input.admin)) {
      try {
        await runCompanyGrowthSignalDiscovery(input.admin, {
          company_id: lead.id,
          website: lead.website,
          company_name: lead.companyName,
          description: scrape.plainText.slice(0, 500) || null,
          website_maturity_score: maturity.score,
          icp_fit_score: lead.score,
        })
      } catch {
        // Growth signal discovery is additive — research run continues on failure.
      }
    }

    const pain = detectProspectPainSignals(scrape.html, scrape.plainText, scrape, maturity.score)
    const companySignals = buildCompanySignals(scrape.html, scrape.plainText, scrape, tech.technologies)
    const flags = detectWebsiteFeatureFlags(scrape.html, scrape.plainText, scrape)

    const recommendedNextAction = recommendProspectNextAction({
      painSignals: pain.painSignals,
      maturityScore: maturity.score,
      fetchStatus: scrape.fetchStatus,
      hasPhone: Boolean(lead.contactPhone?.trim()),
    })

    const researchSummary = mergeEvidenceIntoResearchSummary({
      baseSummary: buildProspectResearchSummary({
        companyName: lead.companyName,
        industry: { ...industry, industry: industryGuess ?? industry.industry },
        scrape,
        maturityScore: maturity.score,
        painSignals: pain.painSignals,
        technologies: tech.technologies,
        recommendedAction: recommendedNextAction,
      }),
      enrichment: evidenceEnrichment,
    })

    const suggestedPitchAngle = generateSuggestedPitchAngle({
      companyName: lead.companyName,
      industry: industry.industry,
      painSignals: pain.painSignals,
      maturityScore: maturity.score,
    })

    const suggestedSequence = generateSuggestedSequence({
      painSignals: pain.painSignals,
      recommendedAction: recommendedNextAction,
    })

    const suggestedCallOpening = generateSuggestedCallOpening({
      companyName: lead.companyName,
      industry: industry.industry,
      painSignals: pain.painSignals,
    })

    const researchConfidence = Math.min(
      1,
      computeResearchConfidence({
        fetchStatus: scrape.fetchStatus,
        industryConfidence: companyEvidenceBundle
          ? Math.max(industry.confidence, companyEvidenceBundle.qualityScores.industryConfidence)
          : industry.confidence,
        maturityScore: maturity.score,
        painSignalCount: pain.painSignals.length,
        technologyCount: tech.technologies.length,
      }) + (evidenceEnrichment?.evidenceConfidence ?? 0) * 0.15,
    )

    run = await finishProspectResearchRun(input.admin, run.id, {
      status: "completed",
      websiteUrl: scrape.url,
      industryGuess: industryGuess ?? industry.industry,
      employeeSizeGuess: companySignals.employeeSizeGuess,
      revenueSizeGuess: companySignals.revenueSizeGuess,
      websiteMaturityScore: maturity.score,
      socialPresenceScore: companySignals.socialPresenceScore,
      reputationScore: companySignals.reputationScore,
      technologyScore: tech.score,
      detectedTechnologies: tech.technologies,
      signals: {
        painSignals: pain.painSignals,
        maturityBreakdown: maturity.breakdown,
        hasSsl: flags.hasSsl,
        hasMobileViewport: flags.hasMobileViewport,
        hasOnlineBooking: flags.hasOnlineBooking,
        hasCustomerPortal: flags.hasCustomerPortal,
        hasChatWidget: flags.hasChatWidget,
        hasFinancing: flags.hasFinancing,
        hasSocialLinks: flags.hasSocialLinks,
        hasReviewLinks: flags.hasReviewLinks,
        companyEvidence_v22: companyEvidenceBundle ?? undefined,
      },
      competitors: companySignals.competitors,
      researchSummary,
      suggestedPitchAngle,
      suggestedSequence,
      suggestedCallOpening,
      recommendedNextAction,
      researchConfidence,
    })

    await markLeadProspectResearchCompleted(input.admin, lead.id, run)
    await recomputeGrowthLeadWorkflowSignals(input.admin, lead.id)

    void scheduleUnifiedRevenueWorkflowLifecycleReEvaluation({
      admin: input.admin,
      leadId: lead.id,
      event: "website_analysis_completed",
      actor: { userId: input.createdBy ?? null, email: null },
    })
    void scheduleUnifiedRevenueWorkflowLifecycleReEvaluation({
      admin: input.admin,
      leadId: lead.id,
      event: "operator_rerun_research",
      actor: { userId: input.createdBy ?? null, email: null },
    })

    logGrowthEngine("prospect_research_completed", {
      leadId: lead.id,
      runId: run.id,
      maturityScore: run.websiteMaturityScore,
      recommendedNextAction: run.recommendedNextAction,
    })

    const refreshedLead = await fetchGrowthLeadById(input.admin, lead.id)
    return { ok: true, run, cached: false, lead: refreshedLead }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    run = await finishProspectResearchRun(input.admin, run.id, {
      status: "failed",
      failedReason: message.slice(0, 240),
    })
    logProspectResearch("failed", { leadId: lead.id, runId: run.id, message: message.slice(0, 240) })
    return { ok: false, code: "research_failed", message: message.slice(0, 240), run }
  }
}
