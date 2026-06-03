import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  assembleBrowserIntakeCallPrep,
  type BrowserIntakeCallPrepAssemblyInput,
} from "@/lib/growth/browser-intake/assemble-browser-intake-call-prep"
import type { GrowthBrowserIntakeCallPrepArtifact } from "@/lib/growth/browser-intake/browser-intake-call-prep-types"
import {
  findBrowserIntakeExistingLeads,
  pickBestBrowserIntakeLeadMatch,
} from "@/lib/growth/browser-intake/browser-intake-lead-lookup"
import { listGrowthLeadDecisionMakers } from "@/lib/growth/decision-maker-repository"
import { extractLeadEngineOutputsFromRun } from "@/lib/growth/lead-operator-workspace/lead-engine-run-extract"
import {
  GROWTH_LEAD_ENGINE_RUN_METADATA_KEY,
  type GrowthLeadEnginePipelineRun,
} from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { loadProspectIntelligenceBundle } from "@/lib/growth/research/research-repository"
import { listGrowthLeadTimelineEvents } from "@/lib/growth/timeline-repository"
import { buildLeadMemoryInfluenceContext } from "@/lib/growth/lead-memory/memory-influence-context"

function isPipelineRun(value: unknown): value is GrowthLeadEnginePipelineRun {
  if (!value || typeof value !== "object") return false
  const row = value as Record<string, unknown>
  return Array.isArray(row.stage_results) && typeof row.run_id === "string"
}

async function resolveLeadId(
  admin: SupabaseClient,
  input: {
    lead_id?: string | null
    company_name?: string | null
    website?: string | null
    linkedin_url?: string | null
    email?: string | null
  },
): Promise<string | null> {
  if (input.lead_id) return input.lead_id

  const matches = await findBrowserIntakeExistingLeads(admin, {
    company_name: input.company_name,
    website: input.website,
    linkedin_url: input.linkedin_url,
    email: input.email,
    limit: 5,
  })
  const best = pickBestBrowserIntakeLeadMatch(matches)
  if (!best || best.confidence < 0.7) return null
  return best.lead_id
}

export async function buildBrowserIntakeCallPrep(
  admin: SupabaseClient,
  input: {
    lead_id?: string | null
    company_name?: string | null
    website?: string | null
    linkedin_url?: string | null
    email?: string | null
  },
): Promise<{ matched: boolean; artifact: GrowthBrowserIntakeCallPrepArtifact | null; message?: string }> {
  const leadId = await resolveLeadId(admin, input)
  if (!leadId) {
    return {
      matched: false,
      artifact: null,
      message: "No matching lead found. Save the prospect to Equipify first.",
    }
  }

  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) {
    return { matched: false, artifact: null, message: "Lead not found." }
  }

  const [researchBundle, decisionMakers, timeline, memory] = await Promise.all([
    loadProspectIntelligenceBundle(admin, lead.id),
    listGrowthLeadDecisionMakers(admin, lead.id),
    listGrowthLeadTimelineEvents(admin, { leadId: lead.id, limit: 5 }),
    buildLeadMemoryInfluenceContext(admin, lead.id),
  ])

  const runRaw = lead.metadata?.[GROWTH_LEAD_ENGINE_RUN_METADATA_KEY]
  const leadEngineRun = isPipelineRun(runRaw) ? runRaw : null
  const outputs = leadEngineRun ? extractLeadEngineOutputsFromRun(leadEngineRun) : {}

  const primaryDecisionMaker =
    decisionMakers.find((dm) => dm.isPrimary) ?? decisionMakers[0] ?? null

  const assemblyInput: BrowserIntakeCallPrepAssemblyInput = {
    lead: {
      id: lead.id,
      companyName: lead.companyName,
      contactName: lead.contactName,
      title: primaryDecisionMaker?.title ?? null,
      website: lead.website,
      city: lead.city,
      state: lead.state,
      status: lead.status,
      score: lead.score,
      notes: lead.notes,
      nextBestAction: lead.nextBestAction,
      nextBestActionReason: lead.nextBestActionReason,
    },
    researchRun: researchBundle.latestRun,
    accountBrief: outputs.accountBrief ?? null,
    companyDiscovery: outputs.companyDiscovery ?? null,
    decisionMakerHypothesis: outputs.decisionMakerHypothesis ?? null,
    verificationTriage: outputs.verificationTriage ?? null,
    decisionMakers: decisionMakers.map((dm) => ({
      name: dm.fullName,
      title: dm.title,
      role: dm.title,
    })),
    timelineSummaries: timeline
      .map((event) => event.title ?? event.summary)
      .filter((value): value is string => Boolean(value?.trim())),
    relationshipMemory: memory.available
      ? {
          summary: memory.relationshipSummary,
          objections: memory.topObjections,
          preferences: memory.topPreferences,
          interactions: memory.priorInteractionSummaries,
          commitments: memory.commitmentSummaries,
        }
      : undefined,
  }

  return {
    matched: true,
    artifact: assembleBrowserIntakeCallPrep(assemblyInput),
  }
}
