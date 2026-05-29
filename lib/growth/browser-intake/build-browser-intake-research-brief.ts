import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  assembleBrowserIntakeResearchBrief,
  type BrowserIntakeResearchBriefAssemblyInput,
} from "@/lib/growth/browser-intake/assemble-browser-intake-research-brief"
import type { GrowthBrowserIntakeResearchBriefArtifact } from "@/lib/growth/browser-intake/browser-intake-research-brief-types"
import {
  findBrowserIntakeExistingLeads,
  pickBestBrowserIntakeLeadMatch,
} from "@/lib/growth/browser-intake/browser-intake-lead-lookup"
import { extractLeadEngineOutputsFromRun } from "@/lib/growth/lead-operator-workspace/lead-engine-run-extract"
import {
  GROWTH_LEAD_ENGINE_RUN_METADATA_KEY,
  type GrowthLeadEnginePipelineRun,
} from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { loadProspectIntelligenceBundle } from "@/lib/growth/research/research-repository"

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

export async function buildBrowserIntakeResearchBrief(
  admin: SupabaseClient,
  input: {
    lead_id?: string | null
    company_name?: string | null
    website?: string | null
    linkedin_url?: string | null
    email?: string | null
  },
): Promise<{ matched: boolean; artifact: GrowthBrowserIntakeResearchBriefArtifact | null; message?: string }> {
  const leadId = await resolveLeadId(admin, input)
  if (!leadId) {
    return {
      matched: false,
      artifact: null,
      message: "No matching lead found. Save the company to Equipify first.",
    }
  }

  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) return { matched: false, artifact: null, message: "Lead not found." }

  const researchBundle = await loadProspectIntelligenceBundle(admin, lead.id)
  const runRaw = lead.metadata?.[GROWTH_LEAD_ENGINE_RUN_METADATA_KEY]
  const leadEngineRun = isPipelineRun(runRaw) ? runRaw : null
  const outputs = leadEngineRun ? extractLeadEngineOutputsFromRun(leadEngineRun) : {}

  const assemblyInput: BrowserIntakeResearchBriefAssemblyInput = {
    lead: {
      id: lead.id,
      companyName: lead.companyName,
      nextBestActionReason: lead.nextBestActionReason,
    },
    researchRun: researchBundle.latestRun,
    accountBrief: outputs.accountBrief ?? null,
    companyDiscovery: outputs.companyDiscovery ?? null,
  }

  return {
    matched: true,
    artifact: assembleBrowserIntakeResearchBrief(assemblyInput),
  }
}
