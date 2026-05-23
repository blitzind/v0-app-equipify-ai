/**
 * Regression checks for Growth Engine AI Copilot Playbook Training (slice 6.1A).
 * Run: pnpm test:growth-ai-copilot-playbooks
 */
import assert from "node:assert/strict"
import { buildGrowthAiCopilotSystemPrompt } from "../lib/growth/ai-copilot-prompts"
import { detectPlaybookApprovedConflicts, detectPlaybookDraftConflicts } from "../lib/growth/ai-copilot-playbook-conflicts"
import {
  buildPlaybookAttribution,
  computePlaybookInfluenceScore,
} from "../lib/growth/ai-copilot-playbook-influence"
import { growthAiCopilotPlaybookExtractionSchema } from "../lib/growth/ai-copilot-playbook-schema"
import { slugifyPlaybookRuleKey } from "../lib/growth/ai-copilot-playbook-types"

const parsed = growthAiCopilotPlaybookExtractionSchema.parse({
  rules: [
    {
      category: "tone",
      title: "Keep emails concise",
      principle: "Use short paragraphs and direct language.",
      appliesTo: ["cold_email"],
      priority: 70,
    },
    {
      category: "tone",
      title: "Prefer long-form detail",
      principle: "Write detailed long-form emails with extensive context.",
      appliesTo: ["cold_email"],
      priority: 65,
    },
  ],
  summary: "Mixed tone guidance",
})

assert.equal(parsed.rules.length, 2)

const draftConflicts = detectPlaybookDraftConflicts(
  parsed.rules.map((rule, index) => ({
    id: `draft-${index}`,
    extractionId: "extraction-1",
    sourceId: "source-1",
    category: rule.category,
    title: rule.title,
    principle: rule.principle,
    appliesTo: rule.appliesTo,
    priority: rule.priority,
    industryScope: { appliesGlobally: true },
    trainerProfile: { name: "Trainer A" },
    metadata: {},
    status: "draft" as const,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date().toISOString(),
  })),
)
assert.ok(draftConflicts.length > 0)

const approvedConflicts = detectPlaybookApprovedConflicts([
  {
    id: "rule-1",
    ruleKey: "concise",
    category: "tone",
    title: "Concise tone",
    principle: "Stay concise and brief.",
    appliesTo: [],
    priority: 80,
    version: 1,
    industryScope: { appliesGlobally: true },
    trainerProfile: {},
    status: "active",
    sourceId: null,
    approvedBy: null,
    approvedAt: null,
    supersededAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "rule-2",
    ruleKey: "long_form",
    category: "tone",
    title: "Long form tone",
    principle: "Use long-form detailed messaging.",
    appliesTo: [],
    priority: 75,
    version: 1,
    industryScope: { appliesGlobally: true },
    trainerProfile: {},
    status: "active",
    sourceId: null,
    approvedBy: null,
    approvedAt: null,
    supersededAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
])
assert.ok(approvedConflicts.length > 0)

const rules = [
  {
    id: "rule-1",
    ruleKey: "cta",
    category: "cta" as const,
    title: "Soft CTA",
    principle: "Ask for a short call.",
    appliesTo: [] as never[],
    priority: 80,
    version: 1,
    industryScope: { appliesGlobally: true },
    trainerProfile: { name: "Trainer A" },
    status: "active" as const,
    sourceId: "source-1",
    approvedBy: null,
    approvedAt: null,
    supersededAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sourceTitle: "Training notes",
  },
]

const influence = computePlaybookInfluenceScore(rules)
assert.ok(influence > 0 && influence <= 100)

const attribution = buildPlaybookAttribution({ rules, conflicts: approvedConflicts })
assert.equal(attribution.ruleIds.length, 1)
assert.equal(attribution.trainerProfiles[0]?.name, "Trainer A")

const prompt = buildGrowthAiCopilotSystemPrompt("cold_email", "default", rules)
assert.ok(prompt.includes("Approved playbook operating rules"))
assert.ok(prompt.includes("Soft CTA"))

assert.equal(slugifyPlaybookRuleKey("Keep It Simple!"), "keep_it_simple")

console.log("growth-ai-copilot-playbooks: ok")
