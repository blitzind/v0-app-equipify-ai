export type TechnicianSkillTagOption = {
  id: string
  organization_id: string
  name: string
  slug: string
  color: string | null
  is_active: boolean
  sort_order: number
  usage_count?: number
}

export const DEFAULT_TECHNICIAN_SKILL_TAGS = [
  "HVAC",
  "Electrical",
  "Calibration",
  "Medical Equipment",
  "Industrial Repair",
  "Installations",
  "Refrigeration",
  "Hydraulics",
  "Welding",
  "PLC / Controls",
] as const

export function slugifySkillTagName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function skillTagOptionNames(
  options: TechnicianSkillTagOption[],
  assigned: string[] = [],
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const name of [
    ...options.filter((tag) => tag.is_active).map((tag) => tag.name),
    ...assigned,
  ]) {
    const trimmed = name.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
  }
  return out
}
