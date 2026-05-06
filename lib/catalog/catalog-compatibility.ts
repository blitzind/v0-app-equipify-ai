import { z } from "zod"

export const catalogCompatibilitySchema = z.object({
  equipment_models: z.array(z.string()).optional(),
  manufacturers: z.array(z.string()).optional(),
  related_catalog_item_ids: z.array(z.string()).optional(),
})

export type CatalogCompatibility = z.infer<typeof catalogCompatibilitySchema>

export function parseCatalogCompatibility(raw: unknown): CatalogCompatibility {
  const parsed = catalogCompatibilitySchema.safeParse(raw)
  if (!parsed.success) return {}
  return parsed.data
}

export function normalizeCatalogCompatibility(patch: Record<string, unknown>): CatalogCompatibility {
  const out: CatalogCompatibility = {}
  const em = patch.equipment_models
  const mf = patch.manufacturers
  const rel = patch.related_catalog_item_ids
  if (Array.isArray(em)) out.equipment_models = em.map((s) => String(s).trim()).filter(Boolean)
  if (Array.isArray(mf)) out.manufacturers = mf.map((s) => String(s).trim()).filter(Boolean)
  if (Array.isArray(rel)) {
    const ids = rel.map((s) => String(s).trim()).filter(Boolean)
    out.related_catalog_item_ids = ids.filter((id) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id),
    )
  }
  return out
}
