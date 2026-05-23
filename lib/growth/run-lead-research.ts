import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { runAiTask } from "@/lib/ai/server"
import { getGrowthEngineAiOrgId, logGrowthEngine } from "@/lib/growth/access"
import { fetchGrowthLeadById, markGrowthLeadResearchCompleted, updateGrowthLead } from "@/lib/growth/lead-repository"
import { applyGrowthLeadResearchEnrichment } from "@/lib/growth/apply-lead-research-enrichment"
import { recomputeGrowthLeadWorkflowSignals } from "@/lib/growth/recompute-lead-next-best-action"
import {
  emitGrowthLeadResearchTimeline,
  emitGrowthLeadWebsiteFetchTimeline,
} from "@/lib/growth/timeline-emitter"
import { hasGrowthLeadTimelineEventTypeSince } from "@/lib/growth/timeline-repository"
import { growthLeadResearchInputHash } from "@/lib/growth/research-input-hash"
import {
  buildGrowthLeadResearchSystemPrompt,
  buildGrowthLeadResearchUserPrompt,
  type GrowthLeadWebsitePromptContext,
} from "@/lib/growth/research-prompt"
import {
  fetchCachedGrowthLeadResearchRun,
  finishGrowthLeadResearchRun,
  insertGrowthLeadResearchRun,
} from "@/lib/growth/research-repository"
import { growthLeadResearchModelSchema, mapGrowthLeadResearchModelToResult } from "@/lib/growth/research-schema"
import type { GrowthLeadResearchRun, GrowthLeadResearchRunStatus } from "@/lib/growth/research-types"
import { fetchLeadWebsite, websiteFetchLogHost, type GrowthLeadWebsiteFetchResult } from "@/lib/growth/research-website-fetch"
import { normalizeLeadWebsite, type GrowthLeadWebsiteFetchStatus } from "@/lib/growth/research-website-url"
import type { GrowthLead, GrowthLeadStatus } from "@/lib/growth/types"

export type RunGrowthLeadResearchInput = {
  admin: SupabaseClient
  leadId: string
  createdBy: string | null
  actingUserEmail: string
  regenerate?: boolean
}

export type RunGrowthLeadResearchResult =
  | {
      ok: true
      run: GrowthLeadResearchRun
      leadStatus: GrowthLeadStatus
      leadScore: number | null
      lead?: GrowthLead | null
      cached: boolean
    }
  | { ok: false; code: string; message: string; run?: GrowthLeadResearchRun | null }

function nextLeadStatusAfterResearch(current: GrowthLeadStatus): GrowthLeadStatus {
  if (current === "new" || current === "researching") return "enriched"
  return current
}

function resolveRunStatusAfterAi(fetchStatus: GrowthLeadWebsiteFetchStatus): Extract<GrowthLeadResearchRunStatus, "succeeded" | "partial"> {
  if (fetchStatus === "ok" || fetchStatus === "skipped") return "succeeded"
  return "partial"
}

function isTerminalSuccessStatus(status: GrowthLeadResearchRunStatus): boolean {
  return status === "succeeded" || status === "partial"
}

function websitePromptContext(fetch: GrowthLeadWebsiteFetchResult): GrowthLeadWebsitePromptContext {
  return {
    fetchStatus: fetch.status,
    normalizedUrl: fetch.normalizedUrl,
    excerpt: fetch.excerpt,
  }
}

function finishWebsitePatch(fetch: GrowthLeadWebsiteFetchResult) {
  return {
    websiteUrl: fetch.normalizedUrl,
    websiteFetchStatus: fetch.status,
    websiteTextExcerpt: fetch.excerpt,
    sourceUrls: fetch.sourceUrls,
  }
}

export async function runGrowthLeadResearch(input: RunGrowthLeadResearchInput): Promise<RunGrowthLeadResearchResult> {
  const aiOrgId = getGrowthEngineAiOrgId()
  if (!aiOrgId) {
    return {
      ok: false,
      code: "server_config",
      message: "AI research is not configured. Set GROWTH_ENGINE_AI_ORG_ID on the server.",
    }
  }

  const lead = await fetchGrowthLeadById(input.admin, input.leadId)
  if (!lead) {
    return { ok: false, code: "not_found", message: "Lead not found." }
  }

  const regenerate = Boolean(input.regenerate)
  const inputHash = growthLeadResearchInputHash({
    companyName: lead.companyName,
    website: lead.website,
    contactName: lead.contactName,
    regenerate,
  })

  if (!regenerate) {
    try {
      const cachedRun = await fetchCachedGrowthLeadResearchRun(input.admin, lead.id, inputHash)
      if (cachedRun) {
        logGrowthEngine("research_cache_hit", {
          leadId: lead.id,
          runId: cachedRun.id,
          runStatus: cachedRun.status,
          inputHash,
        })
        return {
          ok: true,
          run: cachedRun,
          leadStatus: lead.status,
          leadScore: lead.score,
          cached: true,
        }
      }
    } catch (cacheError) {
      const cacheMessage = cacheError instanceof Error ? cacheError.message : String(cacheError)
      logGrowthEngine("research_cache_skipped", {
        leadId: lead.id,
        message: cacheMessage.slice(0, 240),
      })
    }
  }

  const normalizedWebsite = normalizeLeadWebsite(lead.website)
  const insertWebsiteUrl = normalizedWebsite.status === "ready" ? normalizedWebsite.url : null

  const started = Date.now()
  let run = await insertGrowthLeadResearchRun(input.admin, {
    lead,
    triggerKind: regenerate ? "regenerate" : "manual",
    inputHash,
    websiteUrl: insertWebsiteUrl,
    createdBy: input.createdBy,
  })

  logGrowthEngine("research_run_started", {
    leadId: lead.id,
    runId: run.id,
    triggerKind: run.triggerKind,
    inputHash,
  })

  await emitGrowthLeadResearchTimeline(input.admin, {
    leadId: lead.id,
    eventType: "research_started",
    runId: run.id,
    actor: { userId: input.createdBy, email: input.actingUserEmail },
  })

  if (lead.status === "new") {
    await updateGrowthLead(input.admin, lead.id, { status: "researching" })
  }

  const websiteFetchStarted = Date.now()
  const websiteFetch = await fetchLeadWebsite(lead.website)
  logGrowthEngine("website_fetch_finished", {
    leadId: lead.id,
    runId: run.id,
    status: websiteFetch.status,
    host: websiteFetchLogHost(websiteFetch),
    durationMs: websiteFetch.durationMs,
    byteCount: websiteFetch.byteCount,
  })

  const promptContext = websitePromptContext(websiteFetch)
  const websitePatch = finishWebsitePatch(websiteFetch)

  try {
    const aiResult = await runAiTask({
      task: "growth_lead_research",
      organizationId: aiOrgId,
      input: {
        system: buildGrowthLeadResearchSystemPrompt(promptContext),
        user: buildGrowthLeadResearchUserPrompt(lead, promptContext),
      },
      schema: growthLeadResearchModelSchema,
      cacheSchemaVersion: "growth_lead_research_v3",
      skipPlanGateCheck: true,
      skipBudgetCheck: true,
      actingUserEmail: input.actingUserEmail,
      forceLiveAi: true,
      taskOverrides: { structuredMode: "json_object" },
    })

    if (!aiResult.ok) {
      const message = aiResult.error.message
      const notConfigured = message.includes("No AI provider is configured")
      const errorCode = notConfigured ? "ai_not_configured" : "research_failed"
      run =
        (await finishGrowthLeadResearchRun(input.admin, run.id, {
          status: "failed",
          errorCode,
          errorMessage: message,
          durationMs: Date.now() - started,
          modelTask: "growth_lead_research",
          ...websitePatch,
        })) ?? run

      logGrowthEngine("research_run_failed", {
        leadId: lead.id,
        runId: run.id,
        errorCode,
        websiteFetchStatus: websiteFetch.status,
      })

      await emitGrowthLeadResearchTimeline(input.admin, {
        leadId: lead.id,
        eventType: "research_failed",
        runId: run.id,
        summary: message.slice(0, 240),
        payload: { errorCode },
        actor: { userId: input.createdBy, email: input.actingUserEmail },
      })

      if (websiteFetch.status !== "ok" && websiteFetch.status !== "skipped") {
        await emitGrowthLeadWebsiteFetchTimeline(input.admin, {
          leadId: lead.id,
          eventType: "website_fetch_failed",
          runId: run.id,
          status: websiteFetch.status,
          url: websiteFetch.normalizedUrl,
        })
      }

      return {
        ok: false,
        code: notConfigured ? "not_configured" : "research_failed",
        message: notConfigured
          ? "AI research is not configured. Set OPENAI_API_KEY and enable AI providers."
          : message.slice(0, 240),
        run,
      }
    }

    const result = mapGrowthLeadResearchModelToResult(growthLeadResearchModelSchema.parse(aiResult.output))
    const runStatus = resolveRunStatusAfterAi(websiteFetch.status)
    const mergedSourceUrls = websitePatch.sourceUrls.length ? websitePatch.sourceUrls : result.sourceUrls

    run =
      (await finishGrowthLeadResearchRun(input.admin, run.id, {
        status: runStatus,
        result,
        researchConfidence: result.researchConfidence,
        equipifyFitScore: result.equipifyFitScore,
        sourceUrls: mergedSourceUrls,
        modelTask: "growth_lead_research",
        modelProvider: aiResult.meta.provider,
        modelName: aiResult.meta.model,
        durationMs: Date.now() - started,
        ...websitePatch,
      })) ?? run

    const nextStatus = nextLeadStatusAfterResearch(lead.status)
    let updatedLead = null
    try {
      updatedLead = await markGrowthLeadResearchCompleted(input.admin, {
        leadId: lead.id,
        latestResearchRunId: run.id,
        equipifyFitScore: result.equipifyFitScore,
        status: nextStatus,
      })
    } catch (trackingError) {
      const trackingMessage = trackingError instanceof Error ? trackingError.message : String(trackingError)
      logGrowthEngine("lead_research_tracking_failed_nonfatal", {
        leadId: lead.id,
        runId: run.id,
        message: trackingMessage.slice(0, 240),
      })
    }

    try {
      await applyGrowthLeadResearchEnrichment(input.admin, {
        lead,
        result,
        createdBy: input.createdBy,
      })
    } catch (enrichmentError) {
      const enrichmentMessage = enrichmentError instanceof Error ? enrichmentError.message : String(enrichmentError)
      logGrowthEngine("research_enrichment_failed_nonfatal", {
        leadId: lead.id,
        runId: run.id,
        message: enrichmentMessage.slice(0, 240),
      })
    }

    await emitGrowthLeadResearchTimeline(input.admin, {
      leadId: lead.id,
      eventType: "research_completed",
      runId: run.id,
      summary: `Fit ${result.equipifyFitScore}`,
      payload: {
        fitScore: result.equipifyFitScore,
        runStatus,
        websiteFetchStatus: websiteFetch.status,
      },
      actor: { userId: input.createdBy, email: input.actingUserEmail },
    })

    if (websiteFetch.status !== "ok" && websiteFetch.status !== "skipped") {
      await emitGrowthLeadWebsiteFetchTimeline(input.admin, {
        leadId: lead.id,
        eventType: "website_fetch_failed",
        runId: run.id,
        status: websiteFetch.status,
        url: websiteFetch.normalizedUrl,
      })
    } else if (websiteFetch.status === "ok") {
      const hadPriorFailure = await hasGrowthLeadTimelineEventTypeSince(
        input.admin,
        lead.id,
        "website_fetch_failed",
      )
      if (hadPriorFailure) {
        await emitGrowthLeadWebsiteFetchTimeline(input.admin, {
          leadId: lead.id,
          eventType: "website_fetch_fixed",
          runId: run.id,
          status: websiteFetch.status,
          url: websiteFetch.normalizedUrl,
        })
      }
    }

    try {
      await recomputeGrowthLeadWorkflowSignals(input.admin, lead.id)
    } catch (workflowError) {
      const workflowMessage = workflowError instanceof Error ? workflowError.message : String(workflowError)
      logGrowthEngine("lead_workflow_recompute_failed_nonfatal", {
        leadId: lead.id,
        message: workflowMessage.slice(0, 240),
      })
    }

    logGrowthEngine(runStatus === "partial" ? "research_run_partial" : "research_run_succeeded", {
      leadId: lead.id,
      runId: run.id,
      equipifyFitScore: result.equipifyFitScore,
      researchConfidence: result.researchConfidence,
      fitModelVersion: result.fitModelVersion,
      websiteFetchStatus: websiteFetch.status,
      websiteFetchMs: Date.now() - websiteFetchStarted,
    })

    return {
      ok: true,
      run,
      leadStatus: updatedLead?.status ?? nextStatus,
      leadScore: updatedLead?.score ?? result.equipifyFitScore,
      lead: (await fetchGrowthLeadById(input.admin, lead.id)) ?? updatedLead,
      cached: false,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (!isTerminalSuccessStatus(run.status)) {
      run =
        (await finishGrowthLeadResearchRun(input.admin, run.id, {
          status: "failed",
          errorCode: "research_failed",
          errorMessage: message,
          durationMs: Date.now() - started,
          modelTask: "growth_lead_research",
          ...websitePatch,
        })) ?? run
    }

    logGrowthEngine("research_run_failed", {
      leadId: lead.id,
      runId: run.id,
      errorCode: "research_failed",
      message: message.slice(0, 240),
      websiteFetchStatus: websiteFetch.status,
    })

    return { ok: false, code: "research_failed", message: message.slice(0, 240), run }
  }
}
