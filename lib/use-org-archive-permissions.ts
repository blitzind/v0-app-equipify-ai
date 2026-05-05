"use client"

import { useCallback, useEffect, useState } from "react"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"

const MANAGER_ROLES = new Set(["owner", "admin", "manager"])

/**
 * Whether the current user may archive/restore tenant records (matches RLS on most CRM tables).
 */
export function useOrgArchivePermissions() {
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const [role, setRole] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (orgStatus !== "ready" || !organizationId) {
      setRole(null)
      return
    }
    const supabase = createBrowserSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setRole(null)
      return
    }
    const { data } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()
    const r = (data as { role?: string } | null)?.role ?? null
    setRole(r)
  }, [orgStatus, organizationId])

  useEffect(() => {
    void load()
  }, [load])

  const canArchiveRestore = Boolean(role && MANAGER_ROLES.has(role))

  return { role, canArchiveRestore, refresh: load }
}
