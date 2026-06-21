/** GS-AI-PLAYBOOK-1A — Industry playbook schema (client-safe). */

import type { GrowthIndustryId } from "@/lib/growth/playbooks/industry-taxonomy"

export const GROWTH_INDUSTRY_PLAYBOOK_QA_MARKER = "growth-industry-playbook-foundation-gs-ai-playbook-1a-v1" as const

export type GrowthIndustryPlaybookCapabilityMapping = {
  capability: string
  painSignal: string
  equipifyModule: string
}

export type GrowthIndustryPlaybookStoryline = {
  title: string
  hook: string
  audience: string
}

export type GrowthIndustryPlaybook = {
  id: string
  industryId: GrowthIndustryId
  displayName: string
  overview: string
  pains: string[]
  discoveryQuestions: string[]
  objections: string[]
  proofPoints: string[]
  capabilityMappings: GrowthIndustryPlaybookCapabilityMapping[]
  videoStorylines: GrowthIndustryPlaybookStoryline[]
  sharePageStorylines: GrowthIndustryPlaybookStoryline[]
  recommendedCtas: string[]
  keywords: string[]
}

export type GrowthIndustryPlaybookValidationIssue = {
  path: string
  message: string
}

const MIN_LIST_ITEMS = 3
const MAX_LIST_ITEMS = 12

function countIssues(items: string[], path: string, issues: GrowthIndustryPlaybookValidationIssue[]): void {
  const filled = items.map((entry) => entry.trim()).filter(Boolean)
  if (filled.length < MIN_LIST_ITEMS) {
    issues.push({ path, message: `Expected at least ${MIN_LIST_ITEMS} items, got ${filled.length}` })
  }
  if (filled.length > MAX_LIST_ITEMS) {
    issues.push({ path, message: `Expected at most ${MAX_LIST_ITEMS} items, got ${filled.length}` })
  }
}

export function validateGrowthIndustryPlaybook(
  playbook: GrowthIndustryPlaybook,
): GrowthIndustryPlaybookValidationIssue[] {
  const issues: GrowthIndustryPlaybookValidationIssue[] = []

  if (!playbook.id.trim()) issues.push({ path: "id", message: "id is required" })
  if (!playbook.industryId.trim()) issues.push({ path: "industryId", message: "industryId is required" })
  if (playbook.id !== playbook.industryId) {
    issues.push({ path: "id", message: "id must match industryId for seeded playbooks" })
  }
  if (!playbook.displayName.trim()) issues.push({ path: "displayName", message: "displayName is required" })
  if (!playbook.overview.trim()) issues.push({ path: "overview", message: "overview is required" })

  countIssues(playbook.pains, "pains", issues)
  countIssues(playbook.discoveryQuestions, "discoveryQuestions", issues)
  countIssues(playbook.proofPoints, "proofPoints", issues)
  countIssues(playbook.recommendedCtas, "recommendedCtas", issues)
  countIssues(playbook.keywords, "keywords", issues)

  if (playbook.objections.length > MAX_LIST_ITEMS) {
    issues.push({ path: "objections", message: `Too many objections (${playbook.objections.length})` })
  }

  for (const [index, mapping] of playbook.capabilityMappings.entries()) {
    if (!mapping.capability.trim() || !mapping.painSignal.trim() || !mapping.equipifyModule.trim()) {
      issues.push({ path: `capabilityMappings[${index}]`, message: "All mapping fields are required" })
    }
  }

  for (const [index, storyline] of [...playbook.videoStorylines, ...playbook.sharePageStorylines].entries()) {
    if (!storyline.title.trim() || !storyline.hook.trim()) {
      issues.push({ path: `storyline[${index}]`, message: "Storyline title and hook are required" })
    }
  }

  return issues
}

export function assertValidGrowthIndustryPlaybook(playbook: GrowthIndustryPlaybook): void {
  const issues = validateGrowthIndustryPlaybook(playbook)
  if (issues.length > 0) {
    throw new Error(
      `Invalid playbook ${playbook.id}: ${issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`,
    )
  }
}
