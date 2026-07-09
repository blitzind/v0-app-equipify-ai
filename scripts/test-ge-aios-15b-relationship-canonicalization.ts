/**
 * GE-AIOS-15B — Relationship Canonicalization certification.
 * Run: pnpm test:ge-aios-15b-relationship-canonicalization
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { runDecisionEngine } from "../lib/growth/decision-engine/engine/run-decision-engine"
import { runWorkManager } from "../lib/growth/work-manager/manager/run-work-manager"
import { orchestrateWorkManagerResult } from "../lib/growth/specialists/engine/run-specialist-orchestrator"
import { buildAvaHomeHero } from "../lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a"
import { buildGrowthHomeLeadPoolSummary } from "../lib/growth/home/growth-home-lead-pool-pagination"
import {
  GROWTH_RELATIONSHIP_GRAPH_QA_MARKER,
  GROWTH_HOME_LEAD_POOL_BATCH_LIMIT,
  GROWTH_RELATIONSHIP_CALL_QUEUE_BATCH_LIMIT,
  GROWTH_RELATIONSHIP_MAX_BATCH_LIMIT,
  attachRelationshipGraphToCandidate,
  buildIntakeRelationshipBindingIntent,
  extractRelationshipGraphFromLeadMetadata,
  hasRelationshipGraphBinding,
  isLegacyBuyingCommitteeWriteQuarantined,
  parseLeadIdFromHref,
  GROWTH_CANONICAL_BUYING_COMMITTEE_TABLES,
  GROWTH_LEGACY_BUYING_COMMITTEE_TABLES,
} from "../lib/growth/relationship"
import type { GrowthHomeAiOsUxViewModel } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import type { GrowthAvaResearchLoopSummary } from "../lib/growth/ava-home/growth-ava-research-orchestrator-types"

const PHASE = "GE-AIOS-15B" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function baseAiOsUx(overrides: Partial<GrowthHomeAiOsUxViewModel> = {}): GrowthHomeAiOsUxViewModel {
  return {
    qaMarker: "growth-ge-aios-ux-1a-ai-os-home-experience-v1",
    hero: {} as never,
    waitingOnYou: [],
    waitingOnYouOverflow: 0,
    approveItemsHref: null,
    approveItemsCount: 0,
    liveStatus: null,
    dailyWorkQueueBuckets: null,
    dailyWorkQueue: [],
    throughput: [],
    mailboxDomainHealth: null,
    autonomousReadiness: null,
    ...overrides,
  }
}

const researchSummary: GrowthAvaResearchLoopSummary = {
  qaMarker: "ge-aios-6b-ava-research-orchestrator-v1",
  runId: "run-15b",
  completedAt: new Date().toISOString(),
  companiesReviewed: 8,
  researchCompleted: 8,
  buyingSignalsVerified: 2,
  readyForOutreachReview: 1,
  qualificationCompleted: 2,
  qualificationSkipped: 0,
  qualificationFailed: 0,
  narrative: "Ava reviewed 8 companies.",
  leadResults: [
    {
      leadId: "11111111-1111-4111-8111-111111111111",
      companyName: "Precision Biomedical",
      outcome: "completed",
      readyForOutreachReview: true,
      hasBuyingSignals: true,
      qualificationStatus: "completed",
    },
  ],
  transportBlocked: true,
  humanApprovalRequired: true,
  outboundOccurred: false,
}

function workspaceSummaryFixture() {
  return {
    kpis: {
      emailsSentToday: 0,
      repliesToday: 1,
      callsToday: 0,
      openOpportunities: 2,
      hotCompanies: 2,
      approvalQueueCount: 1,
    },
    meetings: { today: 0, thisWeek: 1, scheduled: 1 },
    inbox: { repliesNeedingAttention: 0, threadsOpen: 1, newReplies: 1 },
    operatorTasks: { callTasksDue: 0, pendingApprovals: 1, leadsNeedingAction: 3 },
    avaConsole: {
      greeting: "Good morning, Mike.",
      overnightSummary: null,
      highPriorityOpportunities: null,
      waitingForApproval: null,
      suggestedNextAction: "Continue researching companies",
      researchLoopSummary: researchSummary,
    },
    dashboard: {
      generatedAt: new Date().toISOString(),
      briefing: null,
      sections: [],
      operatorActionCards: [],
      dailyRevenueWorkQueueEnabled: false,
      dailyRevenueWorkQueue: null,
      dailyRevenueWorkQueueDisplay: null,
    },
    leadPool: buildGrowthHomeLeadPoolSummary({
      visibleLeads: [{ id: "11111111-1111-4111-8111-111111111111", createdAt: new Date().toISOString() }],
      totalEstimatedCount: 1,
      relationshipSnapshotCount: 0,
      fetchedHasMore: false,
    }),
  }
}

function main(): void {
  console.log(`[${PHASE}] Relationship Canonicalization certification`)

  assert.equal(GROWTH_RELATIONSHIP_GRAPH_QA_MARKER, "ge-aios-15b-relationship-graph-v1")
  assert.ok(GROWTH_HOME_LEAD_POOL_BATCH_LIMIT > 100)
  assert.ok(GROWTH_RELATIONSHIP_CALL_QUEUE_BATCH_LIMIT >= 200)
  assert.ok(GROWTH_RELATIONSHIP_MAX_BATCH_LIMIT >= GROWTH_HOME_LEAD_POOL_BATCH_LIMIT)
  assert.equal(isLegacyBuyingCommitteeWriteQuarantined(), true)

  const leadId = "11111111-1111-4111-8111-111111111111"
  assert.equal(parseLeadIdFromHref(`/growth/leads/${leadId}`), leadId)

  const intake = buildIntakeRelationshipBindingIntent("datamoon")
  assert.equal(intake.use_legacy_buying_committee_writes, false)
  assert.ok(intake.bind_canonical_company)
  assert.ok(intake.fields_to_persist.includes("buying_committee_intelligence_members"))

  const graphFromMetadata = extractRelationshipGraphFromLeadMetadata({
    lead_id: leadId,
    metadata: { canonical_company_id: "22222222-2222-4222-8222-222222222222" },
    relationship_stage: "engaged",
  })
  assert.ok(hasRelationshipGraphBinding(graphFromMetadata))
  assert.equal(graphFromMetadata.lead_id, leadId)

  const candidate = attachRelationshipGraphToCandidate({
    id: `research:${leadId}`,
    kind: "prepare_outreach",
    title: "Prepare outreach — Precision Biomedical",
    detail: null,
    href: `/growth/leads/${leadId}`,
    companyName: "Precision Biomedical",
    source: "research_loop",
    readyForOutreach: true,
  })
  assert.equal(candidate.relationship_graph?.lead_id, leadId)
  assert.equal(candidate.relationship_graph?.relationship_stage, "evaluating")

  const decisionInput = {
    workspaceSummary: workspaceSummaryFixture(),
    waitingOnYou: [
      {
        id: "w1",
        label: "Approve outreach draft",
        detail: "Ready",
        href: `/growth/leads/${leadId}`,
      },
    ],
    dailyWorkQueue: [],
    accomplishments: [],
    timeline: [],
    generatedAt: new Date().toISOString(),
  }

  const decisionResult = runDecisionEngine(decisionInput)
  const workResult = runWorkManager({ ...decisionInput, memorySummary: null })
  const { specialistResult } = orchestrateWorkManagerResult(workResult)

  const salesItems = specialistResult.routed_work_items.filter((row) => row.assigned_specialist === "sales")
  assert.ok(salesItems.length >= 1)
  const withGraph = salesItems.filter((row) => hasRelationshipGraphBinding(row.relationship_graph))
  assert.ok(withGraph.length >= 1, "Sales work items should carry relationship graph when lead href present")

  const hero = buildAvaHomeHero({
    greeting: "Good morning, Mike.",
    hour: 9,
    employeeStatus: { kind: "working", label: "Working", activityLabel: "working" },
    aiOsUx: baseAiOsUx({ waitingOnYou: decisionInput.waitingOnYou, approveItemsCount: 1 }),
    researchLoopSummary: researchSummary,
    accomplishments: [],
    repliesWaiting: 0,
    workspaceSummary: workspaceSummaryFixture(),
    waitingOnYou: decisionInput.waitingOnYou,
    dailyWorkQueue: [],
    timeline: [],
  })
  assert.ok(hero.workManager)
  assert.ok(hero.specialistOrchestrator)

  const homeSource = readSource("lib/growth/home/growth-home-workspace-summary-service.ts")
  assert.match(homeSource, /GROWTH_HOME_LEAD_POOL_BATCH_LIMIT/)
  assert.doesNotMatch(homeSource, /HOME_LEAD_POOL_LIMIT\s*=\s*100/)

  const callQueueSource = readSource("lib/growth/call-queue-repository.ts")
  assert.match(callQueueSource, /GROWTH_RELATIONSHIP_CALL_QUEUE_BATCH_LIMIT/)

  const contactRepo = readSource("lib/growth/contact-discovery/contact-repository.ts")
  assert.match(contactRepo, /isLegacyBuyingCommitteeWriteQuarantined/)
  assert.match(contactRepo, /buying_committee_intelligence_members/)

  const revenueIntel = readSource("lib/growth/revenue-intelligence/process-revenue-intelligence.ts")
  assert.match(revenueIntel, /isLegacyBuyingCommitteeWriteQuarantined/)

  const salesSpecialist = readSource("lib/growth/specialists/specialists/sales-specialist.ts")
  assert.match(salesSpecialist, /relationship_graph/)
  assert.match(salesSpecialist, /buildSalesSpecialistRelationshipSuffix/)

  const workManagerBridge = readSource("lib/growth/work-manager/bridges/decision-engine-bridge.ts")
  assert.match(workManagerBridge, /relationship_graph/)

  assert.ok(GROWTH_CANONICAL_BUYING_COMMITTEE_TABLES.includes("buying_committee_intelligence_members"))
  assert.ok(GROWTH_LEGACY_BUYING_COMMITTEE_TABLES.includes("buying_committee_members"))

  const migrationDir = path.join(process.cwd(), "supabase/migrations")
  const newRelationshipMigrations = fs
    .readdirSync(migrationDir)
    .filter((name) => name.includes("15b") || name.includes("relationship_graph"))
  assert.equal(newRelationshipMigrations.length, 0, "15B must not add schema migrations")

  const engineSource = readSource("lib/growth/decision-engine/engine/run-decision-engine.ts")
  assert.doesNotMatch(engineSource, /executeReadyWorkItems|sendEmail|outbound/)
  assert.doesNotMatch(readSource("lib/growth/relationship/index.ts"), /fetch\(/)

  console.log(`[${PHASE}] PASS — Relationship Canonicalization certified (local)`)
}

main()
