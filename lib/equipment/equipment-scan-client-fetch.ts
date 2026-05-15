import { parseEquipmentScanActionResult } from "@/lib/equipment/equipment-scan-client-parse"

/**
 * POST multipart scan to the org route handler (cookies/session via `credentials: "include"`).
 * Returns parsed JSON body, or throws `Error` with message prefix `EQUIPMENT_SCAN_HTTP:` / `EQUIPMENT_SCAN_BAD_JSON:`.
 */
export async function fetchEquipmentScanViaApi(organizationId: string, formData: FormData): Promise<unknown> {
  const url = `/api/organizations/${encodeURIComponent(organizationId)}/equipment/ai-scan`
  const res = await fetch(url, {
    method: "POST",
    body: formData,
    credentials: "include",
    headers: { Accept: "application/json" },
  })

  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    const snippet = text.slice(0, 160).replace(/\s+/g, " ").trim()
    throw new Error(`EQUIPMENT_SCAN_BAD_JSON:${res.status}:${snippet}`)
  }

  const parsed = parseEquipmentScanActionResult(json)
  if (!res.ok) {
    if (parsed.tag === "err") return json
    throw new Error(`EQUIPMENT_SCAN_HTTP:${res.status}`)
  }
  return json
}
