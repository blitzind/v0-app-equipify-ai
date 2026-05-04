import type { SupabaseClient } from "@supabase/supabase-js"
import {
  queryOrganizationMembersForRoster,
  queryProfilesForRoster,
} from "@/lib/technicians/roster-queries"

const ROSTER_MEMBER_ROLES = ["owner", "admin", "manager", "tech"] as const

export type TechnicianAssignOption = {
  id: string
  label: string
  avatarUrl: string | null
  /** Job title when set, else formatted organization role. */
  roleLabel: string
  region: string
  /** Field availability / roster status (Available, …). */
  fieldStatus: string
  /** invited / active / suspended */
  membershipLabel: string
}

function formatMemberRole(role: string): string {
  if (!role) return "Member"
  return role.charAt(0).toUpperCase() + role.slice(1)
}

/**
 * Technicians eligible for assignment (active + invited roster roles).
 * Uses roster column fallbacks when migrations are not applied yet.
 */
export async function loadTechnicianAssignOptions(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<TechnicianAssignOption[]> {
  const {
    data: members,
    error: memErr,
    rosterColumnsAvailable: omRoster,
  } = await queryOrganizationMembersForRoster(supabase, {
    organizationId,
    statusIn: ["active", "invited"],
    roleIn: ROSTER_MEMBER_ROLES,
  })

  if (memErr || !members?.length) return []

  type M = {
    user_id: string
    role: string
    status: string
    job_title?: string | null
    region?: string | null
    availability_status?: string | null
  }

  const memberList = members as M[]
  const userIds = [...new Set(memberList.map((m) => m.user_id))]
  const { data: profs, error: profErr } = await queryProfilesForRoster(supabase, userIds)
  if (profErr) return []

  const profileById = new Map(
    ((profs ?? []) as Array<{
      id: string
      full_name: string | null
      email: string | null
      avatar_url?: string | null
    }>).map((p) => [p.id, p]),
  )
  const memberByUser = new Map(memberList.map((m) => [m.user_id, m]))

  const out: TechnicianAssignOption[] = []
  for (const uid of userIds) {
    const p = profileById.get(uid)
    const m = memberByUser.get(uid)
    if (!p || !m) continue

    const label =
      (p.full_name && p.full_name.trim()) || (p.email && p.email.trim()) || "Team member"

    const roleLabel =
      omRoster && m.job_title?.trim()
        ? m.job_title.trim()
        : formatMemberRole(m.role)

    const region = omRoster && m.region?.trim() ? m.region.trim() : "—"

    const fieldStatus =
      omRoster && m.availability_status?.trim() ? m.availability_status.trim() : "—"

    const membershipLabel =
      m.status === "invited" ? "Invite pending" : m.status === "suspended" ? "Suspended" : "Active"

    out.push({
      id: uid,
      label,
      avatarUrl: p.avatar_url?.trim() || null,
      roleLabel,
      region,
      fieldStatus,
      membershipLabel,
    })
  }

  out.sort((a, b) => a.label.localeCompare(b.label))
  return out
}
