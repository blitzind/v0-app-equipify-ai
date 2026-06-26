/**
 * GE-AIOS-2J — Context Assembly foundation certification.
 * Run: pnpm test:ge-aios-2j-context-assembly-foundation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  assembleAiContextPackageContent,
  buildAiContextWorkOrderSection,
} from "../lib/growth/aios/ai-context-assembly-collector"
import { computeAiContextPackageChecksum, verifyAiContextPackageChecksum } from "../lib/growth/aios/ai-context-assembly-checksum"
import { aiContextAssemblySchemaCatalog } from "../lib/growth/aios/ai-context-assembly-repository"
import {
  AI_CONTEXT_ASSEMBLY_SOURCES,
  aiContextAssemblySourceCatalog,
} from "../lib/growth/aios/ai-context-assembly-source-registry"
import {
  AI_CONTEXT_ASSEMBLY_RUNTIME_RULE,
  AI_CONTEXT_PACKAGE_SCHEMA_VERSION,
  GROWTH_AIOS_2J_PHASE,
  GROWTH_AI_CONTEXT_ASSEMBLY_QA_MARKER,
  GROWTH_AI_CONTEXT_ASSEMBLY_SCHEMA_MIGRATION,
} from "../lib/growth/aios/ai-context-assembly-types"
import { validateAiContextPackageContent } from "../lib/growth/aios/ai-context-assembly-validator"
import { lookupAiEventRegistryEntry } from "../lib/growth/aios/ai-event-registry"
import type { AiWorkOrder } from "../lib/growth/aios/ai-work-order-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoCoreTouch(relativePath: string, forbidden: string[]): void {
  const source = readSource(relativePath)
  for (const token of forbidden) {
    assert.equal(source.includes(token), false, `${relativePath} must not reference ${token}`)
  }
}

function sampleWorkOrder(overrides: Partial<AiWorkOrder> = {}): AiWorkOrder {
  return {
    id: "wo-1",
    organizationId: "org-1",
    missionId: "mission-1",
    ownerAgent: "research",
    assignedAgent: "research",
    workOrderType: "research_company",
    entityType: "lead",
    entityId: "lead-1",
    priority: 500,
    status: "awaiting_decision",
    decisionRecordIds: ["dr-1"],
    memoryRefs: [{ memoryType: "lead", memoryId: "mem-1" }],
    payload: { company: "Acme Corp", domain: "acme.example" },
    dependsOn: [],
    retryCount: 0,
    maxRetries: 3,
    timeoutAt: null,
    executionWindowStart: null,
    executionWindowEnd: null,
    approvalId: null,
    checkpoint: null,
    requestedBy: null,
    result: null,
    failureReason: null,
    auditMetadata: {},
    issuedAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    archivedAt: null,
    qaMarker: "growth-aios-2a-ai-work-order-v1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

console.log(`[${GROWTH_AIOS_2J_PHASE}] Context Assembly foundation certification`)

assert.equal(GROWTH_AI_CONTEXT_ASSEMBLY_QA_MARKER, "growth-aios-2j-context-assembly-v1")
assert.equal(GROWTH_AI_CONTEXT_ASSEMBLY_SCHEMA_MIGRATION, "20271001190000_growth_aios_2j_context_assembly.sql")
assert.equal(AI_CONTEXT_PACKAGE_SCHEMA_VERSION, "1.0")
assert.equal(AI_CONTEXT_ASSEMBLY_SOURCES.length, 6)
assert.ok(aiContextAssemblySourceCatalog().count >= 6)

const workOrder = sampleWorkOrder()
const section = buildAiContextWorkOrderSection(workOrder)
assert.equal(section.workOrderId, "wo-1")
assert.equal(section.memoryRefIds.length, 1)

const content = assembleAiContextPackageContent({
  contextVersion: AI_CONTEXT_PACKAGE_SCHEMA_VERSION,
  workOrder,
  missionContext: {
    missionId: "mission-1",
    title: "Book demos",
    objectiveType: "demos_booked",
    status: "active",
    currentValue: 2,
    targetValue: 10,
    autonomyLevel: "objective",
    safetyMode: "strict",
    currentStageId: "discover",
    sourceTable: "growth.organization_growth_objectives",
  },
  decisionRecords: [],
  memoryEntries: [],
  relatedEvents: [],
  entityMetadata: null,
  sourceKeys: ["work_order", "mission"],
})

const checksum = computeAiContextPackageChecksum(content)
assert.ok(checksum.length === 64)
assert.equal(verifyAiContextPackageChecksum(content, checksum), true)
assert.equal(validateAiContextPackageContent(content, checksum).valid, true)

const migration = readSource(`supabase/migrations/${GROWTH_AI_CONTEXT_ASSEMBLY_SCHEMA_MIGRATION}`)
assert.ok(migration.includes("ai_context_assembly_runtime"))
assert.ok(migration.includes("ai_context_packages"))
assert.equal(migration.includes("openai"), false)

const serviceSource = readSource("lib/growth/aios/ai-context-assembly-service.ts")
for (const pattern of [
  "openai",
  "anthropic",
  "runAiTask",
  "claimAiOsWorkOrder",
  "createAiDecisionRecord",
  "transitionAiWorkOrder",
  "delegateAiExecutiveWorkOrder",
  "apollo",
  "pdl",
]) {
  assert.equal(serviceSource.toLowerCase().includes(pattern.toLowerCase()), false, `service must not reference ${pattern}`)
}
assert.ok(serviceSource.includes("assembleAiContextForWorkOrder"))
assert.ok(serviceSource.includes("context.assembled"))
assert.ok(serviceSource.includes("context.reused"))
assert.ok(serviceSource.includes("context.validation_failed"))
assert.ok(serviceSource.includes("getGrowthObjective"))
assert.ok(serviceSource.includes("buildLeadMemoryInfluenceContext") === false)
assert.ok(serviceSource.includes("resolveAiContextEntityMetadata"))

const resolverSource = readSource("lib/growth/aios/ai-context-assembly-resolver.ts")
assert.ok(resolverSource.includes("buildLeadMemoryInfluenceContext"))

const assemblyFiles = [
  "lib/growth/aios/ai-context-assembly-types.ts",
  "lib/growth/aios/ai-context-assembly-source-registry.ts",
  "lib/growth/aios/ai-context-assembly-checksum.ts",
  "lib/growth/aios/ai-context-assembly-validator.ts",
  "lib/growth/aios/ai-context-assembly-collector.ts",
  "lib/growth/aios/ai-context-assembly-resolver.ts",
  "lib/growth/aios/ai-context-assembly-repository.ts",
  "lib/growth/aios/ai-context-assembly-service.ts",
  "lib/growth/aios/ai-context-assembly-schema-health.ts",
  "lib/growth/aios/ai-context-assembly-health.ts",
]
for (const file of assemblyFiles) {
  assertNoCoreTouch(file, ["public.invoices", "public.quotes", "blitzpay"])
}

assert.ok(AI_CONTEXT_ASSEMBLY_RUNTIME_RULE.includes("does not invoke LLMs"))
assert.ok(lookupAiEventRegistryEntry("context.assembled"))
assert.ok(lookupAiEventRegistryEntry("context.validation_failed"))
assert.ok(lookupAiEventRegistryEntry("context.reused"))
assert.equal(aiContextAssemblySchemaCatalog().qaMarker, GROWTH_AI_CONTEXT_ASSEMBLY_QA_MARKER)

console.log(`[${GROWTH_AIOS_2J_PHASE}] PASS — Context Assembly foundation certified (local)`)
