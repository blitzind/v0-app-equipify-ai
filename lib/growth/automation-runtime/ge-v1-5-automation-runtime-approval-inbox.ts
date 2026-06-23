/** GE-AUTO-1D — Org-wide GeV15 approval inbox helpers (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listGeV15OperatorReviewActions } from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-approval"
import { parseGeV15RuntimeState } from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-logging"
import type { GeV15PreparedAction } from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-types"

export type GeV15ApprovalInboxItem = {
  leadId: string
  leadName: string
  leadEmail: string | null
  companyName: string
  action: GeV15PreparedAction
}

export async function listGeV15OrganizationApprovalInbox(
  admin: SupabaseClient,
  input: { organizationId: string; limit?: number },
): Promise<GeV15ApprovalInboxItem[]> {
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 250)
  const { data, error } = await admin
    .schema("growth")
    .from("leads")
    .select("id, contact_name, contact_email, company_name, metadata")
    .eq("promoted_organization_id", input.organizationId)
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)

  const items: GeV15ApprovalInboxItem[] = []
  for (const row of data ?? []) {
    const lead = row as {
      id: string
      contact_name: string | null
      contact_email: string | null
      company_name: string
      metadata: Record<string, unknown> | null
    }
    const state = parseGeV15RuntimeState(lead.metadata)
    for (const action of listGeV15OperatorReviewActions(state.preparedActions)) {
      items.push({
        leadId: lead.id,
        leadName: lead.contact_name ?? lead.company_name,
        leadEmail: lead.contact_email,
        companyName: lead.company_name,
        action,
      })
    }
  }

  return items.sort((a, b) => Date.parse(b.action.updatedAt) - Date.parse(a.action.updatedAt))
}
