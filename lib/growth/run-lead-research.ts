import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { runAiTask } from "@/lib/ai/server"
import { getGrowthEngineAiOrgId, logGrowthEngine } from "@/lib/growth/access"
import { fetchGrowthLeadById, markGrowthLeadResearchCompleted, updateGrowthLead } from "@/lib/growth/lead-repository"
import { growthLeadResearchInputHash } from "@/lib/growth/research-input-hash"
import {
  fetchCachedGrowthLeadResearchRun,
  finishGrowthLeadResearchRun,
  insertGrowthLeadResearchRun,
} from "@/lib/growth/research-repository"
import { GROWTH_LEAD_RESEARCH_SYSTEM, buildGrowthLeadResearchUserPrompt } from "@/lib/growth/research-prompt"
import { growthLeadResearchModelSchema, mapGrowthLeadResearchModelToResult } from "@/lib/growth/research-schema"
import type { GrowthLeadResearchRun } from "@/lib/growth/research-types"
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
      cached: boolean
    }
  | { ok: false; code: string; message: string; run?: GrowthLeadResearchRun | null }

function nextLeadStatusAfterResearch(current: GrowthLeadStatus): GrowthLeadStatus {
  if (current === "new" || current === "researching") return "enriched"
  return current
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

  const started = Date.now()
  let run = await insertGrowthLeadResearchRun(input.admin, {
    lead,
    triggerKind: regenerate ? "regenerate" : "manual",
    inputHash,
    createdBy: input.createdBy,
  })

  logGrowthEngine("research_run_started", {
    leadId: lead.id,
    runId: run.id,
    triggerKind: run.triggerKind,
    inputHash,
  })

  if (lead.status === "new") {
    await updateGrowthLead(input.admin, lead.id, { status: "researching" })
  }

  try {
    const aiResult = await runAiTask({
      task: "growth_lead_research",
      organizationId: aiOrgId,
      input: {
        system: GROWTH_LEAD_RESEARCH_SYSTEM,
        user: buildGrowthLeadResearchUserPrompt(lead),
      },
      schema: growthLeadResearchModelSchema,
      cacheSchemaVersion: "growth_lead_research_v1",
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
        })) ?? run

      logGrowthEngine("research_run_failed", {
        leadId: lead.id,
        runId: run.id,
        errorCode,
      })

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
    run =
      (await finishGrowthLeadResearchRun(input.admin, run.id, {
        status: "succeeded",
        result,
        researchConfidence: result.researchConfidence,
        equipifyFitScore: result.equipifyFitScore,
        sourceUrls: result.sourceUrls,
        modelTask: "growth_lead_research",
        modelProvider: aiResult.meta.provider,
        modelName: aiResult.meta.model,
        durationMs: Date.now() - started,
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

    logGrowthEngine("research_run_succeeded", {
      leadId: lead.id,
      runId: run.id,
      equipifyFitScore: result.equipifyFitScore,
      researchConfidence: result.researchConfidence,
      fitModelVersion: result.fitModelVersion,
    })

    return {
      ok: true,
      run,
      leadStatus: updatedLead?.status ?? nextStatus,
      leadScore: updatedLead?.score ?? result.equipifyFitScore,
      cached: false,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (run.status !== "succeeded") {
      run =
        (await finishGrowthLeadResearchRun(input.admin, run.id, {
          status: "failed",
          errorCode: "research_failed",
          errorMessage: message,
          durationMs: Date.now() - started,
          modelTask: "growth_lead_research",
        })) ?? run
    }

    logGrowthEngine("research_run_failed", {
      leadId: lead.id,
      runId: run.id,
      errorCode: "research_failed",
      message: message.slice(0, 240),
    })

    return { ok: false, code: "research_failed", message: message.slice(0, 240), run }
  }
}
