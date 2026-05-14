import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeUserIdKey, resolveAssignableDisplayName } from "@/lib/work-orders/assignee-display-name"
import { fetchOrgMemberProfileLabels } from "@/lib/work-orders/fetch-org-member-profile-labels"
import { teamMemberSettingsListLabel } from "@/lib/team/team-member-display-label"

export const WO_ASSIGNEE_FALLBACK_LABEL = "Team member"
export const WO_ASSIGNEE_UNASSIGNED_LABEL = "Unassigned"

function profileRecordFromDto(
  p: { full_name: string | null; email: string | null; avatar_url: string | null } | null | undefined,
): Record<string, unknown> | null {
  if (!p) return null
  return {
    full_name: p.full_name,
    email: p.email,
    avatar_url: p.avatar_url,
  }
}

/** Prefer non-empty fields from `prefer` (e.g. service-backed API), then `base` (e.g. direct Supabase read). */
function mergeProfilePreferService(
  base: Record<string, unknown> | null,
  prefer: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!base && !prefer) return null
  function pick(key: "full_name" | "email" | "avatar_url"): string | null {
    const a = prefer?.[key]
    const b = base?.[key]
    const as = typeof a === "string" ? a.trim() : ""
    if (as) return as
    const bs = typeof b === "string" ? b.trim() : ""
    return bs || null
  }
  return {
    full_name: pick("full_name"),
    email: pick("email"),
    avatar_url: pick("avatar_url"),
  }
}

/**
 * Batch-resolve display labels for `work_orders.assigned_user_id` values in the browser.
 * Uses the same service-backed profile read as Assign Technician / dispatch roster.
 */
export async function batchHydrateAssigneeLabelsByUserId(
  organizationId: string,
  userIds: string[],
): Promise<Map<string, { label: string; avatarUrl: string | null }>> {
  const out = new Map<string, { label: string; avatarUrl: string | null }>()
  if (!organizationId.trim() || userIds.length === 0) return out
  if (typeof window === "undefined") return out

  const hydrated = await fetchOrgMemberProfileLabels(organizationId, userIds)
  for (const rawId of userIds) {
    const id = String(rawId).trim()
    if (!id) continue
    const row = hydrated[normalizeUserIdKey(id)]
    if (!row) continue
    out.set(id, {
      label: teamMemberSettingsListLabel(row.full_name, row.email),
      avatarUrl: row.avatar_url?.trim() || null,
    })
  }
  return out
}

export type WorkOrderAssigneeDirectProfile = {
  full_name: string | null
  email: string | null
  avatar_url: string | null
} | null

/**
 * Resolve drawer/list/card technician display for a work order row.
 * Priority: `assigned_user_id` (hydrated org member / profile) → `assigned_technician_id` (technicians row) →
 * {@link WO_ASSIGNEE_UNASSIGNED_LABEL} when both absent.
 */
export async function resolveWorkOrderAssigneeUiFields(args: {
  organizationId: string
  supabase: SupabaseClient
  assignedUserId: string | null
  assignedTechnicianId: string | null
  /** Optional `profiles` read from caller's Supabase client (may be incomplete under RLS). */
  directProfile: WorkOrderAssigneeDirectProfile
}): Promise<{
  technicianId: string
  technicianName: string
  technicianAvatarUrl: string | null
}> {
  const uid = args.assignedUserId?.trim() || null
  const tid = args.assignedTechnicianId?.trim() || null

  if (!uid && !tid) {
    return {
      technicianId: "unassigned",
      technicianName: WO_ASSIGNEE_UNASSIGNED_LABEL,
      technicianAvatarUrl: null,
    }
  }

  let technicianRow: { full_name: string | null; email: string | null; avatar_url: string | null } | null = null
  if (tid) {
    const tRes = await args.supabase
      .from("technicians")
      .select("full_name, email, avatar_url")
      .eq("organization_id", args.organizationId)
      .eq("id", tid)
      .maybeSingle()
    if (!tRes.error && tRes.data) {
      technicianRow = tRes.data as typeof technicianRow
    }
  }

  let memberRow: Record<string, unknown> | null = null
  if (uid) {
    const mRes = await args.supabase
      .from("organization_members")
      .select("user_id, role, job_title, status")
      .eq("organization_id", args.organizationId)
      .eq("user_id", uid)
      .maybeSingle()
    if (!mRes.error && mRes.data) {
      memberRow = mRes.data as Record<string, unknown>
    }
  }

  let mergedProfile = profileRecordFromDto(args.directProfile)
  if (uid && typeof window !== "undefined") {
    const h = await fetchOrgMemberProfileLabels(args.organizationId, [uid])
    const apiRow = h[normalizeUserIdKey(uid)]
    mergedProfile = mergeProfilePreferService(mergedProfile, profileRecordFromDto(apiRow ?? null))
  }

  const techDisplay = technicianRow
    ? teamMemberSettingsListLabel(technicianRow.full_name, technicianRow.email)
    : null

  const resolved = resolveAssignableDisplayName({
    profile: mergedProfile,
    member: memberRow,
    technicianDisplayName: techDisplay,
    fallback: uid || tid ? WO_ASSIGNEE_FALLBACK_LABEL : WO_ASSIGNEE_UNASSIGNED_LABEL,
  })

  const technicianId = uid ?? tid ?? "unassigned"

  let technicianAvatarUrl: string | null = null
  const av = mergedProfile?.avatar_url
  if (typeof av === "string" && av.trim()) {
    technicianAvatarUrl = av.trim()
  } else if (technicianRow?.avatar_url?.trim()) {
    technicianAvatarUrl = technicianRow.avatar_url.trim()
  }

  return {
    technicianId,
    technicianName: resolved.label,
    technicianAvatarUrl,
  }
}
