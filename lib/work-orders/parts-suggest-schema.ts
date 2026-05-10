import { z } from "zod"

const ITEM_KINDS = ["part", "tool", "consumable", "other"] as const
const CONFIDENCE = ["low", "medium", "high"] as const

function normalizeCatalogMatch(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return null
  const cm = raw as Record<string, unknown>
  const id =
    typeof cm.catalogItemId === "string" ? cm.catalogItemId
    : typeof cm.catalog_item_id === "string" ? cm.catalog_item_id
    : undefined
  const displayLabel =
    typeof cm.displayLabel === "string" ? cm.displayLabel
    : typeof cm.display_label === "string" ? cm.display_label
    : undefined
  if (!id && !displayLabel) return null
  return { catalogItemId: id, displayLabel }
}

function normalizePartsSuggestRaw(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return { suggestions: [] }
  const o = raw as Record<string, unknown>
  const sugRaw = o.suggestions ?? o.suggestion_list
  if (!Array.isArray(sugRaw)) return { suggestions: [] }
  const suggestions = sugRaw.map((item) => {
    if (!item || typeof item !== "object") return null
    const it = item as Record<string, unknown>
    const name = typeof it.name === "string" ? it.name : ""
    const itemKind = it.itemKind ?? it.item_kind
    const confidence = it.confidence
    const reasoning =
      typeof it.reasoning === "string" ? it.reasoning
      : typeof it.rationale === "string" ? it.rationale
      : ""
    const catalogMatch = normalizeCatalogMatch(it.catalogMatch ?? it.catalog_match)
    return { name, itemKind, confidence, reasoning, catalogMatch }
  })
  return { suggestions: suggestions.filter(Boolean) }
}

const catalogMatchShape = z.union([
  z.object({
    catalogItemId: z.string().uuid().optional(),
    displayLabel: z.string().max(220).optional(),
  }),
  z.null(),
])

const suggestionShape = z.object({
  name: z.string().max(220).trim().min(1),
  itemKind: z.preprocess(
    (v) => (typeof v === "string" && ITEM_KINDS.includes(v as (typeof ITEM_KINDS)[number]) ? v : "other"),
    z.enum(ITEM_KINDS),
  ),
  confidence: z.preprocess(
    (v) => (typeof v === "string" && CONFIDENCE.includes(v as (typeof CONFIDENCE)[number]) ? v : "low"),
    z.enum(CONFIDENCE),
  ),
  reasoning: z.string().max(400),
  catalogMatch: z.preprocess((v) => (v === undefined ? null : v), catalogMatchShape),
})

/** Structured output for `work_order_parts_suggest` — review-only parts/tools suggestions. */
export const WorkOrderPartsSuggestAiSchema = z.preprocess(
  normalizePartsSuggestRaw,
  z.object({
    suggestions: z.array(suggestionShape).max(20),
  }),
)

export type WorkOrderPartsSuggestAi = z.infer<typeof WorkOrderPartsSuggestAiSchema>
export type WorkOrderPartsSuggestionItem = WorkOrderPartsSuggestAi["suggestions"][number]

export function formatPartsSuggestionsPlainText(data: WorkOrderPartsSuggestAi): string {
  const lines: string[] = ["=== AI-suggested parts / tools (review only) ===", ""]
  for (const s of data.suggestions) {
    const kind = s.itemKind !== "other" ? ` [${s.itemKind}]` : ""
    const cat =
      s.catalogMatch?.catalogItemId || s.catalogMatch?.displayLabel ?
        ` | catalog: ${s.catalogMatch?.displayLabel ?? s.catalogMatch?.catalogItemId ?? ""}`
      : ""
    lines.push(`• ${s.name.trim()}${kind}`)
    lines.push(`  confidence: ${s.confidence} — ${s.reasoning.trim()}${cat}`)
    lines.push("")
  }
  return lines.join("\n").trim()
}
