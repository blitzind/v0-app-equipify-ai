/** GS-AI-PLAYBOOK-1A — Seeded industry playbook builder helper. */

import type { GrowthIndustryId } from "@/lib/growth/playbooks/industry-taxonomy"
import type { GrowthIndustryPlaybook } from "@/lib/growth/playbooks/industry-playbook-types"
import { getGrowthIndustryTaxonomyEntry } from "@/lib/growth/playbooks/industry-taxonomy"

type SeedInput = {
  industryId: GrowthIndustryId
  overview: string
  pains: string[]
  discoveryQuestions: string[]
  objections?: string[]
  proofPoints: string[]
  capabilityMappings?: GrowthIndustryPlaybook["capabilityMappings"]
  videoStorylines?: GrowthIndustryPlaybook["videoStorylines"]
  sharePageStorylines?: GrowthIndustryPlaybook["sharePageStorylines"]
  recommendedCtas: string[]
  keywords?: string[]
}

function padList(items: string[], min: number, filler: string): string[] {
  const filled = items.map((entry) => entry.trim()).filter(Boolean)
  while (filled.length < min) filled.push(filler)
  return filled
}

export function buildSeededIndustryPlaybook(input: SeedInput): GrowthIndustryPlaybook {
  const taxonomy = getGrowthIndustryTaxonomyEntry(input.industryId)
  return {
    id: input.industryId,
    industryId: input.industryId,
    displayName: taxonomy.label,
    overview: input.overview,
    pains: padList(input.pains, 3, "Operational visibility gaps slow response and billing follow-through."),
    discoveryQuestions: padList(
      input.discoveryQuestions,
      3,
      "What would improve visibility for your team in the next 90 days?",
    ),
    objections: input.objections ?? [
      "We already have a system in place.",
      "Our team is too busy for a change right now.",
      "We need to see ROI before expanding scope.",
    ],
    proofPoints: padList(input.proofPoints, 3, "Unified work orders, assets, and service history in one system."),
    capabilityMappings: input.capabilityMappings ?? [
      {
        capability: "Work order visibility",
        painSignal: "Dispatch gaps and repeat truck rolls",
        equipifyModule: "Work Orders + Dispatch",
      },
      {
        capability: "Preventive maintenance",
        painSignal: "Missed PM due dates and compliance risk",
        equipifyModule: "Maintenance Plans",
      },
      {
        capability: "Asset history",
        painSignal: "Technicians arrive without prior service context",
        equipifyModule: "Equipment + Service History",
      },
    ],
    videoStorylines: input.videoStorylines ?? [
      {
        title: "Visibility before headcount",
        hook: "Show how one ops lead reduced dispatch friction without adding coordinators.",
        audience: "Operations leader",
      },
    ],
    sharePageStorylines: input.sharePageStorylines ?? [
      {
        title: "Operational snapshot",
        hook: "A concise page explaining how similar teams tightened service visibility.",
        audience: "Prospect operator",
      },
    ],
    recommendedCtas: input.recommendedCtas.length >= 3
      ? input.recommendedCtas
      : [...input.recommendedCtas, "Book a brief workflow review"].slice(0, 3),
    keywords: input.keywords ?? taxonomy.keywords,
  }
}
