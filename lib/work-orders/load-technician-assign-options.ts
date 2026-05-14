import type { SupabaseClient } from "@supabase/supabase-js"
import { equipifyDispatchDebugLog, isEquipifyDispatchDebug } from "@/lib/dispatch/dispatch-debug-log"
import { listTechniciansForOrg } from "@/lib/technicians/technician-table"
import {
  queryOrganizationMembersForRoster,
  queryProfilesForAssigneePicker,
} from "@/lib/technicians/roster-queries"
import {
  isAssignableFieldResourceMember,
  isEligibleFieldAssignableMember,
} from "@/lib/work-orders/assignee-eligibility"
import {
  normalizeUserIdKey,
  resolveAssignableDisplayName,
} from "@/lib/work-orders/assignee-display-name"
import { readIsFieldResourceFromOrgMemberRow } from "@/lib/work-orders/org-member-field-resource"
import { normalizeOrgMemberRole } from "@/lib/permissions/model"

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
  'No assignable technicians or field resources. Enable "Can be scheduled for field work" in Team settings or add an active technician.'

/** Dev / `NEXT_PUBLIC_DEBUG_DISPATCH`: shown when members have the field flag but the merged picker is empty. */
export const ASSIGNEE_FILTERED_ELIGIBILITY_DEBUG_HINT =
  "Field resource members were found but filtered out. Check assignee eligibility mapping."

export type TechnicianAssignLoadDiagnostics = {
  organizationIdSuffix: string
  memberRowsCount: number
  ownerRowFound: boolean
  ownerStatus: string | null
  ownerRole: string | null
  ownerIsFieldResourceRawValue: string
  ownerMappedIsFieldResource: string
  ownerEligibilityResult: boolean
  fieldResourceTrueRowCount: number
  eligibleFieldResourceRowCount: number
  finalAssigneeOptionCount: number
}

let lastTechnicianAssignLoadDiagnostics: TechnicianAssignLoadDiagnostics | null = null

export function getLastTechnicianAssignLoadDiagnostics(): TechnicianAssignLoadDiagnostics | null {
  return lastTechnicianAssignLoadDiagnostics
}

function setAssigneeLoadDiagnostics(next: TechnicianAssignLoadDiagnostics | null) {
  lastTechnicianAssignLoadDiagnostics = next
}

function orgSuffix(organizationId: string): string {
  return organizationId.length <= 8 ? organizationId : organizationId.slice(-8)
}

function computeOwnerFieldResourceDiagnostics(
  rawRows: Array<{ user_id: string; role: string; status: string } & Record<string, unknown>>,
): Pick<
  TechnicianAssignLoadDiagnostics,
  | "ownerRowFound"
  | "ownerStatus"
  | "ownerRole"
  | "ownerIsFieldResourceRawValue"
  | "ownerMappedIsFieldResource"
  | "ownerEligibilityResult"
> {
  const owner = rawRows.find((m) => normalizeOrgMemberRole(m.role) === "owner")
  if (!owner) {
    return {
      ownerRowFound: false,
      ownerStatus: null,
      ownerRole: null,
      ownerIsFieldResourceRawValue: "",
      ownerMappedIsFieldResource: "n/a",
      ownerEligibilityResult: false,
    }
  }
  const rec = owner as Record<string, unknown>
  const rawFr = rec.is_field_resource ?? rec.isFieldResource
  let ownerIsFieldResourceRawValue: string
  if (rawFr === undefined) ownerIsFieldResourceRawValue = "undefined"
  else if (rawFr === null) ownerIsFieldResourceRawValue = "null"
  else if (typeof rawFr === "string" || typeof rawFr === "number" || typeof rawFr === "boolean") {
    ownerIsFieldResourceRawValue = String(rawFr)
  } else {
    ownerIsFieldResourceRawValue = "[non-primitive]"
  }
  const mapped = readIsFieldResourceFromOrgMemberRow(rec)
  return {
    ownerRowFound: true,
    ownerStatus: owner.status,
    ownerRole: owner.role,
    ownerIsFieldResourceRawValue,
    ownerMappedIsFieldResource: mapped === undefined ? "undefined" : String(mapped),
    ownerEligibilityResult: isAssignableFieldResourceMember(owner),
  }
}

function formatMemberRole(role: string): string {
  if (!role) return "Member"
  return role.charAt(0).toUpperCase() + role.slice(1)
}

function avatarFromProfileRecord(p: Record<string, unknown> | undefined): string | null {
  if (!p) return null
  const a = p.avatar_url ?? p.avatarUrl
  return typeof a === "string" && a.trim() ? a.trim() : null
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

function buildAssigneeDiagnosticsSnapshot(
  organizationId: string,
  pipeline: {
    memberRowsCount: number
    owner: Pick<
      TechnicianAssignLoadDiagnostics,
      | "ownerRowFound"
      | "ownerStatus"
      | "ownerRole"
      | "ownerIsFieldResourceRawValue"
      | "ownerMappedIsFieldResource"
      | "ownerEligibilityResult"
    >
    fieldResourceTrueRowCount: number
    eligibleFieldResourceRowCount: number
    finalAssigneeOptionCount: number
  },
): TechnicianAssignLoadDiagnostics {
  return {
    organizationIdSuffix: orgSuffix(organizationId),
    memberRowsCount: pipeline.memberRowsCount,
    ownerRowFound: pipeline.owner.ownerRowFound,
    ownerStatus: pipeline.owner.ownerStatus,
    ownerRole: pipeline.owner.ownerRole,
    ownerIsFieldResourceRawValue: pipeline.owner.ownerIsFieldResourceRawValue,
    ownerMappedIsFieldResource: pipeline.owner.ownerMappedIsFieldResource,
    ownerEligibilityResult: pipeline.owner.ownerEligibilityResult,
    fieldResourceTrueRowCount: pipeline.fieldResourceTrueRowCount,
    eligibleFieldResourceRowCount: pipeline.eligibleFieldResourceRowCount,
    finalAssigneeOptionCount: pipeline.finalAssigneeOptionCount,
  }
}

async function buildFieldResourceAssigneeOptions(
  supabase: SupabaseClient,
  organizationId: string,
  linkedMemberUserIds: Set<string>,
): Promise<{
  options: TechnicianAssignOption[]
  stats: {
    activeOrgMemberRowCount: number
    fieldResourceTrueRowCount: number
    eligibleFieldResourceRowCount: number
    owner: Pick<
      TechnicianAssignLoadDiagnostics,
      | "ownerRowFound"
      | "ownerStatus"
      | "ownerRole"
      | "ownerIsFieldResourceRawValue"
      | "ownerMappedIsFieldResource"
      | "ownerEligibilityResult"
    >
  }
}> {
  const emptyOwner = computeOwnerFieldResourceDiagnostics([])
  const emptyStats = {
    activeOrgMemberRowCount: 0,
    fieldResourceTrueRowCount: 0,
    eligibleFieldResourceRowCount: 0,
    owner: emptyOwner,
  }

  const {
    data: members,
    error: memErr,
    rosterColumnsAvailable: omRoster,
  } = await queryOrganizationMembersForRoster(supabase, {
    organizationId,
    statusIn: ["active"],
    roleIn: FIELD_RESOURCE_MEMBER_ROLES,
  })

  if (memErr) {
    equipifyDispatchDebugLog("assignee_field_members_query_error", {
      reason: String(memErr.message ?? "unknown").slice(0, 160),
    })
    return { options: [], stats: emptyStats }
  }
  if (!members?.length) return { options: [], stats: emptyStats }

  type M = {
    user_id: string
    membership_id?: string | null
    role: string
    status: string
    job_title?: string | null
    region?: string | null
    availability_status?: string | null
    permission_profile?: string | null
    permissions_json?: unknown
    is_field_resource?: boolean | null
  }

  const rawRows = members as M[]
  const ownerDiag = computeOwnerFieldResourceDiagnostics(rawRows)
  const activeOrgMemberRowCount = rawRows.length
  const fieldResourceTrueRowCount = rawRows.filter(
    (m) => readIsFieldResourceFromOrgMemberRow(m as Record<string, unknown>) === true,
  ).length

  const memberList = rawRows.filter(
    (m) =>
      !linkedMemberUserIds.has(normalizeUserIdKey(m.user_id)) &&
      isAssignableFieldResourceMember(m as M & Record<string, unknown>),
  )
  const eligibleFieldResourceRowCount = memberList.length

  equipifyDispatchDebugLog("assignee_field_resource_pipeline", {
    activeOrgMemberRowCount,
    fieldResourceTrueRowCount,
    eligibleFieldResourceRowCount,
    linkedExcludedUserCount: linkedMemberUserIds.size,
  })

  if (!memberList.length)
    return {
      options: [],
      stats: {
        activeOrgMemberRowCount,
        fieldResourceTrueRowCount,
        eligibleFieldResourceRowCount: 0,
        owner: ownerDiag,
      },
    }

  const userIds = [...new Set(memberList.map((m) => m.user_id))]
  const { data: profs, error: profErr } = await queryProfilesForAssigneePicker(supabase, userIds)
  if (profErr) {
    equipifyDispatchDebugLog("assignee_field_profiles_query_error", {
      reason: String(profErr.message ?? "unknown").slice(0, 160),
    })
  }

  const profileById = new Map<string, Record<string, unknown>>()
  for (const row of (profs ?? []) as Array<{ id: string } & Record<string, unknown>>) {
    profileById.set(normalizeUserIdKey(row.id), row)
  }
  const memberByUser = new Map(memberList.map((m) => [normalizeUserIdKey(m.user_id), m]))

  const out: TechnicianAssignOption[] = []
  for (const uid of userIds) {
    const p = profileById.get(normalizeUserIdKey(uid))
    const m = memberByUser.get(normalizeUserIdKey(uid))
    if (!m) continue

    const resolved = resolveAssignableDisplayName({
      profile: p ?? null,
      member: m as unknown as Record<string, unknown>,
      fallback: "Team member",
    })
    if (isEquipifyDispatchDebug()) {
      equipifyDispatchDebugLog("assignee_display_name_resolved", {
        source: resolved.source,
        optionId: uid,
        linkedUserId: uid,
        membershipId: String(m.membership_id ?? ""),
        label: resolved.label.slice(0, 80),
      })
    }
    const label = resolved.label

    const roleLabel =
      omRoster && m.job_title?.trim()
        ? m.job_title.trim()
        : formatMemberRole(m.role)

    const region = omRoster && m.region?.trim() ? m.region.trim() : "—"

    const fieldStatus =
      omRoster && m.availability_status?.trim() ? m.availability_status.trim() : "—"

    const membershipLabel =
      m.status === "invited" ? "Invite pending" : m.status === "suspended" ? "Suspended" : "Active"

    const avatarRaw = avatarFromProfileRecord(p)

    out.push({
      id: uid,
      linkedUserId: uid,
      label,
      avatarUrl: avatarRaw,
      roleLabel,
      region,
      fieldStatus,
      membershipLabel: `${membershipLabel} · Field resource`,
      assignmentKind: "field_resource",
    })
  }

  out.sort((a, b) => a.label.localeCompare(b.label))
  if (isEquipifyDispatchDebug()) {
    equipifyDispatchDebugLog("assignee_owner_field_resource_diag", {
      organizationIdSuffix: orgSuffix(organizationId),
      memberRowsCount: activeOrgMemberRowCount,
      ownerRowFound: ownerDiag.ownerRowFound,
      ownerStatus: ownerDiag.ownerStatus,
      ownerRole: ownerDiag.ownerRole,
      ownerIsFieldResourceRawValue: ownerDiag.ownerIsFieldResourceRawValue.slice(0, 48),
      ownerMappedIsFieldResource: ownerDiag.ownerMappedIsFieldResource,
      ownerEligibilityResult: ownerDiag.ownerEligibilityResult,
      eligibleFieldResourceRowCount,
      fieldResourceTrueRowCount,
      finalFieldResourcePickerOutCount: out.length,
    })
  }
  return {
    options: out,
    stats: {
      activeOrgMemberRowCount,
      fieldResourceTrueRowCount,
      eligibleFieldResourceRowCount,
      owner: ownerDiag,
    },
  }
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

  const diagEmpty = () =>
    setAssigneeLoadDiagnostics(
      buildAssigneeDiagnosticsSnapshot(organizationId, {
        memberRowsCount: 0,
        owner: computeOwnerFieldResourceDiagnostics([]),
        fieldResourceTrueRowCount: 0,
        eligibleFieldResourceRowCount: 0,
        finalAssigneeOptionCount: 0,
      }),
    )

  if (memErr) {
    equipifyDispatchDebugLog("assignee_legacy_members_query_error", {
      reason: String(memErr.message ?? "unknown").slice(0, 160),
    })
    diagEmpty()
    return []
  }
  if (!members?.length) {
    diagEmpty()
    return []
  }

  type M = {
    user_id: string
    membership_id?: string | null
    role: string
    status: string
    job_title?: string | null
    region?: string | null
    availability_status?: string | null
    permission_profile?: string | null
    permissions_json?: unknown
    is_field_resource?: boolean | null
  }

  const rawRows = members as M[]
  const ownerDiag = computeOwnerFieldResourceDiagnostics(rawRows)
  const activeOrgMemberRowCount = rawRows.length
  const fieldResourceTrueRowCount = rawRows.filter(
    (m) => readIsFieldResourceFromOrgMemberRow(m as Record<string, unknown>) === true,
  ).length

  const memberList = rawRows.filter((m) => isAssignableFieldResourceMember(m as M & Record<string, unknown>))
  const eligibleFieldResourceRowCount = memberList.length

  if (!memberList.length) {
    equipifyDispatchDebugLog("assignee_loader_pipeline", {
      activeOrgMemberRowCount,
      fieldResourceTrueRowCount,
      eligibleFieldResourceRowCount,
      finalAssigneeOptionCount: 0,
      linkedExcludedUserCount: 0,
    })
    setAssigneeLoadDiagnostics(
      buildAssigneeDiagnosticsSnapshot(organizationId, {
        memberRowsCount: activeOrgMemberRowCount,
        owner: ownerDiag,
        fieldResourceTrueRowCount,
        eligibleFieldResourceRowCount: 0,
        finalAssigneeOptionCount: 0,
      }),
    )
    return []
  }

  const userIds = [...new Set(memberList.map((m) => m.user_id))]
  const { data: profs, error: profErr } = await queryProfilesForAssigneePicker(supabase, userIds)
  if (profErr) {
    equipifyDispatchDebugLog("assignee_legacy_profiles_query_error", {
      reason: String(profErr.message ?? "unknown").slice(0, 160),
    })
  }

  const profileById = new Map<string, Record<string, unknown>>()
  for (const row of (profs ?? []) as Array<{ id: string } & Record<string, unknown>>) {
    profileById.set(normalizeUserIdKey(row.id), row)
  }
  const memberByUser = new Map(memberList.map((m) => [normalizeUserIdKey(m.user_id), m]))

  const out: TechnicianAssignOption[] = []
  for (const uid of userIds) {
    const p = profileById.get(normalizeUserIdKey(uid))
    const m = memberByUser.get(normalizeUserIdKey(uid))
    if (!m) continue

    const resolved = resolveAssignableDisplayName({
      profile: p ?? null,
      member: m as unknown as Record<string, unknown>,
      fallback: "Team member",
    })
    if (isEquipifyDispatchDebug()) {
      equipifyDispatchDebugLog("assignee_display_name_resolved", {
        source: resolved.source,
        optionId: uid,
        linkedUserId: uid,
        membershipId: String(m.membership_id ?? ""),
        label: resolved.label.slice(0, 80),
      })
    }

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
      label: resolved.label,
      avatarUrl: avatarFromProfileRecord(p),
      roleLabel,
      region,
      fieldStatus,
      membershipLabel,
      assignmentKind: "field_resource",
    })
  }

  out.sort((a, b) => a.label.localeCompare(b.label))
  equipifyDispatchDebugLog("assignee_loader_pipeline", {
    activeOrgMemberRowCount,
    fieldResourceTrueRowCount,
    eligibleFieldResourceRowCount,
    finalAssigneeOptionCount: out.length,
    linkedExcludedUserCount: 0,
  })
  equipifyDispatchDebugLog("assignee_options_loaded_legacy", { total: out.length })
  if (isEquipifyDispatchDebug()) {
    equipifyDispatchDebugLog("assignee_owner_field_resource_diag", {
      organizationIdSuffix: orgSuffix(organizationId),
      memberRowsCount: activeOrgMemberRowCount,
      ownerRowFound: ownerDiag.ownerRowFound,
      ownerStatus: ownerDiag.ownerStatus,
      ownerRole: ownerDiag.ownerRole,
      ownerIsFieldResourceRawValue: ownerDiag.ownerIsFieldResourceRawValue.slice(0, 48),
      ownerMappedIsFieldResource: ownerDiag.ownerMappedIsFieldResource,
      ownerEligibilityResult: ownerDiag.ownerEligibilityResult,
      eligibleFieldResourceRowCount,
      fieldResourceTrueRowCount,
      finalFieldResourcePickerOutCount: out.length,
    })
  }
  setAssigneeLoadDiagnostics(
    buildAssigneeDiagnosticsSnapshot(organizationId, {
      memberRowsCount: activeOrgMemberRowCount,
      owner: ownerDiag,
      fieldResourceTrueRowCount,
      eligibleFieldResourceRowCount,
      finalAssigneeOptionCount: out.length,
    }),
  )
  return out
}

export async function loadTechnicianAssignOptions(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<TechnicianAssignOption[]> {
  setAssigneeLoadDiagnostics(null)
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
      .select(
        "organization_id, membership_id, user_id, status, role, permission_profile, permissions_json, is_field_resource",
      )
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
  const profileById = new Map<string, Record<string, unknown>>()
  if (userIds.length) {
    const { data: profs } = await queryProfilesForAssigneePicker(supabase, userIds)
    for (const row of (profs ?? []) as Array<{ id: string } & Record<string, unknown>>) {
      profileById.set(normalizeUserIdKey(row.id), row)
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
          isFieldResource: readIsFieldResourceFromOrgMemberRow(om as Record<string, unknown>),
        })
      ) {
        continue
      }
    }

    const prof = om ? profileById.get(normalizeUserIdKey(om.user_id)) : undefined
    const preTech =
      (t.full_name && t.full_name.trim()) || (t.email && t.email.trim()) || null
    const resolved = resolveAssignableDisplayName({
      profile: prof ?? null,
      member: (om as unknown as Record<string, unknown>) ?? null,
      technicianDisplayName: preTech,
      fallback: "Technician",
    })
    if (isEquipifyDispatchDebug()) {
      equipifyDispatchDebugLog("assignee_display_name_resolved", {
        source: resolved.source,
        optionId: t.id,
        linkedUserId: om?.user_id ?? "",
        membershipId: om?.membership_id ?? "",
        label: resolved.label.slice(0, 80),
      })
    }
    const label = resolved.label

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
      (t.avatar_url && t.avatar_url.trim()) || avatarFromProfileRecord(prof) || null

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
  for (const opt of out) {
    if (opt.linkedUserId) linkedMemberUserIds.add(normalizeUserIdKey(opt.linkedUserId))
  }

  const { options: fieldExtras, stats: fieldStats } = await buildFieldResourceAssigneeOptions(
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
  const fieldResourceMemberCount = out.filter((o) => o.assignmentKind === "field_resource").length
  equipifyDispatchDebugLog("assignee_loader_pipeline", {
    activeOrgMemberRowCount: fieldStats.activeOrgMemberRowCount,
    fieldResourceTrueRowCount: fieldStats.fieldResourceTrueRowCount,
    eligibleFieldResourceRowCount: fieldStats.eligibleFieldResourceRowCount,
    finalAssigneeOptionCount: out.length,
    linkedExcludedUserCount: linkedMemberUserIds.size,
  })
  equipifyDispatchDebugLog("assignee_options_loaded", {
    total: out.length,
    technicians: out.length - fieldResourceMemberCount,
    fieldResourceMembers: fieldResourceMemberCount,
  })
  setAssigneeLoadDiagnostics(
    buildAssigneeDiagnosticsSnapshot(organizationId, {
      memberRowsCount: fieldStats.activeOrgMemberRowCount,
      owner: fieldStats.owner,
      fieldResourceTrueRowCount: fieldStats.fieldResourceTrueRowCount,
      eligibleFieldResourceRowCount: fieldStats.eligibleFieldResourceRowCount,
      finalAssigneeOptionCount: out.length,
    }),
  )
  if (isEquipifyDispatchDebug()) {
    equipifyDispatchDebugLog("assignee_owner_field_resource_diag", {
      organizationIdSuffix: orgSuffix(organizationId),
      memberRowsCount: fieldStats.activeOrgMemberRowCount,
      ownerRowFound: fieldStats.owner.ownerRowFound,
      ownerStatus: fieldStats.owner.ownerStatus,
      ownerRole: fieldStats.owner.ownerRole,
      ownerIsFieldResourceRawValue: fieldStats.owner.ownerIsFieldResourceRawValue.slice(0, 48),
      ownerMappedIsFieldResource: fieldStats.owner.ownerMappedIsFieldResource,
      ownerEligibilityResult: fieldStats.owner.ownerEligibilityResult,
      eligibleFieldResourceRowCount: fieldStats.eligibleFieldResourceRowCount,
      fieldResourceTrueRowCount: fieldStats.fieldResourceTrueRowCount,
      finalAssigneeOptionCount: out.length,
      linkedExcludedUserCount: linkedMemberUserIds.size,
    })
  }
  return out
}
