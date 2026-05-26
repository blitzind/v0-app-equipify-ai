import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthLead } from "@/lib/growth/types"
import { createGrowthLead, fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { normalizePhone } from "@/lib/growth/import/normalize"
import {
  CALL_WORKSPACE_TRANSCRIPT_ANCHOR_METADATA_KEY,
  isCallWorkspaceTranscriptAnchorLead as isTranscriptAnchorMetadata,
  type CallWorkspaceCoachingMode,
} from "@/lib/growth/native-dialer/call-workspace-coaching-types"

export function isCallWorkspaceTranscriptAnchorLead(lead: Pick<GrowthLead, "metadata">): boolean {
  const metadata =
    lead.metadata && typeof lead.metadata === "object"
      ? (lead.metadata as Record<string, unknown>)
      : null
  return isTranscriptAnchorMetadata(metadata)
}

export function callWorkspaceCoachingModeForLead(
  sessionLeadId: string | null | undefined,
  lead: GrowthLead | null,
): CallWorkspaceCoachingMode {
  if (!sessionLeadId || !lead) return "transcript_only"
  if (isCallWorkspaceTranscriptAnchorLead(lead)) return "transcript_only"
  return "lead_linked"
}

function formatAnchorCompanyName(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, "")
  if (digits.length === 10) {
    return `Call — (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return `Call — ${phoneNumber.trim()}`
}

/** Reuse or create an internal anchor lead for transcript-only coaching (existing leads table, no migration). */
export async function ensureCallWorkspaceTranscriptAnchorLead(
  admin: SupabaseClient,
  input: { phoneNumber: string; createdBy?: string | null },
): Promise<GrowthLead> {
  const normalizedPhone = normalizePhone(input.phoneNumber)
  if (!normalizedPhone) throw new Error("invalid_phone")

  const { data: phoneRows, error } = await admin
    .schema("growth")
    .from("leads")
    .select("id, metadata, contact_phone")
    .eq("source_detail", "call_workspace_transcript_coaching")
    .limit(50)
  if (error) throw new Error(error.message)

  for (const row of phoneRows ?? []) {
    if (normalizePhone(row.contact_phone as string) !== normalizedPhone) continue
    const lead = await fetchGrowthLeadById(admin, row.id as string)
    if (lead) return lead
  }

  return createGrowthLead(admin, {
    sourceKind: "manual",
    sourceDetail: "call_workspace_transcript_coaching",
    companyName: formatAnchorCompanyName(input.phoneNumber),
    contactPhone: input.phoneNumber.trim(),
    notes: "Internal anchor for Call Workspace transcript-only live coaching. Attach a real lead for full intelligence.",
    metadata: {
      [CALL_WORKSPACE_TRANSCRIPT_ANCHOR_METADATA_KEY]: true,
      normalized_phone: normalizedPhone,
    },
    createdBy: input.createdBy ?? null,
  })
}
