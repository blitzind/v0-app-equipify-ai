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
  getOrgPermissionsForRole,
  hasOrgPermission,
  normalizeOrgMemberRole,
  type OrgMemberRole,
  type OrgPermissionKey,
  type OrgPermissions,
} from "@/lib/permissions/model"

type Status = "loading" | "ready" | "no_org"

type OrgPermissionsContextValue = {
  status: Status
  role: OrgMemberRole | null
  rawRole: string | null
  permissions: OrgPermissions
  has: (key: OrgPermissionKey) => boolean
  refresh: () => Promise<void>
}

const OrgPermissionsContext = createContext<OrgPermissionsContextValue | null>(null)

const DEFAULT_VALUE: OrgPermissionsContextValue = {
  status: "loading",
  role: null,
  rawRole: null,
  permissions: getOrgPermissionsForRole(null),
  has: () => false,
  refresh: async () => {},
}

export function OrgPermissionsProvider({ children }: { children: ReactNode }) {
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const [loadStatus, setLoadStatus] = useState<Status>("loading")
  const [rawRole, setRawRole] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (orgStatus !== "ready" || !organizationId) {
      setLoadStatus("no_org")
      setRawRole(null)
      return
    }

    setLoadStatus("loading")
    const supabase = createBrowserSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setRawRole(null)
      setLoadStatus("ready")
      return
    }

    const { data } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()

    const r = (data as { role?: string } | null)?.role?.trim() ?? null
    setRawRole(r)
    setLoadStatus("ready")
  }, [orgStatus, organizationId])

  useEffect(() => {
    void load()
  }, [load])

  const role = useMemo(() => normalizeOrgMemberRole(rawRole), [rawRole])

  const permissions = useMemo(() => getOrgPermissionsForRole(role), [role])

  const has = useCallback(
    (key: OrgPermissionKey) => hasOrgPermission(permissions, key),
    [permissions],
  )

  const value = useMemo<OrgPermissionsContextValue>(
    () => ({
      status: loadStatus,
      role,
      rawRole,
      permissions,
      has,
      refresh: load,
    }),
    [loadStatus, role, rawRole, permissions, has, load],
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
