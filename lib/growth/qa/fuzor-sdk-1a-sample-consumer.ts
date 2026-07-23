/**
 * FUZOR-SDK-1A — Representative SDK consumer (sample only, not full migration).
 * Demonstrates Equipify / Insideify / future products consuming @fuzor/sdk.
 */

import {
  Configuration,
  Context,
  DecisionRecords,
  EventBus,
  Identity,
  Knowledge,
  Memory,
  Observability,
} from "@fuzor/sdk"

export const FUZOR_SDK_1A_SAMPLE_QA_MARKER = "fuzor-sdk-1a-sample-consumer-v1" as const

const ORG_A = "00000000-0000-4000-8000-000000000001"
const ORG_B = "00000000-0000-4000-8000-000000000002"
const ORG_FUTURE = "00000000-0000-4000-8000-000000000003"

export function validateFuzorSdkSampleConsumer(): {
  ok: boolean
  checks: Array<{ id: string; pass: boolean }>
} {
  const checks: Array<{ id: string; pass: boolean }> = []

  checks.push({
    id: "equipify_identity_catalog",
    pass: Identity.PLATFORM_ACTOR_AGENTS.includes("research"),
  })

  checks.push({
    id: "equipify_runtime_profile",
    pass: Configuration.getPlatformRuntimeProfile("operator_minimal").id === "operator_minimal",
  })

  const doc = Knowledge.ingestPlatformKnowledgeDocument(
    {
      organization_id: ORG_A,
      source_type: "text",
      title: "SDK sample",
      content: "Knowledge via SDK namespace.",
      status: "active",
    },
    "sdk-sample-doc",
  ).document
  const search = Knowledge.searchPlatformKnowledge([doc], {
    query: "SDK",
    organization_id: ORG_A,
  })
  checks.push({
    id: "equipify_knowledge_search",
    pass: search.hits.length === 1,
  })

  checks.push({
    id: "insideify_memory_gate",
    pass: (() => {
      try {
        Memory.runPlatformMemoryEngine({ organizationId: "" } as never)
        return false
      } catch (error) {
        return error instanceof Error && error.message === "organization_id_required"
      }
    })(),
  })

  checks.push({
    id: "insideify_decision_registry",
    pass: DecisionRecords.lookupPlatformDecisionRegistryEntry("verify_email")?.ownerAgent === "qualification",
  })

  checks.push({
    id: "future_product_event_routing",
    pass: EventBus.subscriptionMatchesEvent(
      { categories: ["decision"], eventTypePrefixes: ["decision"] },
      { category: "decision", eventType: "decision.recorded" },
    ),
  })

  const workOrder = {
    id: "wo-sdk-1a",
    organizationId: ORG_FUTURE,
    missionId: "mission-sdk-1a",
    ownerAgent: "research" as const,
    assignedAgent: "research" as const,
    workOrderType: "research_company" as const,
    entityType: "lead",
    entityId: "lead-sdk-1a",
    priority: 500,
    status: "awaiting_decision" as const,
    decisionRecordIds: [],
    memoryRefs: [],
    payload: { company: "Future Co" },
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
    issuedAt: "2026-07-22T00:00:00.000Z",
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    archivedAt: null,
    qaMarker: "growth-aios-2a-ai-work-order-v1",
    createdAt: "2026-07-22T00:00:00.000Z",
    updatedAt: "2026-07-22T00:00:00.000Z",
  }

  const content = Context.assemblePlatformContextPackageContent({
    contextVersion: "1.0",
    workOrder,
    missionContext: null,
    decisionRecords: [],
    memoryEntries: [],
    relatedEvents: [],
    entityMetadata: null,
    sourceKeys: ["work_order"],
  })
  const checksum = Context.computePlatformContextPackageChecksum(content)
  checks.push({
    id: "future_product_context_checksum",
    pass: checksum.length > 0,
  })

  checks.push({
    id: "observability_correlation",
    pass: Observability.buildPlatformCorrelationId("seed").length > 0,
  })

  checks.push({
    id: "tenant_isolation_knowledge",
    pass: (() => {
      const docB = Knowledge.ingestPlatformKnowledgeDocument(
        {
          organization_id: ORG_B,
          source_type: "text",
          title: "Other tenant",
          content: "SDK tenant B",
          status: "active",
        },
        "sdk-sample-doc-b",
      ).document
      const isolated = Knowledge.searchPlatformKnowledge([doc, docB], {
        query: "tenant",
        organization_id: ORG_A,
      })
      return isolated.hits.every((hit) => hit.document.organization_id === ORG_A)
    })(),
  })

  return { ok: checks.every((check) => check.pass), checks }
}
