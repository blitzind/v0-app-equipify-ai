import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { insertTeamAuditEvent } from "@/lib/team-audit"
import { countActiveOwners } from "@/lib/team/membership"
import { technicianBulkDeactivateBlockMessage } from "@/lib/technicians/bulk-deactivate-eligibility"
import { technicianAlreadyDeactivatedMessage } from "@/lib/technicians/bulk-deactivate-messages"

export type BulkDeactivateTechnicianResult =
  | { id: string; ok: true }
  | { id: string; ok: false; message: string }

type MemberRow = {
  user_id: string
  role: string
  status: string
  membership_id?: string | null
}

export async function bulkDeactivateTechnicians(args: {
  writeClient: SupabaseClient
  adminClient: SupabaseClient
  organizationId: string
  userIds: string[]
  actorUserId: string
  actorIsOwner: boolean
  actorIsAdmin: boolean
}): Promise<{ results: BulkDeactivateTechnicianResult[] }> {
  const unique = [...new Set(args.userIds)]
  const results: BulkDeactivateTechnicianResult[] = []
  const activeOwnerCount = await countActiveOwners(args.adminClient, args.organizationId)

  for (const id of unique) {
    const { data, error } = await args.adminClient
      .from("organization_members")
      .select("user_id, role, status, membership_id")
      .eq("organization_id", args.organizationId)
      .eq("user_id", id)
      .maybeSingle()

    if (error || !data) {
      results.push({ id, ok: false, message: "Technician not found." })
      continue
    }

    const row = data as MemberRow

    const already = technicianAlreadyDeactivatedMessage(row.status)
    if (already) {
      results.push({ id, ok: false, message: already })
      continue
    }

    const block = technicianBulkDeactivateBlockMessage({
      targetUserId: id,
      actorUserId: args.actorUserId,
      targetRole: row.role,
      targetStatus: row.status,
      actorIsOwner: args.actorIsOwner,
      actorIsAdmin: args.actorIsAdmin,
      activeOwnerCount,
    })
    if (block) {
      results.push({ id, ok: false, message: block })
      continue
    }

    const { error: updateError } = await args.writeClient
      .from("organization_members")
      .update({ status: "suspended" })
      .eq("organization_id", args.organizationId)
      .eq("user_id", id)

    if (updateError) {
      results.push({ id, ok: false, message: "Could not deactivate this technician. Try again." })
      continue
    }

    if (row.membership_id) {
      await args.adminClient
        .from("technicians")
        .update({ operational_status: "inactive", updated_at: new Date().toISOString() })
        .eq("organization_id", args.organizationId)
        .eq("membership_id", row.membership_id)
    }

    await insertTeamAuditEvent({
      organizationId: args.organizationId,
      action: "member_suspended",
      actorUserId: args.actorUserId,
      recordType: "organization_member",
      recordId: `${args.organizationId}:${id}`,
      metadata: { userId: id, source: "technicians_bulk_deactivate" },
    })

    results.push({ id, ok: true })
  }

  return { results }
}
