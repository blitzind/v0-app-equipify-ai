/**
 * Batch profile fields for assignee pickers (same backing data as Settings → Team).
 * Uses an authenticated API route with service-role reads; avoids RLS gaps on `profiles`.
 */

export type OrgMemberProfileLabelRow = {
  full_name: string | null
  email: string | null
  avatar_url: string | null
}

/** Keys are normalized lowercase user ids for stable map lookup. */
export type OrgMemberProfileLabelsByUserId = Record<string, OrgMemberProfileLabelRow>

const MAX_IDS = 400

export async function fetchOrgMemberProfileLabels(
  organizationId: string,
  userIds: string[],
): Promise<OrgMemberProfileLabelsByUserId> {
  if (!organizationId.trim() || userIds.length === 0) return {}
  const uniq = [...new Set(userIds.map((x) => String(x).trim()).filter(Boolean))]
  if (uniq.length === 0) return {}
  const body = { userIds: uniq.slice(0, MAX_IDS) }
  try {
    const res = await fetch(
      `/api/organizations/${encodeURIComponent(organizationId)}/member-profile-labels`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      },
    )
    if (!res.ok) return {}
    const data = (await res.json().catch(() => ({}))) as { profiles?: OrgMemberProfileLabelsByUserId }
    return data.profiles && typeof data.profiles === "object" ? data.profiles : {}
  } catch {
    return {}
  }
}
