/** GE-AIOS-2J — Read-only entity intelligence resolver (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { lookupAiContextEntityIntelligenceBinding } from "@/lib/growth/aios/ai-context-assembly-source-registry"
import type { AiContextEntityMetadata } from "@/lib/growth/aios/ai-context-assembly-types"
import { buildLeadMemoryInfluenceContext } from "@/lib/growth/lead-memory/memory-influence-context"

export async function resolveAiContextEntityMetadata(
  admin: SupabaseClient,
  input: {
    organizationId: string
    entityType: string | null
    entityId: string | null
  },
): Promise<AiContextEntityMetadata | null> {
  if (!input.entityType || !input.entityId) return null

  const binding = lookupAiContextEntityIntelligenceBinding(input.entityType)
  if (!binding) return null

  if (input.entityType === "lead") {
    const projection = await buildLeadMemoryInfluenceContext(admin, input.entityId)
    return {
      entityType: input.entityType,
      entityId: input.entityId,
      sourceSystem: binding.sourceSystem,
      sourceTable: binding.sourceTable,
      projection: {
        available: projection.available,
        relationshipStage: projection.relationshipStage,
        relationshipSummary: projection.relationshipSummary,
        engagementTrend: projection.engagementTrend,
        topObjections: projection.topObjections,
        topPreferences: projection.topPreferences,
        priorInteractionSummaries: projection.priorInteractionSummaries,
        riskFlags: projection.riskFlags,
      },
    }
  }

  if (input.entityType === "company") {
    const { data, error } = await admin
      .schema("growth")
      .from("company_intelligence_snapshots")
      .select("id, company_id, normalized_intelligence_key, confidence, verification_status")
      .eq("company_id", input.entityId)
      .neq("verification_status", "superseded")
      .order("created_at", { ascending: false })
      .limit(5)

    if (error) return null

    return {
      entityType: input.entityType,
      entityId: input.entityId,
      sourceSystem: binding.sourceSystem,
      sourceTable: binding.sourceTable,
      projection: {
        snapshotCount: (data ?? []).length,
        snapshots: (data ?? []).map((row) => ({
          id: String(row.id),
          intelligenceKey: String(row.normalized_intelligence_key ?? ""),
          confidence: Number(row.confidence ?? 0),
          verificationStatus: String(row.verification_status ?? ""),
        })),
      },
    }
  }

  return {
    entityType: input.entityType,
    entityId: input.entityId,
    sourceSystem: binding.sourceSystem,
    sourceTable: binding.sourceTable,
    projection: {},
  }
}
