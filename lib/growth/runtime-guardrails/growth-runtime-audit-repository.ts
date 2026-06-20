import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { GROWTH_RUNTIME_GUARDRAILS_QA_MARKER } from "@/lib/growth/runtime-guardrails/growth-runtime-guardrail-config"

function auditTable(admin: SupabaseClient) {
  return admin.schema("growth").from("runtime_guardrail_audit_log")
}

export async function recordRuntimeGuardrailAudit(
  admin: SupabaseClient,
  input: {
    organizationId?: string | null
    resourceType: string
    severity?: "info" | "warning" | "error"
    message: string
    context?: Record<string, unknown>
  },
): Promise<void> {
  const { error } = await auditTable(admin).insert({
    organization_id: input.organizationId ?? null,
    resource_type: input.resourceType,
    severity: input.severity ?? "warning",
    message: input.message,
    context_json: input.context ?? {},
    qa_marker: GROWTH_RUNTIME_GUARDRAILS_QA_MARKER,
  })
  if (error) throw new Error(error.message)
}

export async function listRecentGuardrailAudits(
  admin: SupabaseClient,
  input?: { organizationId?: string; limit?: number },
): Promise<
  Array<{
    id: string
    organizationId: string | null
    resourceType: string
    severity: string
    message: string
    createdAt: string
  }>
> {
  let query = auditTable(admin)
    .select("id, organization_id, resource_type, severity, message, created_at")
    .order("created_at", { ascending: false })
    .limit(input?.limit ?? 50)

  if (input?.organizationId) {
    query = query.eq("organization_id", input.organizationId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => ({
    id: String((row as { id: string }).id),
    organizationId: (row as { organization_id: string | null }).organization_id,
    resourceType: String((row as { resource_type: string }).resource_type),
    severity: String((row as { severity: string }).severity),
    message: String((row as { message: string }).message),
    createdAt: String((row as { created_at: string }).created_at),
  }))
}
