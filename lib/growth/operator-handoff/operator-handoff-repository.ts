import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchLeadInboxById } from "@/lib/growth/lead-inbox/lead-inbox-repository"
import { isGrowthLeadInboxSchemaReady } from "@/lib/growth/lead-inbox/lead-inbox-schema-health"
import type { GrowthLeadInboxRow } from "@/lib/growth/lead-inbox/lead-inbox-types"
import type { GrowthOperatorHandoffInput } from "@/lib/growth/operator-handoff/operator-handoff-types"
import {
  GROWTH_OPERATOR_HANDOFF_QA_MARKER,
  type GrowthOperatorHandoffOutput,
  type GrowthOperatorHandoffPackage,
} from "@/lib/growth/operator-handoff/operator-handoff-types"

export const GROWTH_OPERATOR_HANDOFF_METADATA_KEY = "operator_handoff" as const

function isHandoffPackage(value: unknown): value is GrowthOperatorHandoffPackage {
  if (!value || typeof value !== "object") return false
  const row = value as Record<string, unknown>
  if (row.qa_marker !== GROWTH_OPERATOR_HANDOFF_QA_MARKER) return false
  if (!row.handoff || typeof row.handoff !== "object") return false
  return typeof row.generated_at === "string"
}

export function buildOperatorHandoffPackage(
  input: GrowthOperatorHandoffInput,
  handoff: GrowthOperatorHandoffOutput,
  generatedAt: string = new Date().toISOString(),
): GrowthOperatorHandoffPackage {
  return {
    qa_marker: GROWTH_OPERATOR_HANDOFF_QA_MARKER,
    lead_inbox_id: input.leadInbox?.id ?? null,
    generated_at: generatedAt,
    handoff,
  }
}

export function loadOperatorHandoffFromLeadInbox(
  row: GrowthLeadInboxRow,
): GrowthOperatorHandoffPackage | null {
  const stored = row.metadata[GROWTH_OPERATOR_HANDOFF_METADATA_KEY]
  if (!isHandoffPackage(stored)) return null
  return stored
}

export type GrowthOperatorHandoffSaveResult = {
  qa_marker: typeof GROWTH_OPERATOR_HANDOFF_QA_MARKER
  ok: boolean
  package: GrowthOperatorHandoffPackage | null
  row: GrowthLeadInboxRow | null
  reason: string | null
}

/** Persist handoff on lead_inbox.metadata — does not trigger outreach. */
export async function saveOperatorHandoffToLeadInbox(
  admin: SupabaseClient,
  leadInboxId: string,
  pkg: GrowthOperatorHandoffPackage,
): Promise<GrowthOperatorHandoffSaveResult> {
  if (pkg.qa_marker !== GROWTH_OPERATOR_HANDOFF_QA_MARKER) {
    return {
      qa_marker: GROWTH_OPERATOR_HANDOFF_QA_MARKER,
      ok: false,
      package: null,
      row: null,
      reason: "Invalid operator handoff QA marker.",
    }
  }

  if (!(await isGrowthLeadInboxSchemaReady(admin))) {
    return {
      qa_marker: GROWTH_OPERATOR_HANDOFF_QA_MARKER,
      ok: false,
      package: null,
      row: null,
      reason: "Lead inbox schema not ready.",
    }
  }

  const existing = await fetchLeadInboxById(admin, leadInboxId)
  if (!existing) {
    return {
      qa_marker: GROWTH_OPERATOR_HANDOFF_QA_MARKER,
      ok: false,
      package: null,
      row: null,
      reason: "Lead inbox row not found.",
    }
  }

  const { data, error } = await admin
    .schema("growth")
    .from("lead_inbox")
    .update({
      updated_at: new Date().toISOString(),
      metadata: {
        ...existing.metadata,
        [GROWTH_OPERATOR_HANDOFF_METADATA_KEY]: pkg,
      },
    })
    .eq("id", leadInboxId)
    .select("*")
    .single()

  if (error || !data) {
    return {
      qa_marker: GROWTH_OPERATOR_HANDOFF_QA_MARKER,
      ok: false,
      package: null,
      row: null,
      reason: error?.message ?? "Failed to save operator handoff.",
    }
  }

  const row = data as Record<string, unknown>
  const metadata =
    row.metadata && typeof row.metadata === "object"
      ? (row.metadata as Record<string, unknown>)
      : {}

  const saved = metadata[GROWTH_OPERATOR_HANDOFF_METADATA_KEY]
  if (!isHandoffPackage(saved)) {
    return {
      qa_marker: GROWTH_OPERATOR_HANDOFF_QA_MARKER,
      ok: false,
      package: null,
      row: null,
      reason: "Saved metadata did not round-trip operator handoff.",
    }
  }

  return {
    qa_marker: GROWTH_OPERATOR_HANDOFF_QA_MARKER,
    ok: true,
    package: saved,
    row: {
      ...existing,
      id: String(row.id ?? existing.id),
      updated_at: String(row.updated_at ?? existing.updated_at),
      metadata,
    },
    reason: null,
  }
}
