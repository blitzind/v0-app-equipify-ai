/** FUZOR-PRODUCTION-CERTIFICATION-1A — Integrated platform certification orchestration. */

import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import {
  PLATFORM_ACTOR_AGENTS,
  resolvePlatformOrganizationId,
} from "@fuzor/identity"
import {
  getPlatformRuntimeProfile,
  PLATFORM_FEATURE_REGISTRY_VERSION,
  PLATFORM_RUNTIME_GUARDRAILS_QA_MARKER,
  PLATFORM_RUNTIME_PROFILE_VERSION,
} from "@fuzor/configuration"
import {
  ingestPlatformKnowledgeDocument,
  resolvePlatformKnowledgeOrganizationId,
  searchPlatformKnowledge,
} from "@fuzor/knowledge"
import { PLATFORM_MEMORY_REGISTRY_QA_MARKER, runPlatformMemoryEngine } from "@fuzor/memory"
import {
  clampDecisionConfidence,
  lookupPlatformDecisionRegistryEntry,
  PLATFORM_DECISION_RECORD_QA_MARKER,
} from "@fuzor/decision-records"
import {
  lookupPlatformEventRegistryEntry,
  PLATFORM_EVENT_QA_MARKER,
  subscriptionMatchesEvent,
} from "@fuzor/event-bus"
import {
  assemblePlatformContextPackageContent,
  computePlatformContextPackageChecksum,
  PLATFORM_CONTEXT_ASSEMBLY_QA_MARKER,
} from "@fuzor/context"
import { probeGrowthAiDecisionRecordSchema } from "@/lib/growth/aios/ai-decision-record-schema-health"
import { probeGrowthAiContextAssemblySchema } from "@/lib/growth/aios/ai-context-assembly-schema-health"
import { probeGrowthAiEventSchema } from "@/lib/growth/aios/ai-event-schema-health"
import { probePlatformMemoryRegistrySchema } from "@/lib/growth/aios/ai-memory-registry-schema-health"
import { bootstrapVerifiedChannelsCertEnv } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import { sanitizeSupabaseCertEnvValue } from "@/lib/growth/qa/growth-production-supabase-credential-resolution"

export const FUZOR_PRODUCTION_CERTIFICATION_1A_PHASE = "FUZOR-PRODUCTION-CERTIFICATION-1A" as const

export const FUZOR_PRODUCTION_CERTIFICATION_1A_QA_MARKER =
  "fuzor-production-certification-1a-integrated-platform-v1" as const

export type FuzorIntegratedPlatformCertCheck = {
  id: string
  pass: boolean
  detail: Record<string, unknown>
}

export type FuzorIntegratedPlatformCertResult = {
  ok: boolean
  phase: typeof FUZOR_PRODUCTION_CERTIFICATION_1A_PHASE
  qa_marker: typeof FUZOR_PRODUCTION_CERTIFICATION_1A_QA_MARKER
  mode: "local" | "production"
  checks: FuzorIntegratedPlatformCertCheck[]
  blockers: string[]
  final_verdict: "PASS" | "FAIL" | "INCOMPLETE"
}

const ORG_A = "00000000-0000-4000-8000-000000000001"
const ORG_B = "00000000-0000-4000-8000-000000000002"

function isProductionMode(): boolean {
  return (
    process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN === "1" ||
    process.env.VERCEL_ENV === "production" ||
    process.argv.includes("--production")
  )
}

function resolveSupabaseAdmin(): SupabaseClient | null {
  const url = sanitizeSupabaseCertEnvValue(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL,
  )
  const key = sanitizeSupabaseCertEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY)
  if (!url.startsWith("http") || !key.startsWith("eyJ")) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

export function runIntegratedPlatformCapabilityChecks(): FuzorIntegratedPlatformCertCheck[] {
  const checks: FuzorIntegratedPlatformCertCheck[] = []

  checks.push({
    id: "identity_actor_catalog",
    pass: PLATFORM_ACTOR_AGENTS.includes("research"),
    detail: { count: PLATFORM_ACTOR_AGENTS.length },
  })

  checks.push({
    id: "configuration_runtime_profile",
    pass:
      PLATFORM_RUNTIME_PROFILE_VERSION.length > 0 &&
      PLATFORM_FEATURE_REGISTRY_VERSION.length > 0 &&
      getPlatformRuntimeProfile("operator_minimal").id === "operator_minimal",
    detail: {
      runtime_profile_version: PLATFORM_RUNTIME_PROFILE_VERSION,
      feature_registry_version: PLATFORM_FEATURE_REGISTRY_VERSION,
      guardrails_qa_marker: PLATFORM_RUNTIME_GUARDRAILS_QA_MARKER,
    },
  })

  const docA = ingestPlatformKnowledgeDocument(
    {
      organization_id: ORG_A,
      source_type: "text",
      title: "Tenant A playbook",
      content: "Tenant A pricing objection handling.",
      tags: ["pricing"],
      categories: ["pricing"],
      status: "active",
    },
    "cert-doc-a",
  ).document
  const docB = ingestPlatformKnowledgeDocument(
    {
      organization_id: ORG_B,
      source_type: "text",
      title: "Tenant B playbook",
      content: "Tenant B pricing objection handling.",
      tags: ["pricing"],
      categories: ["pricing"],
      status: "active",
    },
    "cert-doc-b",
  ).document
  const tenantASearch = searchPlatformKnowledge([docA, docB], {
    query: "pricing",
    organization_id: ORG_A,
  })
  checks.push({
    id: "knowledge_tenant_isolation",
    pass:
      tenantASearch.hits.every((hit) => hit.document.organization_id === ORG_A) &&
      !tenantASearch.hits.some((hit) => hit.document.organization_id === ORG_B),
    detail: { hits: tenantASearch.hits.length },
  })

  checks.push({
    id: "memory_registry_constants",
    pass: PLATFORM_MEMORY_REGISTRY_QA_MARKER.length > 0,
    detail: { qa_marker: PLATFORM_MEMORY_REGISTRY_QA_MARKER },
  })

  const verifyEmail = lookupPlatformDecisionRegistryEntry("verify_email")
  checks.push({
    id: "decision_records_registry",
    pass: verifyEmail?.ownerAgent === "qualification",
    detail: { qa_marker: PLATFORM_DECISION_RECORD_QA_MARKER, confidence: clampDecisionConfidence(150) },
  })

  const decisionRecorded = lookupPlatformEventRegistryEntry("decision.recorded")
  checks.push({
    id: "event_bus_registry_routing",
    pass:
      decisionRecorded?.category === "decision" &&
      subscriptionMatchesEvent(
        { categories: ["decision"], eventTypePrefixes: ["decision"] },
        { category: "decision", eventType: "decision.recorded" },
      ),
    detail: { qa_marker: PLATFORM_EVENT_QA_MARKER },
  })

  const workOrder = {
    id: "wo-cert-1a",
    organizationId: ORG_A,
    missionId: "mission-cert-1a",
    ownerAgent: "research" as const,
    assignedAgent: "research" as const,
    workOrderType: "research_company" as const,
    entityType: "lead",
    entityId: "lead-cert-1a",
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
    issuedAt: "2026-07-22T00:00:00.000Z",
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    archivedAt: null,
    qaMarker: "growth-aios-2a-ai-work-order-v1",
    createdAt: "2026-07-22T00:00:00.000Z",
    updatedAt: "2026-07-22T00:00:00.000Z",
  }
  const content = assemblePlatformContextPackageContent({
    contextVersion: "1.0",
    workOrder,
    missionContext: null,
    decisionRecords: [],
    memoryEntries: [],
    relatedEvents: [],
    entityMetadata: null,
    sourceKeys: ["work_order"],
  })
  const checksumA = computePlatformContextPackageChecksum(content)
  const checksumB = computePlatformContextPackageChecksum(content)
  checks.push({
    id: "context_deterministic_checksum",
    pass: checksumA === checksumB && checksumA.length > 0,
    detail: { qa_marker: PLATFORM_CONTEXT_ASSEMBLY_QA_MARKER, checksum: checksumA },
  })

  return checks
}

export function runIntegratedPlatformMultitenancyChecks(): FuzorIntegratedPlatformCertCheck[] {
  const checks: FuzorIntegratedPlatformCertCheck[] = []

  checks.push({
    id: "identity_require_org",
    pass: resolvePlatformOrganizationId(undefined) === null,
    detail: { resolved: resolvePlatformOrganizationId(undefined) },
  })

  checks.push({
    id: "knowledge_require_org",
    pass: resolvePlatformKnowledgeOrganizationId(undefined) === null,
    detail: { resolved: resolvePlatformKnowledgeOrganizationId(undefined) },
  })

  let memoryOrgRequired = false
  try {
    runPlatformMemoryEngine({ organizationId: "" } as never)
  } catch (error) {
    memoryOrgRequired = error instanceof Error && error.message === "organization_id_required"
  }
  checks.push({
    id: "memory_org_scoped_engine",
    pass: memoryOrgRequired,
    detail: { qa_marker: PLATFORM_MEMORY_REGISTRY_QA_MARKER },
  })

  return checks
}

export async function runIntegratedPlatformProductionSchemaChecks(
  admin: SupabaseClient,
): Promise<FuzorIntegratedPlatformCertCheck[]> {
  const [events, decisions, context, memory] = await Promise.all([
    probeGrowthAiEventSchema(admin),
    probeGrowthAiDecisionRecordSchema(admin),
    probeGrowthAiContextAssemblySchema(admin),
    probePlatformMemoryRegistrySchema(admin),
  ])

  return [
    { id: "production_schema_events", pass: events.ready, detail: { ready: events.ready, missing: events.missingObjects } },
    {
      id: "production_schema_decision_records",
      pass: decisions.ready,
      detail: { ready: decisions.ready, missing: decisions.missingObjects },
    },
    {
      id: "production_schema_context",
      pass: context.ready,
      detail: { ready: context.ready, missing: context.missingObjects },
    },
    {
      id: "production_schema_memory",
      pass: memory.ready,
      detail: { ready: memory.ready, missing: memory.missingObjects },
    },
  ]
}

export async function executeFuzorIntegratedPlatformCertification(input?: {
  production?: boolean
}): Promise<FuzorIntegratedPlatformCertResult> {
  const production = input?.production ?? isProductionMode()
  const checks = [
    ...runIntegratedPlatformCapabilityChecks(),
    ...runIntegratedPlatformMultitenancyChecks(),
  ]
  const blockers: string[] = []

  if (production) {
    bootstrapVerifiedChannelsCertEnv({
      protectedSnapshot: {
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL,
      },
    })

    const admin = resolveSupabaseAdmin()
    if (!admin) {
      blockers.push("supabase_unavailable")
      return {
        ok: false,
        phase: FUZOR_PRODUCTION_CERTIFICATION_1A_PHASE,
        qa_marker: FUZOR_PRODUCTION_CERTIFICATION_1A_QA_MARKER,
        mode: "production",
        checks,
        blockers,
        final_verdict: "INCOMPLETE",
      }
    }

    const orgId = sanitizeSupabaseCertEnvValue(process.env.GROWTH_ENGINE_AI_ORG_ID)
    if (!/^[0-9a-f-]{36}$/i.test(orgId)) {
      blockers.push("growth_engine_ai_org_id_missing_or_invalid")
    }

    checks.push(...(await runIntegratedPlatformProductionSchemaChecks(admin)))
  }

  const failed = checks.filter((check) => !check.pass)
  const ok = failed.length === 0 && blockers.length === 0

  return {
    ok,
    phase: FUZOR_PRODUCTION_CERTIFICATION_1A_PHASE,
    qa_marker: FUZOR_PRODUCTION_CERTIFICATION_1A_QA_MARKER,
    mode: production ? "production" : "local",
    checks,
    blockers,
    final_verdict: blockers.length > 0 ? "INCOMPLETE" : ok ? "PASS" : "FAIL",
  }
}
