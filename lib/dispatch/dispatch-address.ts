/**
 * Phase 36 — Map-ready dispatch address metadata and quality hints.
 * No geocoding or external map APIs; lat/lng stay null until real coordinates exist on rows.
 */

import type { DispatchWo } from "@/components/dispatch/dispatch-board"

export type DispatchAddressQuality = "missing" | "partial" | "ready"

export type DispatchAddressAssessment = {
  quality: DispatchAddressQuality
  /** User-facing: Missing address | Partial address | Ready for map */
  label: string
}

/** Normalized inputs from `customer_locations` + equipment fallbacks on `DispatchWo`. */
export type DispatchAddressParts = {
  addressLine1: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  /** Customer site name (`siteLabel` / name · street header). */
  siteLabel: string | null
  /** Equipment / free-text service location when no structured site. */
  serviceLocationLabel: string | null
}

/**
 * Primary human-readable line for cards, tooltips, and future geocode search strings.
 */
export function buildDispatchStopAddressLabel(parts: DispatchAddressParts): string {
  const street = parts.addressLine1?.trim() ?? ""
  const cityStateZip = [
    parts.city?.trim(),
    [parts.state?.trim(), parts.postalCode?.trim()].filter(Boolean).join(" ").trim(),
  ]
    .filter(Boolean)
    .join(", ")
  const structured = [street, cityStateZip].filter(Boolean).join(" · ")
  const site = parts.siteLabel?.trim() ?? ""
  const equip = parts.serviceLocationLabel?.trim() ?? ""

  if (site && structured) return `${site} · ${structured}`
  if (structured) return structured
  if (site) return site
  if (equip) return equip
  return "No address on file"
}

/**
 * Heuristic quality for future maps / geocoding:
 * - ready: street + city + state + postal (from `customer_locations` when linked)
 * - partial: some location text or incomplete structured fields
 * - missing: nothing usable
 */
export function assessDispatchAddressQuality(parts: DispatchAddressParts): DispatchAddressAssessment {
  const street = Boolean(parts.addressLine1?.trim())
  const city = Boolean(parts.city?.trim())
  const state = Boolean(parts.state?.trim())
  const zip = Boolean(parts.postalCode?.trim())
  const site = Boolean(parts.siteLabel?.trim())
  const equip = Boolean(parts.serviceLocationLabel?.trim())

  if (!street && !city && !state && !zip && !site && !equip) {
    return { quality: "missing", label: "Missing address" }
  }
  if (street && city && state && zip) {
    return { quality: "ready", label: "Ready for map" }
  }
  return { quality: "partial", label: "Partial address" }
}

export function dispatchAddressPartsFromWorkOrder(wo: DispatchWo): DispatchAddressParts {
  return {
    addressLine1: wo.addressLine1 ?? null,
    city: wo.city ?? null,
    state: wo.state ?? null,
    postalCode: wo.postalCode ?? null,
    siteLabel: wo.siteLabel ?? null,
    serviceLocationLabel: wo.serviceLocationLabel ?? null,
  }
}

export function assessDispatchAddressQualityForWorkOrder(wo: DispatchWo): DispatchAddressAssessment {
  return assessDispatchAddressQuality(dispatchAddressPartsFromWorkOrder(wo))
}

/** Structured block for JSON export / future geocoder input. */
export type MapReadyStructuredAddress = {
  siteName: string | null
  streetLine: string | null
  city: string | null
  region: string | null
  postalCode: string | null
  /** Reserved until org addresses include country. */
  countryCode: string | null
  latitude: number | null
  longitude: number | null
}

export type MapReadyStopExportEntry = {
  sequence: number
  workOrderId: string
  workOrderNumber: number | null
  customerId: string
  customerName: string
  scheduledOn: string | null
  scheduledTime: string | null
  status: string
  addressQuality: DispatchAddressQuality
  addressQualityLabel: string
  addressSearchLine: string
  structured: MapReadyStructuredAddress
  geocoding: { status: "not_geocoded" }
}

export type TechnicianRouteJsonExport = {
  schemaVersion: 1
  exportedAt: string
  scheduleDate: string
  technician: { id: string; label: string }
  stops: MapReadyStopExportEntry[]
}
