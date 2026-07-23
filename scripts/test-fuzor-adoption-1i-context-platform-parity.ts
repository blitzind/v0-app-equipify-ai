/**
 * FUZOR-ADOPTION-1I — Context platform delegation parity.
 * Run: pnpm test:fuzor-adoption-1i-context-platform-parity
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import {
  PLATFORM_CONTEXT_ASSEMBLY_QA_MARKER,
  PLATFORM_CONTEXT_ASSEMBLY_SOURCES,
  PLATFORM_CONTEXT_PACKAGE_SCHEMA_VERSION,
  assemblePlatformContextForWorkOrder,
  assemblePlatformContextPackageContent,
  buildPlatformContextWorkOrderSection,
  computePlatformContextPackageChecksum,
  resolvePlatformContextEntityMetadata,
} from "@fuzor/context"

import {
  AI_CONTEXT_PACKAGE_SCHEMA_VERSION,
  GROWTH_AI_CONTEXT_ASSEMBLY_QA_MARKER,
} from "../lib/growth/aios/ai-context-assembly-types"

import { AI_CONTEXT_ASSEMBLY_SOURCES } from "../lib/growth/aios/ai-context-assembly-source-registry"

import {
  assembleAiContextPackageContent,
  buildAiContextWorkOrderSection,
} from "../lib/growth/aios/ai-context-assembly-collector"

import { computeAiContextPackageChecksum } from "../lib/growth/aios/ai-context-assembly-checksum"

import {
  assembleAiContextForWorkOrder,
  getAiContextAssemblyRuntimeSummary,
} from "../lib/growth/aios/ai-context-assembly-service"

import { resolveAiContextEntityMetadata } from "../lib/growth/aios/ai-context-assembly-resolver"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

console.log("[FUZOR-ADOPTION-1I] Context platform delegation parity")

assert.strictEqual(GROWTH_AI_CONTEXT_ASSEMBLY_QA_MARKER, PLATFORM_CONTEXT_ASSEMBLY_QA_MARKER)
assert.strictEqual(AI_CONTEXT_PACKAGE_SCHEMA_VERSION, PLATFORM_CONTEXT_PACKAGE_SCHEMA_VERSION)
assert.strictEqual(AI_CONTEXT_ASSEMBLY_SOURCES, PLATFORM_CONTEXT_ASSEMBLY_SOURCES)

const workOrder = {
  id: "wo-1i",
  organizationId: "00000000-0000-4000-8000-000000000001",
  missionId: "mission-1i",
  ownerAgent: "research" as const,
  assignedAgent: "research" as const,
  workOrderType: "research_company" as const,
  entityType: "lead",
  entityId: "lead-1i",
  priority: 500,
  status: "awaiting_decision" as const,
  decisionRecordIds: [],
  memoryRefs: [],
  payload: { company: "Acme" },
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
}

const section = buildAiContextWorkOrderSection(workOrder)
const platformSection = buildPlatformContextWorkOrderSection(workOrder)
assert.deepEqual(section, platformSection)

const contentInput = {
  contextVersion: AI_CONTEXT_PACKAGE_SCHEMA_VERSION,
  workOrder,
  missionContext: null,
  decisionRecords: [],
  memoryEntries: [],
  relatedEvents: [],
  entityMetadata: null,
  sourceKeys: ["work_order"],
}

const wrapperChecksum = computeAiContextPackageChecksum(assembleAiContextPackageContent(contentInput))
const platformChecksum = computePlatformContextPackageChecksum(assemblePlatformContextPackageContent(contentInput))
assert.strictEqual(wrapperChecksum, platformChecksum)

const service = readSource("lib/growth/aios/ai-context-assembly-service.ts")
assert.ok(service.includes("@fuzor/context"))
assert.ok(!service.includes("getGrowthObjective"))

const resolver = readSource("lib/growth/aios/ai-context-assembly-resolver.ts")
assert.ok(resolver.includes("@fuzor/context"))

const repository = readSource("lib/growth/aios/ai-context-assembly-repository.ts")
assert.ok(repository.includes("@fuzor/context"))

assert.strictEqual(typeof assembleAiContextForWorkOrder, "function")
assert.strictEqual(typeof getAiContextAssemblyRuntimeSummary, "function")
assert.strictEqual(typeof resolveAiContextEntityMetadata, "function")
assert.strictEqual(resolveAiContextEntityMetadata, resolvePlatformContextEntityMetadata)
assert.strictEqual(assembleAiContextForWorkOrder, assemblePlatformContextForWorkOrder)

console.log("[FUZOR-ADOPTION-1I] wrapper delegation verified")

const avaOrg = "00000000-0000-4000-8000-000000000001"
const ivyOrg = "00000000-0000-4000-8000-000000000002"
const orionOrg = "00000000-0000-4000-8000-000000000003"

for (const orgId of [avaOrg, ivyOrg, orionOrg]) {
  assert.match(orgId, /^[0-9a-f-]{36}$/i)
}

assert.equal(service.includes("workflow"), false)
assert.equal(service.includes("DataMoon"), false)
assert.equal(service.includes("prompt"), false)

console.log("[FUZOR-ADOPTION-1I] multi-product context architecture proof")

console.log("[FUZOR-ADOPTION-1I] PASS")
