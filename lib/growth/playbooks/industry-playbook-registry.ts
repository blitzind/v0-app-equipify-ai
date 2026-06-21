/** GS-AI-PLAYBOOK-1A — Industry playbook registry (client-safe, no personalization coupling). */

import type { GrowthIndustryId } from "@/lib/growth/playbooks/industry-taxonomy"
import { GROWTH_INDUSTRY_IDS } from "@/lib/growth/playbooks/industry-taxonomy"
import {
  assertValidGrowthIndustryPlaybook,
  GROWTH_INDUSTRY_PLAYBOOK_QA_MARKER,
  type GrowthIndustryPlaybook,
} from "@/lib/growth/playbooks/industry-playbook-types"
import {
  resolveGrowthIndustry,
  type GrowthIndustryResolverInput,
  type GrowthIndustryResolution,
} from "@/lib/growth/playbooks/industry-playbook-resolver"
import {
  GROWTH_INDUSTRY_PLAYBOOK_BY_ID,
  GROWTH_INDUSTRY_SEEDED_PLAYBOOKS,
} from "@/lib/growth/playbooks/playbooks"

export { GROWTH_INDUSTRY_PLAYBOOK_QA_MARKER }

function playbookMap(): Map<GrowthIndustryId, GrowthIndustryPlaybook> {
  return new Map(GROWTH_INDUSTRY_SEEDED_PLAYBOOKS.map((playbook) => [playbook.industryId, playbook]))
}

export function listIndustryPlaybooks(): GrowthIndustryPlaybook[] {
  return [...GROWTH_INDUSTRY_SEEDED_PLAYBOOKS]
}

export function getIndustryPlaybook(industryId: GrowthIndustryId): GrowthIndustryPlaybook | null {
  return GROWTH_INDUSTRY_PLAYBOOK_BY_ID[industryId] ?? null
}

export function resolveIndustryPlaybook(input: GrowthIndustryResolverInput): {
  resolution: GrowthIndustryResolution
  playbook: GrowthIndustryPlaybook | null
} {
  const resolution = resolveGrowthIndustry(input)
  const playbook = resolution.industryId ? getIndustryPlaybook(resolution.industryId) : null
  return { resolution, playbook }
}

export function assertIndustryPlaybookRegistryHealthy(): void {
  if (GROWTH_INDUSTRY_SEEDED_PLAYBOOKS.length !== GROWTH_INDUSTRY_IDS.length) {
    throw new Error(
      `Expected ${GROWTH_INDUSTRY_IDS.length} seeded playbooks, found ${GROWTH_INDUSTRY_SEEDED_PLAYBOOKS.length}`,
    )
  }

  const map = playbookMap()
  for (const industryId of GROWTH_INDUSTRY_IDS) {
    const playbook = map.get(industryId)
    if (!playbook) throw new Error(`Missing seeded playbook for ${industryId}`)
    assertValidGrowthIndustryPlaybook(playbook)
  }
}
