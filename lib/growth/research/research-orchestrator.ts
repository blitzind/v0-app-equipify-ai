import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId, logGrowthEngine } from "@/lib/growth/access"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { recomputeGrowthLeadWorkflowSignals } from "@/lib/growth/recompute-lead-next-best-action"
import { scheduleUnifiedRevenueWorkflowLifecycleReEvaluation } from "@/lib/growth/revenue-workflow/unified-revenue-workflow-lifecycle-runner"
import { collectProspectCompanyEvidence } from "@/lib/growth/research/company-evidence/company-evidence-collector"
import { buildProspectKnowledgePack } from "@/lib/growth/research/company-evidence/prospect-knowledge-pack"
import {
  GROWTH_COMPANY_EVIDENCE_COLLECTION_QA_MARKER,
  type GrowthCompanyEvidenceCollectionRecord,
} from "@/lib/growth/research/company-evidence/company-evidence-types"
import {
  enrichCompanyIntelligenceFromEvidence,
  mergeEvidenceIntoResearchSummary,
  resolveVerifiedIndustryGuess,
} from "@/lib/growth/research/company-evidence/company-evidence-intelligence-enrichment"
import { promoteCompanyEvidenceToCompanyIntelligence } from "@/lib/growth/company-intelligence/promote-from-company-evidence"
import { triggerBuyingCommitteeIntelligenceAfterCompanyIntelligence } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-triggers"
import { resolveCanonicalCompanyIdForLead } from "@/lib/growth/canonical-persons/canonical-person-repository"
import { loadGrowthLeadAdmissionContext } from "@/lib/growth/revenue-workflow/growth-lead-admission-context"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { reconcileExternalDiscoveryPostResearchAdmission } from "@/lib/growth/revenue-workflow/growth-operational-keyword-validation-server-1a"
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
import { normalizeGrowthResearchConfidence } from "@/lib/growth/research/research-confidence"
import type { GrowthResearchRunPublicView } from "@/lib/growth/research/research-types"
import { detectWebsiteTechnologies } from "@/lib/growth/research/technology-detector"
import { detectWebsiteFeatureFlags, scoreWebsiteMaturity } from "@/lib/growth/research/website-maturity-score"
import type { GrowthCompanyEvidenceBundle } from "@/lib/growth/research/company-evidence/company-evidence-types"
import type { GrowthLeadAdmissionContext } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import type { GrowthLead } from "@/lib/growth/types"

export const GROWTH_RESEARCH_CACHE_HIT_POST_RECONCILE_7B_QA_MARKER =
  "ge-aios-live-7b-cache-hit-post-research-reconcile-v1" as const

export type RunProspectResearchInput = {
  admin: SupabaseClient
  leadId: string
  rebuild?: boolean
  createdBy?: string | null
}

export type RunProspectResearchResult =
  | { ok: true; run: GrowthResearchRunPublicView; cached: boolean; lead?: GrowthLead | null }
  | { ok: false; code: string; message: string; run?: GrowthResearchRunPublicView | null }

function buildCompanyEvidenceCollectionRecord(input: {
  status: GrowthCompanyEvidenceCollectionRecord["status"]
  reason?: string
  warnings?: string[]
}): GrowthCompanyEvidenceCollectionRecord {
  return {
    qaMarker: GROWTH_COMPANY_EVIDENCE_COLLECTION_QA_MARKER,
    status: input.status,
    reason: input.reason,
    warnings: input.warnings?.length ? input.warnings.slice(0, 4) : undefined,
    collectedAt: new Date().toISOString(),
  }
}

function resolvePostResearchEvidenceFromRun(run: GrowthResearchRunPublicView): {
  evidenceBundle: GrowthCompanyEvidenceBundle | null
  websiteCrawlText: string | null
} {
  return {
    evidenceBundle: run.signals?.companyEvidence_v22 ?? null,
    websiteCrawlText: run.researchSummary?.trim() ? run.researchSummary : null,
  }
}

async function finalizeProspectResearchCompletion(input: {
  admin: SupabaseClient
  lead: GrowthLead
  run: GrowthResearchRunPublicView
  admissionContext: GrowthLeadAdmissionContext
  evidenceBundle?: GrowthCompanyEvidenceBundle | null
  websiteCrawlText?: string | null
  createdBy?: string | null
  cached: boolean
}): Promise<GrowthLead | null> {
  const resolvedFromRun = resolvePostResearchEvidenceFromRun(input.run)

  await markLeadProspectResearchCompleted(input.admin, input.lead.id, input.run)
  await recomputeGrowthLeadWorkflowSignals(input.admin, input.lead.id)

  const postResearchAdmission = await reconcileExternalDiscoveryPostResearchAdmission({
    admin: input.admin,
    lead: input.lead,
    admissionContext: input.admissionContext,
    evidenceBundle: input.evidenceBundle ?? resolvedFromRun.evidenceBundle,
    websiteCrawlText: input.websiteCrawlText ?? resolvedFromRun.websiteCrawlText,
  })
  if (postResearchAdmission.applied) {
    logProspectResearch("external_discovery_post_research_admission", {
      leadId: input.lead.id,
      runId: input.run.id,
      admissionState: postResearchAdmission.admissionState,
      keywordValidationPass: postResearchAdmission.keywordValidationPass,
      industryGatePassed: postResearchAdmission.industryGatePassed,
      cached: input.cached,
      qa_marker: GROWTH_RESEARCH_CACHE_HIT_POST_RECONCILE_7B_QA_MARKER,
    })
  }

  void scheduleUnifiedRevenueWorkflowLifecycleReEvaluation({
    admin: input.admin,
    leadId: input.lead.id,
    event: "website_analysis_completed",
    actor: { userId: input.createdBy ?? null, email: null },
  })
  void scheduleUnifiedRevenueWorkflowLifecycleReEvaluation({
    admin: input.admin,
    leadId: input.lead.id,
    event: "operator_rerun_research",
    actor: { userId: input.createdBy ?? null, email: null },
  })

  logGrowthEngine("prospect_research_completed", {
    leadId: input.lead.id,
    runId: input.run.id,
    maturityScore: input.run.websiteMaturityScore,
    recommendedNextAction: input.run.recommendedNextAction,
    cached: input.cached,
  })

  return fetchGrowthLeadById(input.admin, input.lead.id)
}

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
      if (cached.status === "completed") {
        const admissionContext = await loadGrowthLeadAdmissionContext(input.admin, organizationId)
        const refreshedLead = await finalizeProspectResearchCompletion({
          admin: input.admin,
          lead,
          run: cached,
          admissionContext,
          createdBy: input.createdBy ?? null,
          cached: true,
        })
        return { ok: true, run: cached, cached: true, lead: refreshedLead ?? lead }
      }
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
    const claimed = await markProspectResearchRunRunning(input.admin, run.id)
    if (!claimed) {
      const active = await fetchActiveProspectResearchRun(input.admin, lead.id)
      if (active) {
        return { ok: true, run: active, cached: true, lead }
      }
      throw new Error("research_run_claim_lost_race")
    }

    const scrape = await scrapeProspectWebsite(lead.website)

    const admissionContext = await loadGrowthLeadAdmissionContext(input.admin, organizationId)
    const admissionState = resolveLeadAdmissionStateFromMetadata(lead.metadata)

    let companyEvidenceBundle = null as Awaited<ReturnType<typeof collectProspectCompanyEvidence>>["bundle"]
    let companyEvidenceCollection = buildCompanyEvidenceCollectionRecord({
      status: "skipped",
      reason: "not_attempted",
    })

    const canCollectEvidence =
      Boolean(lead.website?.trim()) &&
      (scrape.fetchStatus === "ok" || Boolean(scrape.html?.trim()))

    if (!lead.website?.trim()) {
      companyEvidenceCollection = buildCompanyEvidenceCollectionRecord({
        status: "skipped",
        reason: "no_website",
      })
    } else if (!canCollectEvidence) {
      companyEvidenceCollection = buildCompanyEvidenceCollectionRecord({
        status: "skipped",
        reason: `website_fetch_${scrape.fetchStatus}`,
      })
    } else {
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
        if (companyEvidenceBundle) {
          companyEvidenceCollection = buildCompanyEvidenceCollectionRecord({
            status: "collected",
            warnings: evidenceResult.warnings,
          })
        } else {
          companyEvidenceCollection = buildCompanyEvidenceCollectionRecord({
            status: "skipped",
            reason: evidenceResult.warnings[0] ?? "collector_returned_null",
            warnings: evidenceResult.warnings,
          })
        }
        if (evidenceResult.warnings.length > 0) {
          logProspectResearch("company_evidence_warnings", {
            leadId: lead.id,
            runId: run.id,
            warnings: evidenceResult.warnings.slice(0, 4),
          })
        }
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 180) : String(error).slice(0, 180)
        companyEvidenceCollection = buildCompanyEvidenceCollectionRecord({
          status: "failed",
          reason: message,
        })
        logProspectResearch("company_evidence_failed", {
          leadId: lead.id,
          runId: run.id,
          message,
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
      100,
      Math.round(
        computeResearchConfidence({
          fetchStatus: scrape.fetchStatus,
          industryConfidence: companyEvidenceBundle
            ? Math.max(industry.confidence, companyEvidenceBundle.qualityScores.industryConfidence)
            : industry.confidence,
          maturityScore: maturity.score,
          painSignalCount: pain.painSignals.length,
          technologyCount: tech.technologies.length,
        }) + (evidenceEnrichment?.evidenceConfidence ?? 0) * 15,
      ),
    )

    const preliminarySignals = {
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
    }

    const prospectKnowledgePack = buildProspectKnowledgePack({
      bundle: companyEvidenceBundle,
      signals: preliminarySignals,
      observedAt: companyEvidenceBundle?.collectedAt ?? new Date().toISOString(),
    })

    let companyEvidencePromotion:
      | {
          attempted: number
          promoted: number
          skippedReason: string | null
          rejectedCount: number
        }
      | undefined

    try {
      const canonicalCompanyId = await resolveCanonicalCompanyIdForLead(input.admin, lead.id)
      const promotion = await promoteCompanyEvidenceToCompanyIntelligence(input.admin, {
        companyId: canonicalCompanyId,
        bundle: companyEvidenceBundle,
      })
      companyEvidencePromotion = {
        attempted: promotion.attempted,
        promoted: promotion.promoted,
        skippedReason: promotion.skippedReason,
        rejectedCount: promotion.rejected.length,
      }

      if (promotion.companyId && promotion.skippedReason === null) {
        void triggerBuyingCommitteeIntelligenceAfterCompanyIntelligence(input.admin, {
          company_id: promotion.companyId,
          created_by: input.createdBy ?? null,
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 120) : "promotion_failed"
      companyEvidencePromotion = {
        attempted: 0,
        promoted: 0,
        skippedReason: message,
        rejectedCount: 0,
      }
      logProspectResearch("company_evidence_promotion_failed", {
        leadId: lead.id,
        runId: run.id,
        message,
      })
    }

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
        ...preliminarySignals,
        companyEvidence_v22: companyEvidenceBundle ?? undefined,
        companyEvidenceCollection_v22: companyEvidenceCollection,
        prospectKnowledgePack_v25c: prospectKnowledgePack,
        companyEvidencePromotion_v25c: companyEvidencePromotion,
      },
      competitors: companySignals.competitors,
      researchSummary,
      suggestedPitchAngle,
      suggestedSequence,
      suggestedCallOpening,
      recommendedNextAction,
      researchConfidence,
    })

    const refreshedLead = await finalizeProspectResearchCompletion({
      admin: input.admin,
      lead,
      run,
      admissionContext,
      evidenceBundle: companyEvidenceBundle,
      websiteCrawlText: scrape.plainText,
      createdBy: input.createdBy ?? null,
      cached: false,
    })
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
