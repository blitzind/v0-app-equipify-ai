/** GE-AIOS-2J — Context Assembly persistence (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  AI_CONTEXT_PACKAGE_SCHEMA_VERSION,
  GROWTH_AI_CONTEXT_ASSEMBLY_QA_MARKER,
  type AiContextAssemblyRuntime,
  type AiContextPackage,
  type AiContextPackageContent,
} from "@/lib/growth/aios/ai-context-assembly-types"

type RuntimeRow = {
  id: string
  organization_id: string
  assembly_count: number
  reuse_count: number
  validation_failure_count: number
  last_assembled_at: string | null
  metadata: Record<string, unknown> | null
  qa_marker: string
  created_at: string
  updated_at: string
}

type PackageRow = {
  id: string
  organization_id: string
  mission_id: string
  work_order_id: string
  context_version: string
  checksum: string
  work_order_context: Record<string, unknown>
  mission_context: Record<string, unknown> | null
  decision_history: unknown
  memory_references: unknown
  related_events: unknown
  evidence_bundle: unknown
  entity_metadata: Record<string, unknown> | null
  source_keys: unknown
  reused_from_package_id: string | null
  qa_marker: string
  created_at: string
}

function runtimeTable(admin: SupabaseClient) {
  return admin.schema("growth").from("ai_context_assembly_runtime")
}

function packageTable(admin: SupabaseClient) {
  return admin.schema("growth").from("ai_context_packages")
}

function mapRuntime(row: RuntimeRow): AiContextAssemblyRuntime {
  return {
    id: row.id,
    organizationId: row.organization_id,
    assemblyCount: row.assembly_count,
    reuseCount: row.reuse_count,
    validationFailureCount: row.validation_failure_count,
    lastAssembledAt: row.last_assembled_at,
    metadata: row.metadata ?? {},
    qaMarker: row.qa_marker,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapPackage(row: PackageRow): AiContextPackage {
  return {
    id: row.id,
    organizationId: row.organization_id,
    missionId: row.mission_id,
    workOrderId: row.work_order_id,
    contextVersion: row.context_version,
    checksum: row.checksum,
    workOrderContext: row.work_order_context as AiContextPackage["workOrderContext"],
    missionContext: row.mission_context as AiContextPackage["missionContext"],
    decisionHistory: (row.decision_history ?? []) as AiContextPackage["decisionHistory"],
    memoryReferences: (row.memory_references ?? []) as AiContextPackage["memoryReferences"],
    relatedEvents: (row.related_events ?? []) as AiContextPackage["relatedEvents"],
    evidenceBundle: (row.evidence_bundle ?? []) as AiContextPackage["evidenceBundle"],
    entityMetadata: row.entity_metadata as AiContextPackage["entityMetadata"],
    sourceKeys: (row.source_keys ?? []) as AiContextPackage["sourceKeys"],
    reusedFromPackageId: row.reused_from_package_id,
    qaMarker: row.qa_marker,
    createdAt: row.created_at,
  }
}

export function aiContextAssemblySchemaCatalog() {
  return {
    qaMarker: GROWTH_AI_CONTEXT_ASSEMBLY_QA_MARKER,
    tables: ["ai_context_assembly_runtime", "ai_context_packages"],
  }
}

export async function fetchAiContextAssemblyRuntime(
  admin: SupabaseClient,
  input: { organizationId: string },
): Promise<AiContextAssemblyRuntime | null> {
  const { data, error } = await runtimeTable(admin)
    .select("*")
    .eq("organization_id", input.organizationId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapRuntime(data as RuntimeRow) : null
}

export async function upsertAiContextAssemblyRuntime(
  admin: SupabaseClient,
  input: { organizationId: string },
): Promise<AiContextAssemblyRuntime> {
  const existing = await fetchAiContextAssemblyRuntime(admin, input)
  if (existing) return existing

  const { data, error } = await runtimeTable(admin)
    .insert({
      organization_id: input.organizationId,
      qa_marker: GROWTH_AI_CONTEXT_ASSEMBLY_QA_MARKER,
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapRuntime(data as RuntimeRow)
}

export async function incrementAiContextAssemblyRuntime(
  admin: SupabaseClient,
  input: {
    organizationId: string
    assemblyDelta?: number
    reuseDelta?: number
    validationFailureDelta?: number
  },
): Promise<AiContextAssemblyRuntime> {
  const runtime = await upsertAiContextAssemblyRuntime(admin, { organizationId: input.organizationId })
  const { data, error } = await runtimeTable(admin)
    .update({
      assembly_count: runtime.assemblyCount + (input.assemblyDelta ?? 0),
      reuse_count: runtime.reuseCount + (input.reuseDelta ?? 0),
      validation_failure_count: runtime.validationFailureCount + (input.validationFailureDelta ?? 0),
      last_assembled_at: new Date().toISOString(),
    })
    .eq("id", runtime.id)
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapRuntime(data as RuntimeRow)
}

export async function fetchAiContextPackageByChecksum(
  admin: SupabaseClient,
  input: {
    organizationId: string
    workOrderId: string
    contextVersion: string
    checksum: string
  },
): Promise<AiContextPackage | null> {
  const { data, error } = await packageTable(admin)
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("work_order_id", input.workOrderId)
    .eq("context_version", input.contextVersion)
    .eq("checksum", input.checksum)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapPackage(data as PackageRow) : null
}

export async function fetchAiContextPackageById(
  admin: SupabaseClient,
  input: { organizationId: string; contextPackageId: string },
): Promise<AiContextPackage | null> {
  const { data, error } = await packageTable(admin)
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("id", input.contextPackageId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapPackage(data as PackageRow) : null
}

export async function insertAiContextPackage(
  admin: SupabaseClient,
  input: {
    organizationId: string
    missionId: string
    workOrderId: string
    content: AiContextPackageContent
    checksum: string
    reusedFromPackageId?: string | null
  },
): Promise<AiContextPackage> {
  const row = {
    organization_id: input.organizationId,
    mission_id: input.missionId,
    work_order_id: input.workOrderId,
    context_version: input.content.contextVersion || AI_CONTEXT_PACKAGE_SCHEMA_VERSION,
    checksum: input.checksum,
    work_order_context: input.content.workOrderContext,
    mission_context: input.content.missionContext,
    decision_history: input.content.decisionHistory,
    memory_references: input.content.memoryReferences,
    related_events: input.content.relatedEvents,
    evidence_bundle: input.content.evidenceBundle,
    entity_metadata: input.content.entityMetadata,
    source_keys: input.content.sourceKeys,
    reused_from_package_id: input.reusedFromPackageId ?? null,
    qa_marker: GROWTH_AI_CONTEXT_ASSEMBLY_QA_MARKER,
  }

  const { data, error } = await packageTable(admin).insert(row).select("*").single()
  if (error) throw new Error(error.message)
  return mapPackage(data as PackageRow)
}

export async function listAiContextPackagesForWorkOrder(
  admin: SupabaseClient,
  input: { organizationId: string; workOrderId: string; limit?: number },
): Promise<AiContextPackage[]> {
  let query = packageTable(admin)
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("work_order_id", input.workOrderId)
    .order("created_at", { ascending: false })

  if (input.limit) query = query.limit(input.limit)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapPackage(row as PackageRow))
}
