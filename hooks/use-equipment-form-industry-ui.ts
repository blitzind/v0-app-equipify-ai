"use client"

import { useEffect, useMemo, useState } from "react"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { normalizeIndustryKey } from "@/lib/demo-seeding/profiles"
import {
  getEquipmentFormIndustryUi,
  type EquipmentFormIndustryUi,
} from "@/lib/equipment/equipment-form-industry-ui"
import type { WorkspaceIndustryKey } from "@/lib/workspace-industry-registry"

type OrgIndustryRow = { orgId: string; industry: string | null }

/**
 * Loads `organizations.industry` for the active org and returns normalized equipment form UI.
 * Skips refetch when `row` already matches `organizationId`. When `enabled` is false, state is unchanged.
 */
export function useEquipmentFormIndustryUi(
  organizationId: string | null,
  orgReady: boolean,
  enabled: boolean,
): {
  industryKey: WorkspaceIndustryKey
  ui: EquipmentFormIndustryUi
  loading: boolean
} {
  const [row, setRow] = useState<OrgIndustryRow | null>(null)

  useEffect(() => {
    if (!organizationId || !orgReady) {
      setRow(null)
      return
    }
    if (!enabled) return
    if (row?.orgId === organizationId) return

    let cancelled = false
    const supabase = createBrowserSupabaseClient()
    void supabase
      .from("organizations")
      .select("industry")
      .eq("id", organizationId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        setRow({
          orgId: organizationId,
          industry: error ? null : ((data as { industry?: string | null } | null)?.industry ?? null),
        })
      })

    return () => {
      cancelled = true
    }
  }, [organizationId, orgReady, enabled, row?.orgId])

  const industryKey = useMemo((): WorkspaceIndustryKey => {
    if (!organizationId) return normalizeIndustryKey(undefined)
    if (!row || row.orgId !== organizationId) return normalizeIndustryKey(undefined)
    return normalizeIndustryKey(row.industry)
  }, [organizationId, row])

  const ui = useMemo(() => getEquipmentFormIndustryUi(industryKey), [industryKey])

  const loading = Boolean(
    enabled && orgReady && organizationId && (!row || row.orgId !== organizationId),
  )

  return { industryKey, ui, loading }
}
