"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import {
  getEffectiveOrgPermissions,
  getOrgPermissionsForRole,
  hasOrgPermission,
  normalizeOrgMemberRole,
  normalizePermissionProfile,
  type CommercialPermissionProfile,
  type OrgMemberRole,
  type OrgPermissionKey,
  type OrgPermissions,
} from "@/lib/permissions/model"

type Status = "loading" | "ready" | "no_org"

type OrgPermissionsContextValue = {
  status: Status
  role: OrgMemberRole | null
  rawRole: string | null
  permissionProfile: CommercialPermissionProfile | null
  permissions: OrgPermissions
  has: (key: OrgPermissionKey) => boolean
  refresh: () => Promise<void>
}

const OrgPermissionsContext = createContext<OrgPermissionsContextValue | null>(null)

const DEFAULT_VALUE: OrgPermissionsContextValue = {
  status: "loading",
  role: null,
  rawRole: null,
  permissionProfile: null,
  permissions: getOrgPermissionsForRole(null),
  has: () => false,
  refresh: async () => {},
}

export function OrgPermissionsProvider({ children }: { children: ReactNode }) {
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const [loadStatus, setLoadStatus] = useState<Status>("loading")
  const [rawRole, setRawRole] = useState<string | null>(null)
  const [rawProfile, setRawProfile] = useState<string | null>(null)
  const [permissionsJson, setPermissionsJson] = useState<unknown>(null)

  const load = useCallback(async () => {
    if (!organizationId) {
      setLoadStatus("no_org")
      setRawRole(null)
      setRawProfile(null)
      setPermissionsJson(null)
      return
    }

    if (orgStatus !== "ready") {
      // Wait for ActiveOrganizationProvider to finish (e.g. support-session restore) without
      // flipping to no_org — that state was clearing effective role during hydration.
      setLoadStatus("loading")
      setRawRole(null)
      setRawProfile(null)
      setPermissionsJson(null)
      return
    }

    setLoadStatus("loading")
    const supabase = createBrowserSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setRawRole(null)
      setRawProfile(null)
      setPermissionsJson(null)
      setLoadStatus("ready")
      return
    }

    const { data } = await supabase
      .from("organization_members")
      .select("role, permission_profile, permissions_json")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()

    let r = (data as { role?: string } | null)?.role?.trim() ?? null
    let p = (data as { permission_profile?: string | null } | null)?.permission_profile?.trim() ?? null
    let j = (data as { permissions_json?: unknown } | null)?.permissions_json ?? null

    if (!r) {
      try {
        const res = await fetch("/api/platform/support-session", { cache: "no-store" })
        const d = (await res.json()) as {
          active?: boolean
          organizationId?: string
        }
        if (d.active && d.organizationId === organizationId) {
          r = "owner"
          p = null
          j = null
        }
      } catch {
        /* ignore */
      }
    }

    setRawRole(r)
    setRawProfile(p)
    setPermissionsJson(j)
    setLoadStatus("ready")
  }, [orgStatus, organizationId])

  useEffect(() => {
    void load()
  }, [load])

  const role = useMemo(() => normalizeOrgMemberRole(rawRole), [rawRole])
  const permissionProfile = useMemo(() => normalizePermissionProfile(rawProfile), [rawProfile])

  const permissions = useMemo(
    () =>
      getEffectiveOrgPermissions({
        role,
        permissionProfile,
        permissionsJson,
      }),
    [role, permissionProfile, permissionsJson],
  )

  const has = useCallback(
    (key: OrgPermissionKey) => hasOrgPermission(permissions, key),
    [permissions],
  )

  const value = useMemo<OrgPermissionsContextValue>(
    () => ({
      status: loadStatus,
      role,
      rawRole,
      permissionProfile,
      permissions,
      has,
      refresh: load,
    }),
    [loadStatus, role, rawRole, permissionProfile, permissions, has, load],
  )

  return <OrgPermissionsContext.Provider value={value}>{children}</OrgPermissionsContext.Provider>
}

export function useOrgPermissions(): OrgPermissionsContextValue {
  const ctx = useContext(OrgPermissionsContext)
  if (!ctx) {
    throw new Error("useOrgPermissions must be used within OrgPermissionsProvider")
  }
  return ctx
}

/** Safe when the provider is absent (e.g. Storybook). */
export function useOrgPermissionsOptional(): OrgPermissionsContextValue | null {
  return useContext(OrgPermissionsContext)
}

/** SSR / tests fallback — deny-all. */
export function getOrgPermissionsFallback(): OrgPermissionsContextValue {
  return DEFAULT_VALUE
}
