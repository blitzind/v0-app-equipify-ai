import { getEquipmentFormIndustryUi } from "@/lib/equipment/equipment-form-industry-ui"
import type { WorkspaceIndustryKey } from "@/lib/workspace-industry-registry"

/** Matches Settings icon picker surface (lucide names). */
const SEED_ICONS = [
  "Thermometer",
  "Snowflake",
  "Zap",
  "Droplets",
  "UtensilsCrossed",
  "Flame",
  "CircuitBoard",
  "ArrowUpDown",
  "Wrench",
  "Settings",
  "Wind",
  "Gauge",
  "Lightbulb",
  "Radio",
  "Cpu",
  "Server",
  "ShieldCheck",
  "AlertTriangle",
  "Power",
  "PcCase",
] as const

const SEED_COLORS = [
  "#2563eb",
  "#0891b2",
  "#0f766e",
  "#16a34a",
  "#d97706",
  "#dc2626",
  "#ea580c",
  "#7c3aed",
  "#db2777",
  "#475569",
] as const

export type OrganizationEquipmentTypeSeedRow = {
  seed_key: string
  name: string
  description: string
  color: string
  icon: string
  sort_order: number
}

function seedKeyForType(industryKey: WorkspaceIndustryKey, displayName: string): string {
  const slug = displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
  return `${industryKey}:${slug || "type"}`
}

/**
 * Industry template rows for `organization_equipment_types` (is_seed=true).
 * Names align with `getEquipmentFormIndustryUi` so Settings and Add Equipment stay consistent with industry UX.
 */
export function buildEquipmentTypeSeedRowsForIndustry(
  industryKey: WorkspaceIndustryKey,
): OrganizationEquipmentTypeSeedRow[] {
  const ui = getEquipmentFormIndustryUi(industryKey)
  return ui.equipmentTypes.map((name, i) => ({
    seed_key: seedKeyForType(industryKey, name),
    name,
    description: "",
    color: SEED_COLORS[i % SEED_COLORS.length]!,
    icon: SEED_ICONS[i % SEED_ICONS.length]!,
    sort_order: (i + 1) * 10,
  }))
}
