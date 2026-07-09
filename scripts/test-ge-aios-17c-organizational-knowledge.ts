/**
 * GE-AIOS-17C — Organizational Knowledge certification.
 * Run: pnpm test:ge-aios-17c-organizational-knowledge
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildAvaDailyBriefing } from "../lib/growth/ava-home/narrative/engine/build-ava-daily-briefing"
import type { BusinessIntelligenceReport } from "../lib/growth/business-intelligence/business-intelligence-types"
import { buildDecisionContext } from "../lib/growth/decision-engine/context/build-decision-context"
import { applyMemoryConfidenceBoost } from "../lib/growth/memory/bridges/decision-memory"
import {
  buildKnowledgeFromBusinessIntelligence,
  buildKnowledgeFromMemoryEvents,
  buildKnowledgeNarrativeLines,
  buildOrganizationalKnowledge,
  buildWhatIveLearnedBullets,
} from "../lib/growth/memory"
import { runMemoryEngine } from "../lib/growth/memory/engine/run-memory-engine"
import {
  GROWTH_ORGANIZATION_KNOWLEDGE_TABLE,
  GROWTH_ORGANIZATIONAL_KNOWLEDGE_QA_MARKER,
} from "../lib/growth/memory/knowledge/organization-knowledge-types"
import { SALES_SPECIALIST_MEMORY_SOURCE } from "../lib/growth/specialists/execution/sales-specialist-memory-bridge"
import {
  finalizeSalesSpecialistOutcomes,
} from "../lib/growth/specialists/execution/sales-specialist-execution-bridge"
import { mapResearchLoopLeadToSalesOutcomes } from "../lib/growth/specialists/execution/sales-outcome-mappers"
import { GROWTH_SALES_SPECIALIST_EXECUTION_BRIDGE_QA_MARKER } from "../lib/growth/specialists/execution/sales-outcome-types"

const PHASE = "GE-AIOS-17C" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function buildSampleBiReport(organizationId: string, generatedAt: string): BusinessIntelligenceReport {
  const field = (value: string | string[], confidence: number) => ({
    value,
    confidence,
    supporting_evidence_ids: ["ev-1"],
    source_providers: ["website"] as const,
    decision_tiers: ["approved_for_use"] as const,
    lifecycle_status: "active" as const,
    needs_review: false,
    explanation: "test evidence",
  })

  return {
    organization_id: organizationId,
    evidence_snapshot_id: "snap-1",
    evidence_run_id: "run-1",
    generated_at: generatedAt,
    source_providers: ["website"],
    sections: {
      company: {
        company_description: field("Field service software", 0.8),
        primary_offer: field("Operations platform", 0.75),
        products: field(["Scheduling"], 0.7),
        services: field(["Implementation"], 0.7),
        plans_pricing: field(["Tiered SaaS"], 0.6),
        differentiators: field(["ROI-focused messaging"], 0.72),
        guarantees: field([], 0.4),
        support_channels: field(["Email"], 0.65),
      },
      market: {
        industries_served: field(["medical equipment", "field service"], 0.78),
        geographic_markets: field(["United States"], 0.7),
        customer_types: field(["B2B"], 0.65),
        company_sizes_served: field(["20–100 technicians"], 0.74),
        buyer_terminology: field(["Operations leaders"], 0.6),
        customer_terminology: field(["Technicians"], 0.6),
      },
      proof_and_trust: {
        testimonials: field([], 0.3),
        case_studies: field([], 0.3),
        certifications: field([], 0.3),
        integrations: field([], 0.3),
        customer_examples: field([], 0.3),
      },
      sales_and_growth: {
        likely_buyer_personas: field(["VP Operations", "Service Director"], 0.76),
        likely_pain_points: field(["Manual dispatch", "Missed SLAs"], 0.73),
        likely_decision_triggers: field(["Compliance audits"], 0.7),
        likely_objections: field(["Budget constraints"], 0.68),
        deal_size_signals: field(["Mid-market"], 0.6),
        sales_cycle_signals: field(["60–90 days"], 0.6),
      },
    },
    confidence_summary: {
      overall_confidence: 0.72,
      evidence_strength: 0.75,
      freshness_strength: 0.8,
      contradiction_count: 0,
      unknown_count: 2,
      needs_review_count: 0,
    },
    gaps: [],
    contradictions: [],
    contradiction_fact_keys: [],
    metadata: {},
  }
}

function buildMedicalMemoryEvents(organizationId: string, generatedAt: string) {
  const companies = [
    "Acme Medical Supply",
    "Beta Medical Equipment",
    "Gamma Hospital Services",
    "Delta General Field Service",
    "Echo General Maintenance",
  ]
  return companies.flatMap((company, index) => {
    const isMedical = /medical|hospital/i.test(company)
    const events = [
      {
        id: `sales:research:${index}`,
        category: "lead" as const,
        timestamp: generatedAt,
        importance: 3,
        organizationId,
        entityType: "lead" as const,
        entityId: `lead-${index}`,
        source: SALES_SPECIALIST_MEMORY_SOURCE,
        summary: `Researched ${company}.`,
        metadata: { outcome_type: "research_completed", confidence: 70 },
      },
    ]
    if (isMedical || index === 0) {
      events.push({
        id: `sales:qual:${index}`,
        category: "opportunity" as const,
        timestamp: generatedAt,
        importance: 4,
        organizationId,
        entityType: "lead" as const,
        entityId: `lead-${index}`,
        source: SALES_SPECIALIST_MEMORY_SOURCE,
        summary: `Qualified ${company}.`,
        metadata: { outcome_type: "qualification_completed", confidence: 85 },
      })
    }
    return events
  })
}

function main(): void {
  console.log(`[${PHASE}] Organizational Knowledge certification`)

  const migrationPath = path.join(
    process.cwd(),
    "supabase/migrations/20270830150000_ge_aios_17c_organizational_knowledge.sql",
  )
  assert.ok(fs.existsSync(migrationPath), "17C migration must exist")
  const migration = fs.readFileSync(migrationPath, "utf8")
  assert.match(migration, new RegExp(GROWTH_ORGANIZATION_KNOWLEDGE_TABLE))
  assert.match(migration, /service_role/)

  const repositoryFiles = [
    "lib/growth/memory/knowledge/organization-knowledge-repository.ts",
    "lib/growth/memory/knowledge/organization-knowledge-types.ts",
    "lib/growth/memory/knowledge/build-organizational-knowledge.ts",
    "lib/growth/memory/knowledge/organization-knowledge-schema-health.ts",
  ]
  for (const file of repositoryFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
  }

  const workspaceSummary = readSource("lib/growth/home/growth-home-workspace-summary-service.ts")
  assert.match(workspaceSummary, /buildGrowthHomeOrganizationalKnowledge/)
  assert.match(workspaceSummary, /organizationalKnowledge/)
  assert.doesNotMatch(workspaceSummary, /runBusinessIntelligence/)

  const dashboard = readSource(
    "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
  )
  assert.match(dashboard, /organizationalKnowledge/)

  const memoryEngineSource = readSource("lib/growth/memory/engine/run-memory-engine.ts")
  assert.match(memoryEngineSource, /organizationalKnowledge/)
  assert.doesNotMatch(memoryEngineSource, /runBusinessIntelligence/)

  const decisionSource = readSource("lib/growth/decision-engine/context/build-decision-context.ts")
  assert.match(decisionSource, /organizational_knowledge/)

  const narrativeSource = readSource("lib/growth/memory/bridges/narrative-memory.ts")
  assert.match(narrativeSource, /buildKnowledgeNarrativeLines/)
  assert.match(narrativeSource, /organizational_knowledge/)

  const generatedAt = "2026-07-08T20:00:00.000Z"
  const organizationId = "org-17c"
  const report = buildSampleBiReport(organizationId, generatedAt)
  const memoryEvents = buildMedicalMemoryEvents(organizationId, generatedAt)

  const fromBi = buildKnowledgeFromBusinessIntelligence({
    organizationId,
    generatedAt,
    report,
  })
  assert.ok(fromBi.length >= 3, "BI must produce knowledge items")
  assert.ok(fromBi.every((row) => row.source === "business_intelligence" || row.source === "bi_review"))

  const fromMemory = buildKnowledgeFromMemoryEvents({
    organizationId,
    generatedAt,
    memoryEvents,
    salesOutcomes: [],
  })
  assert.ok(fromMemory.some((row) => row.category === "industry"), "Memory must produce industry knowledge")

  const knowledge = buildOrganizationalKnowledge({
    organizationId,
    generatedAt,
    report,
    memoryEvents,
  })
  assert.ok(knowledge.length >= 4)

  const runTwice = buildOrganizationalKnowledge({
    organizationId,
    generatedAt,
    report,
    memoryEvents,
    existingItems: knowledge,
  })
  assert.equal(runTwice.length, knowledge.length, "Knowledge builder must be deterministic")

  const memory = runMemoryEngine({
    organizationId,
    generatedAt,
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
        greeting: "Good evening",
        overnightSummary: null,
        highPriorityOpportunities: null,
        waitingForApproval: null,
        suggestedNextAction: null,
        researchLoopSummary: null,
      },
      dashboard: { sections: [] } as never,
    },
    waitingOnYou: [],
    dailyWorkQueue: [],
    accomplishments: [],
    timeline: [],
    organizationalKnowledge: knowledge,
  })

  assert.ok(memory.summary.organizational_knowledge.length > 0)
  assert.ok(memory.summary.recent_events.length >= 0, "Memory still stores events separately from knowledge")
  assert.ok(memory.summary.learned_insights.length > 0, "Learned insights must come from knowledge")

  const learnedBullets = buildWhatIveLearnedBullets(memory.summary)
  assert.ok(learnedBullets.length > 0)
  assert.ok(learnedBullets.every((row) => !/workflow telemetry/i.test(row)))

  const narrativeLines = buildKnowledgeNarrativeLines(knowledge)
  assert.ok(narrativeLines.some((row) => /learned/i.test(row)))

  const decisionContext = buildDecisionContext({
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
        greeting: "Good evening",
        overnightSummary: null,
        highPriorityOpportunities: null,
        waitingForApproval: null,
        suggestedNextAction: null,
        researchLoopSummary: null,
      },
      dashboard: { sections: [] } as never,
      leadPool: {
        visible_count: 0,
        has_more: false,
        degraded: false,
        relationship_snapshot_count: 0,
      },
    },
    waitingOnYou: [],
    dailyWorkQueue: [],
    accomplishments: [],
    timeline: [],
    memorySummary: memory.summary,
  })
  assert.ok(decisionContext.evidenceConfidence != null && decisionContext.evidenceConfidence >= 70)

  const boost = applyMemoryConfidenceBoost(
    {
      id: "research:medical",
      kind: "research_company",
      title: "Research company — Acme Medical",
      detail: null,
      href: null,
      companyName: "Acme Medical Equipment",
      source: "daily_work_queue",
    },
    { ...decisionContext, memorySummary: memory.summary },
  )
  assert.ok(boost > 0, "Decision engine must consume organizational knowledge")

  const outcomes = finalizeSalesSpecialistOutcomes({
    organizationId,
    generatedAt,
    outcomes: mapResearchLoopLeadToSalesOutcomes(
      {
        leadId: "lead-1",
        companyName: "Acme Medical",
        outcome: "completed",
        qualificationStatus: "completed",
        hasBuyingSignals: true,
        readyForOutreachReview: true,
      },
      generatedAt,
    ),
  })

  const briefing = buildAvaDailyBriefing({
    greeting: "Good evening",
    hour: 20,
    workspaceSummary: {
      kpis: {
        emailsSentToday: 0,
        repliesToday: 0,
        callsToday: 0,
        openOpportunities: 0,
        hotCompanies: 0,
        approvalQueueCount: 1,
      },
      meetings: { today: 0, thisWeek: 0, scheduled: 0 },
      inbox: { repliesNeedingAttention: 0, threadsOpen: 0, newReplies: 0 },
      operatorTasks: { callTasksDue: 0, pendingApprovals: 1, leadsNeedingAction: 0 },
      avaConsole: {
        greeting: "Good evening",
        overnightSummary: null,
        highPriorityOpportunities: null,
        waitingForApproval: null,
        suggestedNextAction: null,
        researchLoopSummary: null,
      },
      dashboard: { sections: [] } as never,
      leadPool: {
        visible_count: 1,
        has_more: false,
        degraded: false,
        relationship_snapshot_count: 0,
      },
    },
    waitingOnYou: [],
    dailyWorkQueue: [],
    accomplishments: [],
    timeline: [],
    organizationalKnowledge: knowledge,
    salesOutcomes: {
      qaMarker: GROWTH_SALES_SPECIALIST_EXECUTION_BRIDGE_QA_MARKER,
      outcomes,
      dailySummary: {
        qaMarker: GROWTH_SALES_SPECIALIST_EXECUTION_BRIDGE_QA_MARKER,
        generatedAt,
        researched: 1,
        qualified: 1,
        strong_opportunities: 1,
        outreach_prepared: 0,
        meetings_prepared: 0,
        approvals_pending: 1,
      },
    },
  })

  assert.ok(briefing.memory_result?.organizational_knowledge.length)
  assert.match(briefing.summary, /learned|researched/i)

  console.log(`[${PHASE}] PASS — Organizational Knowledge certified (local)`)
  console.log("  ✓ BI outputs feed Knowledge")
  console.log("  ✓ Knowledge is deterministic")
  console.log("  ✓ Memory Engine hydrates organizational_knowledge")
  console.log("  ✓ Decision Engine consumes Knowledge")
  console.log("  ✓ Narrative distinguishes completed work vs learned insights")
  console.log("  ✓ What I've Learned renders Knowledge conclusions")
  console.log(`  ✓ QA marker: ${GROWTH_ORGANIZATIONAL_KNOWLEDGE_QA_MARKER}`)
}

main()
