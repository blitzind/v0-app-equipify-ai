import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getPlatformAdminEmails } from "@/lib/platform-admin-policy"

/**
 * Plan seat enforcement & billing honesty (Phase 60.3).
 * Platform-admin allowlist emails do not consume customer seat capacity.
 */

export type OrganizationSeatMetrics = {
  /** Active members that count toward the plan (excludes platform-admin allowlist). */
  activeBillable: number
  /** `organization_members.status = invited` rows that count toward the plan. */
  invitedMemberRowsBillable: number
  /** `organization_invites` rows: pending and not yet expired. */
  pendingTokenInvites: number
  /** Compared to plan cap for invites and billing “effective” usage. */
  seatsReservedForPlan: number
  /** All active rows including platform admins (display / diagnostics). */
  activeTotalIncludingAdmins: number
}

function isBillableSeatEmail(email: string | null | undefined, adminEmails: Set<string>): boolean {
  if (!email?.trim()) return true
  return !adminEmails.has(email.trim().toLowerCase())
}

/** Server-side seat breakdown for enforcement and honest billing/team UI. */
export async function fetchOrganizationSeatMetrics(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<OrganizationSeatMetrics | null> {
  try {
    const adminEmails = new Set(getPlatformAdminEmails())

    const { data: members, error: memErr } = await supabase
      .from("organization_members")
      .select("user_id, status")
      .eq("organization_id", organizationId)
      .in("status", ["active", "invited"])

    if (memErr || !members) return null

    const userIds = [...new Set(members.map((m) => (m as { user_id: string }).user_id).filter(Boolean))]
    let emailByUser = new Map<string, string | null>()
    if (userIds.length > 0) {
      const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", userIds)
      if (profErr) return null
      emailByUser = new Map(
        (profiles ?? []).map((p) => [(p as { id: string }).id, (p as { email?: string | null }).email ?? null]),
      )
    }

    let activeBillable = 0
    let activeTotalIncludingAdmins = 0
    let invitedMemberRowsBillable = 0

    for (const row of members) {
      const uid = (row as { user_id: string }).user_id
      const st = (row as { status: string }).status
      const em = emailByUser.get(uid) ?? null
      if (st === "active") {
        activeTotalIncludingAdmins++
        if (isBillableSeatEmail(em, adminEmails)) activeBillable++
      } else if (st === "invited") {
        if (isBillableSeatEmail(em, adminEmails)) invitedMemberRowsBillable++
      }
    }

    const nowIso = new Date().toISOString()
    const { count: pendingTok, error: invErr } = await supabase
      .from("organization_invites")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "pending")
      .gt("expires_at", nowIso)

    if (invErr) return null

    const pendingTokenInvites = pendingTok ?? 0
    const seatsReservedForPlan = activeBillable + invitedMemberRowsBillable + pendingTokenInvites

    return {
      activeBillable,
      invitedMemberRowsBillable,
      pendingTokenInvites,
      seatsReservedForPlan,
      activeTotalIncludingAdmins,
    }
  } catch {
    return null
  }
}
