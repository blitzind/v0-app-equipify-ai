import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { gatherOrgInsightsContext } from "@/lib/insights/gather-org-context"
import type { OperationalAssistantId } from "./types"

type QuoteStatusCounts = Record<string, number>

async function gatherQuoteSnapshot(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{ totalOpen: number; byStatus: QuoteStatusCounts }> {
  const { data, error } = await supabase
    .from("org_quotes")
    .select("status")
    .eq("organization_id", organizationId)
    .is("archived_at", null)

  if (error || !data?.length) {
    return { totalOpen: 0, byStatus: {} }
  }

  const terminal = new Set(["approved", "declined", "expired"])
  const byStatus: QuoteStatusCounts = {}
  let totalOpen = 0
  for (const row of data) {
    const st = typeof row.status === "string" ? row.status : "draft"
    byStatus[st] = (byStatus[st] ?? 0) + 1
    if (!terminal.has(st)) totalOpen++
  }
  return { totalOpen, byStatus }
}

export type InventoryLowStockLine = {
  catalogItemId: string
  itemName: string
  partNumber: string | null
  locationId: string
  locationName: string
  available: number
  reorderPoint: number | null
  reorderQty: number | null
}

async function gatherInventoryLowStock(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<InventoryLowStockLine[]> {
  const { data: rows, error } = await supabase
    .from("inventory_stock")
    .select(
      "catalog_item_id, location_id, quantity_on_hand, quantity_allocated, reorder_point, reorder_quantity",
    )
    .eq("organization_id", organizationId)
    .not("reorder_point", "is", null)
    .limit(120)

  if (error || !rows?.length) return []

  const alerts = rows.filter((r) => {
    const rp = r.reorder_point != null ? Number(r.reorder_point) : null
    if (rp == null || Number.isNaN(rp)) return false
    const oh = Number(r.quantity_on_hand)
    const al = Number(r.quantity_allocated)
    return oh - al <= rp
  })

  const catIds = [...new Set(alerts.map((r) => r.catalog_item_id as string))]
  const locIds = [...new Set(alerts.map((r) => r.location_id as string))]

  const [{ data: cats }, { data: locs }] = await Promise.all([
    catIds.length ?
      supabase.from("catalog_items").select("id, part_number, name").eq("organization_id", organizationId).in("id", catIds)
    : Promise.resolve({ data: [] as { id: string; part_number?: string; name?: string }[] }),
    locIds.length ?
      supabase.from("inventory_locations").select("id, name").eq("organization_id", organizationId).in("id", locIds)
    : Promise.resolve({ data: [] as { id: string; name?: string }[] }),
  ])

  const cm = new Map((cats ?? []).map((c) => [c.id, c]))
  const lm = new Map((locs ?? []).map((l) => [l.id, l]))

  const out: InventoryLowStockLine[] = alerts.map((r) => {
    const oh = Number(r.quantity_on_hand)
    const al = Number(r.quantity_allocated)
    const cat = cm.get(r.catalog_item_id as string)
    const loc = lm.get(r.location_id as string)
    return {
      catalogItemId: r.catalog_item_id as string,
      itemName: cat?.name ?? "Item",
      partNumber: cat?.part_number ?? null,
      locationId: r.location_id as string,
      locationName: loc?.name ?? "Location",
      available: oh - al,
      reorderPoint: r.reorder_point != null ? Number(r.reorder_point) : null,
      reorderQty: r.reorder_quantity != null ? Number(r.reorder_quantity) : null,
    }
  })

  out.sort((a, b) => a.available - b.available)
  return out.slice(0, 40)
}

/**
 * Builds compact JSON context for the operational assistants router path (no PII dumps).
 */
export async function gatherOperationalAssistantContext(
  supabase: SupabaseClient,
  organizationId: string,
  assistantId: OperationalAssistantId,
): Promise<Record<string, unknown>> {
  const insights = await gatherOrgInsightsContext(supabase, organizationId)

  const base = {
    assistantId,
    insights,
  }

  switch (assistantId) {
    case "dispatch":
      return {
        ...base,
        focus: "dispatch_scheduling",
        schedulingHints: {
          overdueScheduledCount: insights.workOrders.overdueScheduledCount,
          openPipelineCount: insights.workOrders.openPipelineCount,
          byPriority: insights.workOrders.byPriority,
          byStatus: insights.workOrders.byStatus,
        },
      }
    case "maintenance":
      return {
        ...base,
        focus: "maintenance_reliability",
        maintenanceHints: {
          equipmentOverdueNextService: insights.equipment.overdueNextServiceCount,
          maintenancePlansDueOrOverdue: insights.maintenancePlans.dueOrOverdueCount,
          repeatRepairs90d: insights.repeatRepairs90d,
        },
      }
    case "quote": {
      const quotes = await gatherQuoteSnapshot(supabase, organizationId)
      return {
        ...base,
        focus: "quotes_pipeline",
        quotes,
      }
    }
    case "inventory": {
      const lowStockLines = await gatherInventoryLowStock(supabase, organizationId)
      return {
        ...base,
        focus: "inventory_replenishment",
        inventory: {
          lowStockLines,
          lowStockSkuCount: lowStockLines.length,
        },
      }
    }
    case "service_insights":
      return {
        ...base,
        focus: "holistic_operational_snapshot",
      }
  }
}
