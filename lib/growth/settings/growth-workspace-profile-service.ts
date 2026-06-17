import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import {
  getWorkspacePreferencesForUser,
  upsertWorkspacePreferencesForUser,
} from "@/lib/growth/settings/growth-workspace-settings-repository"
import type {
  GrowthWorkspaceSettingsProfile,
  GrowthWorkspaceSettingsProfilePatch,
} from "@/lib/growth/settings/growth-workspace-settings-types"

function splitDisplayName(full: string | null | undefined): { firstName: string; lastName: string } {
  const trimmed = (full ?? "").trim()
  if (!trimmed) return { firstName: "", lastName: "" }
  const index = trimmed.indexOf(" ")
  if (index === -1) return { firstName: trimmed, lastName: "" }
  return { firstName: trimmed.slice(0, index), lastName: trimmed.slice(index + 1).trim() }
}

function joinDisplayName(displayName: string): string | null {
  const trimmed = displayName.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function resolveGrowthWorkspaceSettingsOrganizationId(): string | null {
  return getGrowthEngineAiOrgId()
}

export async function loadGrowthWorkspaceSettingsProfile(
  admin: SupabaseClient,
  userId: string,
  userEmail: string,
): Promise<GrowthWorkspaceSettingsProfile> {
  const organizationId = resolveGrowthWorkspaceSettingsOrganizationId()

  const [{ data: profile, error: profileError }, workspacePrefs] = await Promise.all([
    admin.from("profiles").select("full_name, avatar_url, email").eq("id", userId).maybeSingle(),
    getWorkspacePreferencesForUser(admin, userId),
  ])

  if (profileError) throw new Error(profileError.message)

  const profileRow = profile as {
    full_name: string | null
    avatar_url: string | null
    email: string | null
  } | null

  let jobTitle = ""
  if (organizationId) {
    const { data: member } = await admin
      .from("organization_members")
      .select("job_title")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle()
    jobTitle = (member as { job_title?: string | null } | null)?.job_title ?? ""
  }

  return {
    userId,
    displayName: (profileRow?.full_name ?? "").trim(),
    jobTitle: (jobTitle ?? "").trim(),
    timezone: workspacePrefs?.timezone ?? "UTC",
    avatarUrl: (profileRow?.avatar_url ?? "").trim(),
    email: (profileRow?.email ?? userEmail).trim(),
  }
}

export async function patchGrowthWorkspaceSettingsProfile(
  admin: SupabaseClient,
  userId: string,
  userEmail: string,
  patch: GrowthWorkspaceSettingsProfilePatch,
): Promise<GrowthWorkspaceSettingsProfile> {
  const organizationId = resolveGrowthWorkspaceSettingsOrganizationId()

  if (patch.displayName !== undefined) {
    const fullName = joinDisplayName(patch.displayName)
    if (fullName && fullName.length > 200) {
      throw new Error("Display name must be at most 200 characters.")
    }
    const { error } = await admin
      .from("profiles")
      .update({ full_name: fullName, updated_at: new Date().toISOString() })
      .eq("id", userId)
    if (error) throw new Error(error.message)
  }

  if (patch.avatarUrl !== undefined) {
    const avatarUrl = patch.avatarUrl?.trim() || null
    const { error } = await admin
      .from("profiles")
      .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
      .eq("id", userId)
    if (error) throw new Error(error.message)
  }

  if (patch.jobTitle !== undefined) {
    if (!organizationId) {
      throw new Error("Organization context is required to update job title.")
    }
    const jobTitle = patch.jobTitle.trim().slice(0, 200)
    const { data: member } = await admin
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle()
    if (!member) throw new Error("You are not an active member of this organization.")
    const { error } = await admin
      .from("organization_members")
      .update({
        job_title: jobTitle.length > 0 ? jobTitle : null,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
    if (error) throw new Error(error.message)
  }

  if (patch.timezone !== undefined) {
    await upsertWorkspacePreferencesForUser(admin, userId, { timezone: patch.timezone.trim() || "UTC" })
  }

  return loadGrowthWorkspaceSettingsProfile(admin, userId, userEmail)
}

export { splitDisplayName, joinDisplayName }
