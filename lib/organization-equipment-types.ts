export interface EquipmentType {
  id: string
  name: string
  color: string
  icon: string
  description: string
  usageCount: number
  isDefault: boolean
}

export type OrganizationEquipmentTypeRow = {
  id: string
  organization_id: string
  name: string
  description: string
  color: string
  icon: string
  sort_order: number
  is_seed: boolean
  seed_key: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

export function mapEquipmentTypeRows(
  rows: OrganizationEquipmentTypeRow[],
  usageByCategory: Map<string, number>,
): EquipmentType[] {
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    icon: r.icon,
    description: r.description ?? "",
    usageCount: usageByCategory.get(r.name) ?? 0,
    isDefault: r.is_seed,
  }))
}

/** Dropdown values: active configured types, plus current value if legacy/custom string. */
export function equipmentCategorySelectOptions(types: EquipmentType[], currentCategory: string): string[] {
  const names = types.map((t) => t.name)
  const set = new Set(names)
  const v = currentCategory.trim()
  if (v && !set.has(v)) names.push(v)
  return names
}
