/**
 * GE-AIOS-INSTITUTIONAL-LEARNING-TRUTHFULNESS-1A — Institutional learning truthfulness certification.
 * Run: pnpm test:ge-aios-institutional-learning-truthfulness-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildOrganizationPreferences } from "../lib/growth/memory/preferences/organization-preferences"
import { buildLearnedInsights } from "../lib/growth/memory/summaries/summarize-memory-period"
import { buildWhatIveLearnedBullets } from "../lib/growth/memory/bridges/narrative-memory"
import { runMemoryEngine } from "../lib/growth/memory/engine/run-memory-engine"
import { GROWTH_MEMORY_ENGINE_QA_MARKER } from "../lib/growth/memory/types"
import {
  buildValidatedInstitutionalLearningBullets,
  containsForbiddenDemoInstitutionalLearning,
  GROWTH_INSTITUTIONAL_LEARNING_EMPTY_MESSAGE,
  GROWTH_INSTITUTIONAL_LEARNING_FORBIDDEN_DEMO_STRINGS,
  GROWTH_INSTITUTIONAL_LEARNING_TRUTHFULNESS_1A_QA_MARKER,
  GROWTH_INSTITUTIONAL_LEARNING_VALIDATED_LABEL,
} from "../lib/growth/memory/institutional-learning/growth-institutional-learning-truthfulness-1a"
import { NARRATIVE_INTELLIGENCE_EMPTY_LEARNED_MESSAGE } from "../lib/growth/ava-home/narrative/engine/growth-home-narrative-intelligence-18f"
import { HOME_LIVING_EMPTY_MEMORY_MESSAGE } from "../lib/growth/home/growth-home-living-experience-18e"
import type { OrganizationalKnowledgeItem } from "../lib/growth/memory/knowledge/organization-knowledge-types"
import type { AvaMemoryEvent } from "../lib/growth/memory/types"

const PHASE = "GE-AIOS-INSTITUTIONAL-LEARNING-TRUTHFULNESS-1A" as const
const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function knowledgeItem(finding: string, overrides: Partial<OrganizationalKnowledgeItem> = {}): OrganizationalKnowledgeItem {
  const now = new Date().toISOString()
  return {
    knowledge_id: `k-${finding.slice(0, 12)}`,
    organization_id: "org-truth-1a",
    source: "memory_events",
    specialist: "sales",
    category: "sales_process",
    finding,
    confidence: 0.86,
    supporting_event_count: 4,
    first_observed_at: now,
    last_confirmed_at: now,
    superseded_by: null,
    active: true,
    metadata: {},
    ...overrides,
  }
}

function emptyMemoryEngineInput() {
  return {
    organizationId: "org-truth-1a",
    generatedAt: "2026-07-15T12:00:00.000Z",
    workspaceSummary: {
      kpis: {
        emailsSentToday: 0,
        repliesToday: 0,
        callsToday: 0,
        openOpportunities: 0,
        hotCompanies: 0,
        approvalQueueCount: 0,
      },
      meetings: { today: 0, thisWeek: 0, scheduled: 0 },
      inbox: { repliesNeedingAttention: 0, threadsOpen: 0, newReplies: 0 },
      operatorTasks: { callTasksDue: 0, pendingApprovals: 0, leadsNeedingAction: 0 },
      avaConsole: {
        greeting: "Good morning.",
        overnightSummary: null,
        highPriorityOpportunities: null,
        waitingForApproval: null,
        suggestedNextAction: "Continue researching medical equipment companies",
        researchLoopSummary: null,
      },
      dashboard: {
        generatedAt: "2026-07-15T12:00:00.000Z",
        briefing: null,
        sections: [],
        operatorActionCards: [],
        dailyRevenueWorkQueueEnabled: false,
        dailyRevenueWorkQueue: null,
        dailyRevenueWorkQueueDisplay: null,
      },
    },
    waitingOnYou: [],
    dailyWorkQueue: [],
    accomplishments: [],
    timeline: [],
  }
}

function main(): void {
  console.log(`[${PHASE}] Institutional learning truthfulness certification`)

  assert.equal(
    GROWTH_INSTITUTIONAL_LEARNING_TRUTHFULNESS_1A_QA_MARKER,
    "ge-aios-institutional-learning-truthfulness-1a-v1",
  )
  assert.equal(GROWTH_INSTITUTIONAL_LEARNING_EMPTY_MESSAGE, "No validated organizational learnings yet.")
  assert.equal(NARRATIVE_INTELLIGENCE_EMPTY_LEARNED_MESSAGE, GROWTH_INSTITUTIONAL_LEARNING_EMPTY_MESSAGE)
  assert.equal(HOME_LIVING_EMPTY_MEMORY_MESSAGE, GROWTH_INSTITUTIONAL_LEARNING_EMPTY_MESSAGE)
  console.log("  ✓ canonical empty copy is consistent across surfaces")

  const preferencesSource = readSource("lib/growth/memory/preferences/organization-preferences.ts")
  assert.doesNotMatch(preferencesSource, /We target hospitals before private clinics/)
  assert.doesNotMatch(preferencesSource, /DEFAULT_PREFERENCES/)
  assert.doesNotMatch(preferencesSource, /Mike prefers shorter outreach/)
  console.log("  ✓ organization preferences have no demo defaults")

  const summarizeSource = readSource("lib/growth/memory/summaries/summarize-memory-period.ts")
  assert.match(summarizeSource, /@fuzor\/memory/)
  assert.doesNotMatch(summarizeSource, /input\.patterns/)
  assert.doesNotMatch(summarizeSource, /input\.preferences/)
  console.log("  ✓ learned insights no longer fall back to patterns or preferences")

  const narrativeBridgeSource = readSource("lib/growth/memory/bridges/narrative-memory.ts")
  assert.match(narrativeBridgeSource, /@fuzor\/memory/)
  assert.doesNotMatch(narrativeBridgeSource, /learned_insights/)
  assert.doesNotMatch(narrativeBridgeSource, /detected_patterns/)
  console.log("  ✓ What I've Learned bullets use validated knowledge only")

  const memoryUi = readSource("components/growth/workspace/executive-briefing/growth-home-ava-memory-section.tsx")
  assert.match(memoryUi, /GROWTH_INSTITUTIONAL_LEARNING_EMPTY_MESSAGE/)
  assert.match(memoryUi, /GROWTH_INSTITUTIONAL_LEARNING_VALIDATED_LABEL/)
  const trainingUi = readSource("components/growth/training/growth-training-learned-section.tsx")
  assert.match(trainingUi, /filterValidatedInstitutionalLearnings/)
  assert.match(trainingUi, /GROWTH_INSTITUTIONAL_LEARNING_EMPTY_MESSAGE/)
  console.log("  ✓ Home and Training surfaces use truthful empty and validated labels")

  for (const demo of GROWTH_INSTITUTIONAL_LEARNING_FORBIDDEN_DEMO_STRINGS) {
    assert.ok(containsForbiddenDemoInstitutionalLearning(demo), `forbidden marker must detect: ${demo}`)
  }

  const emptyMemory = runMemoryEngine(emptyMemoryEngineInput())
  for (const pref of emptyMemory.summary.preferences) {
    assert.ok(!containsForbiddenDemoInstitutionalLearning(pref.statement), `preference must not be demo: ${pref.statement}`)
  }
  for (const insight of emptyMemory.summary.learned_insights) {
    assert.ok(!containsForbiddenDemoInstitutionalLearning(insight), `insight must not be demo: ${insight}`)
  }
  assert.deepEqual(buildWhatIveLearnedBullets(emptyMemory.summary), [])
  console.log("  ✓ empty organizations show no fabricated learnings")

  const legacyFallbackBullets = buildWhatIveLearnedBullets({
    qaMarker: GROWTH_MEMORY_ENGINE_QA_MARKER,
    period_summary: null,
    learned_insights: GROWTH_INSTITUTIONAL_LEARNING_FORBIDDEN_DEMO_STRINGS.slice(),
    organizational_knowledge: [],
    detected_patterns: [{ id: "p1", label: "Research consistently precedes successful outreach.", confidence: 0.9, evidenceCount: 3 }],
    recent_events: [],
    timeline: [],
    important_events: [],
    preferences: [],
    corrections: [],
    unanswered_questions: [],
  })
  assert.deepEqual(legacyFallbackBullets, [])
  console.log("  ✓ legacy learned_insights and pattern fallbacks are not surfaced")

  const validatedFinding = "Operator-confirmed mid-market buyers respond best to ROI-focused messaging."
  const validatedKnowledge = [knowledgeItem(validatedFinding)]
  const validatedBullets = buildValidatedInstitutionalLearningBullets(validatedKnowledge)
  assert.equal(validatedBullets.length, 1)
  assert.match(validatedBullets[0] ?? "", /ROI-focused messaging/)
  assert.deepEqual(
    buildWhatIveLearnedBullets({
      qaMarker: GROWTH_MEMORY_ENGINE_QA_MARKER,
      period_summary: null,
      learned_insights: [],
      organizational_knowledge: validatedKnowledge,
      detected_patterns: [],
      recent_events: [],
      timeline: [],
      important_events: [],
      preferences: [],
      corrections: [],
      unanswered_questions: [],
    }),
    validatedBullets,
  )
  console.log("  ✓ validated organizational knowledge still displays")

  const learnedFromKnowledgeOnly = buildLearnedInsights({
    patterns: [{ label: "Research consistently precedes successful outreach." }],
    preferences: [{ statement: "We target hospitals before private clinics." }],
    events: [] as AvaMemoryEvent[],
    corrections: [{ summary: "Fabricated correction." }],
    organizationalKnowledge: validatedKnowledge,
  })
  assert.equal(learnedFromKnowledgeOnly.length, 1)
  assert.match(learnedFromKnowledgeOnly[0] ?? "", /ROI-focused messaging/)
  console.log("  ✓ memory engine learned_insights ignore non-knowledge fallbacks")

  const prefs = buildOrganizationPreferences({
    generatedAt: "2026-07-15T12:00:00.000Z",
    workspaceSummary: emptyMemoryEngineInput().workspaceSummary,
    narrativeContext: {
      businessUnderstanding: {
        hasApprovedProfile: false,
        profileIncomplete: true,
        pricingUnclear: true,
      },
      metrics: { readyForReview: 0, approvalsWaiting: 0, repliesWaiting: 0 },
      operatorFocus: "setup",
    } as never,
    events: [],
  })
  assert.ok(!prefs.some((row) => containsForbiddenDemoInstitutionalLearning(row.statement)))
  console.log("  ✓ preference builder does not inject demo operating rules")

  assert.equal(GROWTH_INSTITUTIONAL_LEARNING_VALIDATED_LABEL, "Validated learnings")
  console.log("  ✓ validated label is operator-friendly")

  const packageJson = JSON.parse(readSource("package.json")) as { scripts: Record<string, string> }
  assert.match(
    packageJson.scripts["test:ge-aios-institutional-learning-truthfulness-1a"] ?? "",
    /test-ge-aios-institutional-learning-truthfulness-1a/,
  )
  console.log("  ✓ package script registered")

  console.log(`[${PHASE}] PASS — Institutional learning truthfulness certified (local)`)
}

main()
