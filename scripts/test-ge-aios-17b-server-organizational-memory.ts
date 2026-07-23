/**
 * GE-AIOS-17B — Server-side organizational memory certification.
 * Run: pnpm test:ge-aios-17b-server-organizational-memory
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildAvaDailyBriefing } from "../lib/growth/ava-home/narrative/engine/build-ava-daily-briefing"
import { runMemoryEngine } from "../lib/growth/memory/engine/run-memory-engine"
import {
  GROWTH_ORGANIZATION_MEMORY_EVENTS_TABLE,
  GROWTH_SERVER_ORG_MEMORY_QA_MARKER,
  emptyOrganizationMemoryStore,
} from "../lib/growth/memory/storage/organization-memory-types"
import {
  mergeOrganizationalMemoryStore,
  resolvePersistedOrganizationalMemoryStore,
} from "../lib/growth/memory/storage/organization-memory-store"
import { SALES_SPECIALIST_MEMORY_SOURCE } from "../lib/growth/specialists/execution/sales-specialist-memory-bridge"
import {
  finalizeSalesSpecialistOutcomes,
} from "../lib/growth/specialists/execution/sales-specialist-execution-bridge"
import { mapResearchLoopLeadToSalesOutcomes } from "../lib/growth/specialists/execution/sales-outcome-mappers"

const PHASE = "GE-AIOS-17B" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function buildValidatedOutcomes(generatedAt: string) {
  return finalizeSalesSpecialistOutcomes({
    organizationId: "org-17b",
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
}

function main(): void {
  console.log(`[${PHASE}] Server-side organizational memory certification`)

  const migrationPath = path.join(
    process.cwd(),
    "supabase/migrations/20270830140000_ge_aios_17b_server_organizational_memory.sql",
  )
  assert.ok(fs.existsSync(migrationPath), "17B migration must exist")
  const migration = fs.readFileSync(migrationPath, "utf8")
  assert.match(migration, new RegExp(GROWTH_ORGANIZATION_MEMORY_EVENTS_TABLE))
  assert.match(migration, /organization_memory_preferences/)
  assert.match(migration, /service_role/)

  const repositoryFiles = [
    "lib/growth/memory/storage/organization-memory-repository.ts",
    "lib/growth/memory/storage/organization-memory-types.ts",
    "lib/growth/memory/storage/organization-memory-schema-health.ts",
  ]
  for (const file of repositoryFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
  }

  const workspaceSummary = readSource("lib/growth/home/growth-home-workspace-summary-service.ts")
  assert.match(workspaceSummary, /fetchOrganizationMemoryStore/)
  assert.match(workspaceSummary, /organizationalMemory/)
  assert.doesNotMatch(workspaceSummary, /fetchAidenDailyBriefing/)

  const dashboard = readSource(
    "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
  )
  assert.match(dashboard, /resolvePersistedOrganizationalMemoryStore/)
  assert.match(dashboard, /organizationalMemory/)

  const repositorySource = readSource("lib/growth/memory/storage/organization-memory-repository.ts")
  assert.match(repositorySource, /@fuzor\/memory/)
  assert.match(repositorySource, /persistValidatedSalesOutcomeMemoryEvents/)
  assert.doesNotMatch(repositorySource, /growth\.workflow\.status_changed/)

  const generatedAt = "2026-07-08T18:00:00.000Z"
  const outcomes = buildValidatedOutcomes(generatedAt)
  const memoryEvents = outcomes.flatMap((row) => row.memory_events)
  assert.ok(memoryEvents.every((row) => row.source === SALES_SPECIALIST_MEMORY_SOURCE))

  const serverStore = emptyOrganizationMemoryStore({ organizationId: "org-17b", generatedAt })
  serverStore.events = memoryEvents

  const localStore = emptyOrganizationMemoryStore({ organizationId: "org-17b", generatedAt })
  localStore.events = [
    {
      id: "local-only:event",
      category: "learning",
      timestamp: generatedAt,
      importance: 2,
      organizationId: "org-17b",
      entityType: "organization",
      entityId: "local",
      source: "preference",
      summary: "Local-only preference.",
      metadata: {},
    },
  ]

  const resolved = resolvePersistedOrganizationalMemoryStore({
    organizationId: "org-17b",
    serverMemory: {
      qaMarker: GROWTH_SERVER_ORG_MEMORY_QA_MARKER,
      store: serverStore,
      source: "server",
      degraded: false,
      warning: null,
    },
  })
  assert.ok(resolved)
  assert.ok(resolved!.events.some((row) => row.source === SALES_SPECIALIST_MEMORY_SOURCE))

  const localFallback = mergeOrganizationalMemoryStore(
    localStore,
    emptyOrganizationMemoryStore({ organizationId: "org-17b", generatedAt }),
  )
  assert.ok(localFallback.events.some((row) => row.id === "local-only:event"))

  const merged = mergeOrganizationalMemoryStore(serverStore, {
    ...serverStore,
    events: [...serverStore.events, ...memoryEvents],
  })
  assert.equal(merged.events.length, memoryEvents.length, "Duplicate events must dedupe")

  const memory = runMemoryEngine({
    organizationId: "org-17b",
    generatedAt,
    workspaceSummary: {
      kpis: {
        emailsSentToday: 0,
        repliesToday: 0,
        callsToday: 0,
        openOpportunities: 0,
        hotCompanies: 0,
        approvalQueueCount: 2,
      },
      meetings: { today: 0, thisWeek: 0, scheduled: 0 },
      inbox: { repliesNeedingAttention: 0, threadsOpen: 0, newReplies: 0 },
      operatorTasks: { callTasksDue: 0, pendingApprovals: 2, leadsNeedingAction: 0 },
      avaConsole: {
        greeting: "Good evening",
        overnightSummary: null,
        highPriorityOpportunities: null,
        waitingForApproval: null,
        suggestedNextAction: null,
        researchLoopSummary: null,
      },
      dashboard: { qaMarker: "growth-workspace-dashboard-v1", generatedAt, sections: [] },
    },
    waitingOnYou: [],
    dailyWorkQueue: [],
    accomplishments: [],
    timeline: [],
    persistedStore: serverStore,
    salesOutcomes: outcomes,
    salesDailySummary: {
      qaMarker: "ge-aios-17a-specialist-execution-bridge-v1",
      generatedAt,
      researched: 1,
      qualified: 1,
      strong_opportunities: 1,
      outreach_prepared: 0,
      meetings_prepared: 0,
      approvals_pending: 2,
    },
  })

  assert.ok(
    memory.summary.period_summary?.includes("researched"),
    "Narrative-ready period summary must come from durable memory events",
  )

  const briefing = buildAvaDailyBriefing({
    greeting: "Good evening, Mike.",
    hour: 18,
    workspaceSummary: {
      kpis: {
        emailsSentToday: 0,
        repliesToday: 0,
        callsToday: 0,
        openOpportunities: 11,
        hotCompanies: 3,
        approvalQueueCount: 2,
      },
      meetings: { today: 0, thisWeek: 0, scheduled: 0 },
      inbox: { repliesNeedingAttention: 0, threadsOpen: 0, newReplies: 0 },
      operatorTasks: { callTasksDue: 0, pendingApprovals: 2, leadsNeedingAction: 0 },
      avaConsole: {
        greeting: "Good evening",
        overnightSummary: null,
        highPriorityOpportunities: null,
        waitingForApproval: null,
        suggestedNextAction: null,
        researchLoopSummary: null,
      },
      dashboard: { qaMarker: "growth-workspace-dashboard-v1", generatedAt, sections: [] },
    },
    accomplishments: [],
    waitingOnYou: [],
    dailyWorkQueue: [],
    timeline: [],
    generatedAt,
    persistedMemoryStore: serverStore,
    salesOutcomes: {
      qaMarker: "ge-aios-17a-specialist-execution-bridge-v1",
      outcomes,
      dailySummary: {
        qaMarker: "ge-aios-17a-specialist-execution-bridge-v1",
        generatedAt,
        researched: 1,
        qualified: 1,
        strong_opportunities: 1,
        outreach_prepared: 0,
        meetings_prepared: 0,
        approvals_pending: 2,
      },
    },
  })

  assert.ok(
    briefing.summary.includes("researched") || briefing.story_blocks.some((row) => /researched/i.test(row.text)),
    "Narrative must prioritize durable completed-work memory",
  )

  console.log("  ✓ Server memory schema + repository present")
  console.log("  ✓ Workspace-summary hydrates organizationalMemory")
  console.log("  ✓ Server memory canonical; local fallback only")
  console.log("  ✓ Duplicate events deduped")
  console.log(`[${PHASE}] All checks passed`)
}

main()
