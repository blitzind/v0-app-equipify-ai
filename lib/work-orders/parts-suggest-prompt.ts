import "server-only"

import type { LoadedWorkOrderDetail } from "@/lib/work-orders/detail-load"
import { buildWorkOrderTechnicianAssistContextJson } from "@/lib/work-orders/technician-assist-prompt"

export type CatalogReferenceRow = {
  id: string
  name: string
  sku: string | null
  partNumber: string | null
  category: string | null
  itemType: string | null
}

/**
 * Staff-only context for parts/tools suggestions. No pricing or financial fields.
 * When `catalogReferenceItems` is omitted, the model must not claim catalog IDs.
 */
export function buildWorkOrderPartsSuggestContextJson(params: {
  detail: LoadedWorkOrderDetail
  catalogReferenceItems?: CatalogReferenceRow[] | null
}): Record<string, unknown> {
  const base = buildWorkOrderTechnicianAssistContextJson({ detail: params.detail })
  const catalog = params.catalogReferenceItems?.length ? params.catalogReferenceItems : undefined
  return {
    ...base,
    role: "parts_and_catalog_suggestions",
    catalogReferenceItems:
      catalog?.map((r) => ({
        catalogItemId: r.id,
        name: r.name,
        sku: r.sku,
        partNumber: r.partNumber,
        category: r.category,
        itemType: r.itemType,
      })) ?? undefined,
  }
}

export function buildWorkOrderPartsSuggestMessages(params: {
  detail: LoadedWorkOrderDetail
  catalogReferenceItems?: CatalogReferenceRow[] | null
}): { system: string; user: string } {
  const ctx = buildWorkOrderPartsSuggestContextJson(params)

  const system = [
    "You suggest parts, tools, and consumables for an equipment field work order.",
    "Return JSON ONLY with key: suggestions (array).",
    "Each suggestion object MUST have:",
    "- name (string): concise label for the part/tool/consumable.",
    "- itemKind: one of part | tool | consumable | other.",
    "- confidence: one of low | medium | high (your certainty this item is relevant).",
    "- reasoning (short string): why it may be needed for this job, grounded in context.",
    "- catalogMatch: null OR an object with catalogItemId (UUID) and optional displayLabel.",
    "Rules:",
    "- Review-only — nothing is ordered, added to the work order, or deducted from stock automatically.",
    "- NEVER include prices, costs, margins, invoice totals, labor rates, or vendor pricing.",
    "- If catalogReferenceItems is present in context, you MAY set catalogMatch.catalogItemId only to an id from that list when there is a clear match. Otherwise catalogMatch must be null.",
    "- If catalogReferenceItems is absent, catalogMatch must always be null.",
    "- Do not invent part numbers, SKUs, or catalog UUIDs.",
    "- Prefer items that fit the equipment category and the reported problem; avoid duplicates of parts already on the work order unless a different quantity or spare is justified.",
    "- Stay within the JSON context; if information is thin, give conservative generic suggestions and lower confidence.",
    "No markdown in strings.",
  ].join("\n")

  const user = ["context_json:", JSON.stringify(ctx)].join("\n")

  return { system, user }
}
