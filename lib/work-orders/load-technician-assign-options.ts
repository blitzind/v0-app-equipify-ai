import type { SupabaseClient } from "@supabase/supabase-js"
import { listTechniciansForOrg } from "@/lib/technicians/technician-table"
import {
  queryOrganizationMembersForRoster,
  queryProfilesForRoster,
} from "@/lib/technicians/roster-queries"
import { isEligibleFieldAssignableMember } from "@/lib/work-orders/assignee-eligibility"

export type TechnicianAssignOption = {
  /**
   * Assignment picker value: `technicians.id` when {@link assignmentKind} is `technician`,
   * otherwise `profiles.id` / auth user id (saved as `work_orders.assigned_user_id`).
   */
  id: string
  /**
   * When {@link assignmentKind} is `technician` and the row is linked to a login, the auth/profile
   * user id (for dispatch boards / conflict checks that key off `assigned_user_id`).
   */
  linkedUserId: string | null
  label: string
  avatarUrl: string | null
  /** Job title when set, else "Technician". */
  roleLabel: string
  region: string
  /** Field availability / roster status (Available, …). */
  fieldStatus: string
  /** invited / active / suspended when linked to a member; else "Field resource". */
  membershipLabel: string
  /** `field_resource` = org member without a linked `technicians` row (owner/admin/manager/tech). */
  assignmentKind?: "technician" | "field_resource"
}

export const ASSIGNEE_PICKER_EMPTY_HINT =
  "No assignable technicians or eligible team members. Add an active technician under Technicians, or invite an active field technician in Team."

function formatMemberRole(role: string): string {
  if (!role) return "Member"
  return role.charAt(0).toUpperCase() + role.slice(1)
}

/**
 * Technicians eligible for assignment (operational `technicians` rows).
 * Optional profile avatar when linked to a login via organization_members.
 */
const ROSTER_MEMBER_ROLES = ["owner", "admin", "manager", "tech"] as const

/**
 * Org members who may appear as assignees without a `technicians` row (same pattern as Dispatch roster).
 * Excludes users already linked to an active technician via `organization_members.membership_id`.
 */
const FIELD_RESOURCE_MEMBER_ROLES = ["owner", "admin", "manager", "tech"] as const

function isMissingColumnOrSchemaError(err: { message?: string } | null): boolean {
  const m = (err?.message ?? "").toLowerCase()
  return (
    (m.includes("column") && m.includes("does not exist")) ||
    m.includes("could not find") ||
    (m.includes("schema cache") && m.includes("column"))
  )
}

async function buildFieldResourceAssigneeOptions(
  supabase: SupabaseClient,
  organizationId: string,
  linkedMemberUserIds: Set<string>,
): Promise<TechnicianAssignOption[]> {
  const {
    data: members,
    error: memErr,
    rosterColumnsAvailable: omRoster,
  } = await queryOrganizationMembersForRoster(supabase, {
    organizationId,
    statusIn: ["active"],
    roleIn: FIELD_RESOURCE_MEMBER_ROLES,
  })

  if (memErr || !members?.length) return []

  type M = {
    user_id: string
    role: string
    status: string
    job_title?: string | null
    region?: string | null
    availability_status?: string | null
    permission_profile?: string | null
    permissions_json?: unknown
    is_field_resource?: boolean | null
  }

  const memberList = (members as M[]).filter(
    (m) =>
      !linkedMemberUserIds.has(m.user_id) &&
      isEligibleFieldAssignableMember({
        role: m.role,
        status: m.status,
        permission_profile: m.permission_profile,
        permissions_json: m.permissions_json,
        isFieldResource: m.is_field_resource,
      }),
  )
  if (!memberList.length) return []

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
      linkedUserId: uid,
      label,
      avatarUrl: p.avatar_url?.trim() || null,
      roleLabel,
      region,
      fieldStatus,
      membershipLabel: `${membershipLabel} · Field resource`,
      assignmentKind: "field_resource",
    })
  }

  out.sort((a, b) => a.label.localeCompare(b.label))
  return out
}

/** Minimal `{ id, label }[]` for Schedule / Dispatch pickers that resolve via {@link workOrderAssignmentColumns}. */
export function toScheduleAssigneePickerOptions(
  options: TechnicianAssignOption[],
): Array<{ id: string; label: string }> {
  return options.map((o) => ({ id: o.id, label: o.label }))
}

/** Pre-technicians-table: assignment options keyed by auth user id (assigned_user_id only). */
async function loadTechnicianAssignOptionsLegacy(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<TechnicianAssignOption[]> {
  const {
    data: members,
    error: memErr,
    rosterColumnsAvailable: omRoster,
  } = await queryOrganizationMembersForRoster(supabase, {
    organizationId,
    statusIn: ["active"],
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
    permission_profile?: string | null
    permissions_json?: unknown
    is_field_resource?: boolean | null
  }

  const memberList = (members as M[]).filter((m) =>
    isEligibleFieldAssignableMember({
      role: m.role,
      status: m.status,
      permission_profile: m.permission_profile,
      permissions_json: m.permissions_json,
      isFieldResource: m.is_field_resource,
    }),
  )
  if (!memberList.length) return []

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
      linkedUserId: uid,
      label,
      avatarUrl: p.avatar_url?.trim() || null,
      roleLabel,
      region,
      fieldStatus,
      membershipLabel,
      assignmentKind: "field_resource",
    })
  }

  out.sort((a, b) => a.label.localeCompare(b.label))
  return out
}

export async function loadTechnicianAssignOptions(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<TechnicianAssignOption[]> {
  let rows: Awaited<ReturnType<typeof listTechniciansForOrg>>
  try {
    rows = await listTechniciansForOrg(supabase, organizationId)
  } catch {
    return loadTechnicianAssignOptionsLegacy(supabase, organizationId)
  }

  if (!rows.length) return loadTechnicianAssignOptionsLegacy(supabase, organizationId)

  const membershipIds = [...new Set(rows.map((r) => r.membership_id).filter(Boolean))] as string[]

  type OmRow = {
    membership_id: string
    user_id: string
    status: string
    role: string
    permission_profile?: string | null
    permissions_json?: unknown
    is_field_resource?: boolean | null
  }
  let omList: OmRow[] = []
  if (membershipIds.length) {
    let r = await supabase
      .from("organization_members")
      .select("membership_id, user_id, status, role, permission_profile, permissions_json, is_field_resource")
      .eq("organization_id", organizationId)
      .in("membership_id", membershipIds)
    if (r.error && isMissingColumnOrSchemaError(r.error)) {
      r = await supabase
        .from("organization_members")
        .select("membership_id, user_id, status, role, permission_profile, permissions_json")
        .eq("organization_id", organizationId)
        .in("membership_id", membershipIds)
    }
    if (r.error && isMissingColumnOrSchemaError(r.error)) {
      r = await supabase
        .from("organization_members")
        .select("membership_id, user_id, status, role")
        .eq("organization_id", organizationId)
        .in("membership_id", membershipIds)
    }
    omList = (r.data ?? []) as OmRow[]
  }
  const omByMembership = new Map(omList.map((o) => [o.membership_id, o]))

  const userIds = [...new Set(omList.map((o) => o.user_id))]
  const profileById = new Map<
    string,
    { id: string; full_name: string | null; email: string | null; avatar_url: string | null }
  >()
  if (userIds.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .in("id", userIds)
    for (const p of (profs ?? []) as Array<{
      id: string
      full_name: string | null
      email: string | null
      avatar_url: string | null
    }>) {
      profileById.set(p.id, p)
    }
  }

  const out: TechnicianAssignOption[] = []
  for (const t of rows) {
    const om = t.membership_id ? omByMembership.get(t.membership_id) : undefined
    if (t.membership_id) {
      if (!om || om.status !== "active") continue
      if (
        !isEligibleFieldAssignableMember({
          role: om.role,
          status: om.status,
          permission_profile: om.permission_profile,
          permissions_json: om.permissions_json,
          isFieldResource: om.is_field_resource,
        })
      ) {
        continue
      }
    }

    const prof = om ? profileById.get(om.user_id) : undefined

    const label =
      (t.full_name && t.full_name.trim()) ||
      (t.email && t.email.trim()) ||
      (prof?.full_name && prof.full_name.trim()) ||
      (prof?.email && prof.email.trim()) ||
      "Technician"

    const roleLabel =
      (t.job_title && t.job_title.trim()) || (om ? formatMemberRole(om.role) : "Technician")

    const region = (t.region && t.region.trim()) || "—"
    const fieldStatus = (t.availability_status && t.availability_status.trim()) || "—"

    let membershipLabel = "Field resource"
    if (om) {
      membershipLabel =
        om.status === "invited" ? "Invite pending" : om.status === "suspended" ? "Suspended" : "Active"
    }

    const avatarUrl =
      (t.avatar_url && t.avatar_url.trim()) || prof?.avatar_url?.trim() || null

    out.push({
      id: t.id,
      linkedUserId: om?.user_id ?? null,
      label,
      avatarUrl,
      roleLabel,
      region,
      fieldStatus,
      membershipLabel,
      assignmentKind: "technician",
    })
  }

  const linkedMemberUserIds = new Set<string>()
  for (const o of omList) {
    if (o.user_id && o.status === "active") linkedMemberUserIds.add(o.user_id)
  }
  for (const opt of out) {
    if (opt.linkedUserId) linkedMemberUserIds.add(opt.linkedUserId)
  }

  const fieldExtras = await buildFieldResourceAssigneeOptions(
    supabase,
    organizationId,
    linkedMemberUserIds,
  )
  const seen = new Set(out.map((r) => r.id))
  for (const extra of fieldExtras) {
    if (!seen.has(extra.id)) {
      seen.add(extra.id)
      out.push(extra)
    }
  }

  out.sort((a, b) => a.label.localeCompare(b.label))
  return out
}
