import "server-only"

import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { toSafeAiMetadata } from "@/lib/ai/redaction"
import type { CreateAiAlertInput } from "@/lib/ai/alerts/types"

const DEFAULT_DEDUPE_WINDOW_MINUTES = 30
const MAX_TITLE_LEN = 140
const MAX_MESSAGE_LEN = 400

function trimText(input: string, maxLen: number): string {
  const t = input.replace(/\s+/g, " ").trim()
  if (t.length <= maxLen) return t
  return `${t.slice(0, maxLen)}…`
}

export async function createAiAlert(input: CreateAiAlertInput): Promise<{ id?: string; deduped: boolean }> {
  let svc: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    svc = createServiceRoleSupabaseClient()
  } catch {
    return { deduped: false }
  }

  const windowMinutes = Math.max(1, Math.min(720, input.dedupeWindowMinutes ?? DEFAULT_DEDUPE_WINDOW_MINUTES))
  const sinceIso = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString()
  const orgId = input.organizationId?.trim() || null
  const metadata = toSafeAiMetadata(input.metadata ?? {})

  let q = svc
    .from("ai_alerts")
    .select("id, metadata")
    .eq("alert_type", input.alertType)
    .eq("status", "open")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(10)

  if (orgId) q = q.eq("organization_id", orgId)
  else q = q.is("organization_id", null)

  const { data: recent } = await q
  if ((recent ?? []).some((r) => JSON.stringify((r as { metadata?: unknown }).metadata ?? {}) === JSON.stringify(metadata))) {
    return { deduped: true }
  }

  const { data, error } = await svc
    .from("ai_alerts")
    .insert({
      organization_id: orgId,
      alert_type: input.alertType,
      severity: input.severity,
      title: trimText(input.title, MAX_TITLE_LEN),
      message: trimText(input.message, MAX_MESSAGE_LEN),
      status: "open",
      metadata,
    })
    .select("id")
    .single()

  if (error || !data?.id) return { deduped: false }
  return { id: data.id as string, deduped: false }
}

