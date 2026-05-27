import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { loadCompanyGrowthSignalsSnapshot } from "@/lib/growth/company-growth-signals/growth-signal-repository"
import { isGrowthCompanyGrowthSignalsSchemaReady } from "@/lib/growth/company-growth-signals/company-growth-signal-schema-health"
import type { GrowthCompanyGrowthSignalsSnapshot } from "@/lib/growth/company-growth-signals/company-growth-signal-types"
import { applyGrowthSignalsToCompanyResult } from "@/lib/growth/company-growth-signals/integrations/prospect-search-growth-signals-overlay"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"

export { applyGrowthSignalsToCompanyResult } from "@/lib/growth/company-growth-signals/integrations/prospect-search-growth-signals-overlay"

export async function loadProspectSearchGrowthSignalsBatch(
  admin: SupabaseClient,
  companyIds: string[],
): Promise<Map<string, GrowthCompanyGrowthSignalsSnapshot>> {
  const map = new Map<string, GrowthCompanyGrowthSignalsSnapshot>()
  if (companyIds.length === 0) return map
  if (!(await isGrowthCompanyGrowthSignalsSchemaReady(admin))) return map

  await Promise.all(
    companyIds.map(async (companyId) => {
      const snapshot = await loadCompanyGrowthSignalsSnapshot(admin, companyId)
      map.set(companyId, snapshot)
    }),
  )
  return map
}

export async function applyProspectSearchGrowthSignalsOverlay(
  admin: SupabaseClient,
  companies: GrowthProspectSearchCompanyResult[],
): Promise<GrowthProspectSearchCompanyResult[]> {
  if (companies.length === 0) return companies
  const snapshots = await loadProspectSearchGrowthSignalsBatch(
    admin,
    companies.map((company) => company.id),
  )
  return companies.map((company) => applyGrowthSignalsToCompanyResult(company, snapshots.get(company.id)))
}
