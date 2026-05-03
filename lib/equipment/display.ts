/**
 * Human-facing equipment labels. UUID `id` is for routing/data only — never show in UI copy.
 */

export type EquipmentDisplayFields = {
  id: string
  name: string
  equipment_code?: string | null
  serial_number?: string | null
  category?: string | null
}

function trim(s: string | null | undefined): string {
  return (s ?? "").trim()
}

/** Fallback when code, serial, and name are unusable (name is NOT NULL in DB; kept for safety). */
export function shortAssetCodeFromUuid(id: string): string {
  const compact = id.replace(/-/g, "")
  let h = 0
  for (let i = 0; i < compact.length; i++) {
    h = (h * 31 + compact.charCodeAt(i)) >>> 0
  }
  const num = (h % 9_000_000) + 1_000_000
  return `AST-${num}`
}

export function getEquipmentReference(eq: EquipmentDisplayFields): string {
  const code = trim(eq.equipment_code)
  if (code) return code
  const serial = trim(eq.serial_number)
  if (serial) return serial
  const name = trim(eq.name)
  if (name) return name
  return shortAssetCodeFromUuid(eq.id)
}

/** e.g. `55896-887 — Rooftop Unit` or `Rooftop Unit` when only a name exists. */
export function getEquipmentDisplayPrimary(eq: EquipmentDisplayFields): string {
  const name = trim(eq.name) || "Equipment"
  const code = trim(eq.equipment_code)
  const serial = trim(eq.serial_number)
  const refToken = code || serial
  if (refToken && refToken !== name) return `${refToken} — ${name}`
  return name || getEquipmentReference(eq)
}

/** `Equipment name / Customer / Type` */
export function getEquipmentSecondaryLine(
  eq: EquipmentDisplayFields,
  customerName?: string | null,
): string {
  const name = trim(eq.name) || "Equipment"
  const cust = trim(customerName)
  const type = trim(eq.category) || "—"
  return [name, cust || "—", type].join(" / ")
}

export function equipmentMatchesSearch(
  queryRaw: string,
  eq: EquipmentDisplayFields,
  customerName?: string | null,
): boolean {
  const q = queryRaw.trim().toLowerCase()
  if (!q) return true
  const id = eq.id.toLowerCase()
  const idCompact = id.replace(/-/g, "")
  const qCompact = q.replace(/-/g, "")
  if (id.includes(q) || (q.length >= 6 && idCompact.includes(qCompact))) return true

  const hay = [
    eq.name,
    eq.equipment_code,
    eq.serial_number,
    eq.category,
    customerName,
    getEquipmentDisplayPrimary(eq),
    getEquipmentReference(eq),
  ]
    .map((x) => trim(String(x ?? "")).toLowerCase())
    .join(" ")

  return hay.includes(q) || hay.split(/\s+/).some((w) => w.length > 0 && w.includes(q))
}
