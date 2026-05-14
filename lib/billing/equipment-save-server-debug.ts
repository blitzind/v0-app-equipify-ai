/**
 * Server-oriented diagnostics for equipment create / billing gates (no secrets).
 * Safe to import from shared modules: no-ops unless `EQUIPMENT_SAVE_SERVER_DEBUG` is set.
 */
export function isEquipmentSaveServerDebug(): boolean {
  const v = process.env.EQUIPMENT_SAVE_SERVER_DEBUG
  return v === "1" || v === "true"
}

export function equipmentSaveServerDebug(
  stage: string,
  details: { helper?: string; organizationId?: string; message?: string },
): void {
  if (!isEquipmentSaveServerDebug()) return
  const org = details.organizationId
  const organizationIdSuffix = org && org.length > 8 ? org.slice(-8) : org ?? ""
  const payload = {
    stage,
    helper: details.helper ?? "",
    organizationIdSuffix,
    message: (details.message ?? "").slice(0, 220),
  }
  console.info("[equipify:equipment-save-server]", JSON.stringify(payload))
}
