import type { CalibrationTemplate, CalibrationTemplateField } from "@/lib/calibration-certificates"
import { defaultValueForField } from "@/lib/calibration-certificates"
import { effectiveWorkOrderNumber, formatWorkOrderDisplay } from "@/lib/work-orders/display"
import type { WorkOrder } from "@/lib/mock-data"

/** Normalize template field labels for matching: lowercase, trim, strip punctuation. */
export function normalizeCertificateFieldLabel(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[\u2019']/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export type CertificatePrefillContext = {
  customerName: string
  /** Site / service address line when full mailing address is unavailable */
  customerAddressOrSite: string
  serviceLocation: string
  equipmentDisplayName: string
  equipmentModelLine: string
  equipmentSerial: string
  equipmentCode: string
  workOrderNumberDisplay: string
  workOrderNumberNumeric: number | null
  technicianName: string
  serviceDateLabel: string
}

export function buildCertificatePrefillContext(wo: WorkOrder): CertificatePrefillContext {
  const site = (wo.location ?? "").trim()
  const n = effectiveWorkOrderNumber(wo)
  const display = formatWorkOrderDisplay(n, wo.id)
  const completed = (wo.completedDate ?? "").trim()
  const scheduled = (wo.scheduledDate ?? "").trim()
  const dateIso = completed || scheduled
  const serviceDateLabel = dateIso
    ? new Date(dateIso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : ""

  return {
    customerName: (wo.customerName ?? "").trim(),
    customerAddressOrSite: site,
    serviceLocation: site,
    equipmentDisplayName: (wo.equipmentName ?? "").trim(),
    equipmentModelLine: (wo.equipmentName ?? "").trim(),
    equipmentSerial: (wo.equipmentSerialNumber ?? "").trim(),
    equipmentCode: (wo.equipmentCode ?? "").trim(),
    workOrderNumberDisplay: display,
    workOrderNumberNumeric: n,
    technicianName: (wo.technicianName ?? "").trim(),
    serviceDateLabel,
  }
}

function isCertificateValueEmpty(field: CalibrationTemplateField, value: unknown): boolean {
  switch (field.type) {
    case "section_heading":
      return true
    case "text":
    case "notes":
      return typeof value !== "string" || value.trim() === ""
    case "number": {
      if (value === "" || value === null || value === undefined) return true
      if (typeof value === "number") return !Number.isFinite(value)
      if (typeof value === "string") return value.trim() === ""
      return false
    }
    case "checkbox":
      return value !== true
    case "pass_fail":
      return value === "pass" || value === undefined || value === null || value === ""
    default:
      return true
  }
}

function prefillValueForField(
  field: CalibrationTemplateField,
  norm: string,
  ctx: CertificatePrefillContext,
): unknown | null {
  const { type } = field
  const textOk = type === "text" || type === "notes"
  const numOk = type === "number"

  const pickStr = (s: string) => (s.trim() ? s.trim() : null)

  if (
    norm === "customer name" ||
    norm === "customer organization" ||
    norm === "company facility"
  ) {
    if (!textOk) return null
    return pickStr(ctx.customerName)
  }

  if (norm === "customer address") {
    if (!textOk) return null
    return pickStr(ctx.customerAddressOrSite) ?? pickStr(ctx.serviceLocation)
  }

  if (norm === "service location") {
    if (!textOk) return null
    return pickStr(ctx.serviceLocation)
  }

  if (norm === "equipment name") {
    if (!textOk) return null
    return pickStr(ctx.equipmentDisplayName)
  }

  if (norm === "equipment") {
    if (!textOk) return null
    return pickStr(ctx.equipmentDisplayName)
  }

  if (norm === "model") {
    if (!textOk) return null
    return pickStr(ctx.equipmentModelLine)
  }

  if (norm === "serial number") {
    if (!textOk) return null
    return pickStr(ctx.equipmentSerial)
  }

  if (norm === "asset number") {
    if (!textOk) return null
    return pickStr(ctx.equipmentCode)
  }

  if (norm === "work order number") {
    if (numOk && ctx.workOrderNumberNumeric != null && Number.isFinite(ctx.workOrderNumberNumeric)) {
      return ctx.workOrderNumberNumeric
    }
    if (textOk) return pickStr(ctx.workOrderNumberDisplay)
    return null
  }

  if (norm === "technician") {
    if (!textOk) return null
    return pickStr(ctx.technicianName)
  }

  if (norm === "service date" || norm === "date") {
    if (!textOk) return null
    return pickStr(ctx.serviceDateLabel)
  }

  return null
}

export function applyWorkOrderPrefillToCertificateValues(args: {
  template: CalibrationTemplate
  values: Record<string, unknown>
  context: CertificatePrefillContext
  touchedFieldIds?: ReadonlySet<string>
}): { next: Record<string, unknown>; prefilledFieldIds: string[] } {
  const prefilledFieldIds: string[] = []
  const next = { ...args.values }

  for (const field of args.template.fields) {
    if (field.type === "section_heading") continue
    if (args.touchedFieldIds?.has(field.id)) continue

    const current = next[field.id]
    if (!isCertificateValueEmpty(field, current)) continue

    const norm = normalizeCertificateFieldLabel(field.label)
    const v = prefillValueForField(field, norm, args.context)
    if (v == null) continue
    if (typeof v === "string" && v === "") continue

    next[field.id] = v
    prefilledFieldIds.push(field.id)
  }

  return { next, prefilledFieldIds }
}

export type SeedCertificateValuesResult = {
  values: Record<string, unknown>
  hadPrefill: boolean
}

/** Compare certificate value maps for unsaved-change detection (sorted keys, JSON-stable). */
export function certificateFieldMapsEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()
  const norm = (raw: Record<string, unknown>) =>
    keys.reduce<Record<string, unknown>>((acc, k) => {
      acc[k] = raw[k]
      return acc
    }, {})
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b))
}

export function seedCertificateValuesForWorkOrder(
  template: CalibrationTemplate | null,
  existing: Record<string, unknown> | null,
  context: CertificatePrefillContext | null,
  options?: { touchedFieldIds?: ReadonlySet<string> },
): SeedCertificateValuesResult {
  if (!template) {
    return { values: {}, hadPrefill: false }
  }

  const base: Record<string, unknown> = {}
  for (const field of template.fields) {
    if (field.type === "section_heading") continue
    base[field.id] = defaultValueForField(field.type)
  }

  if (existing) {
    for (const [k, v] of Object.entries(existing)) {
      base[k] = v
    }
  }

  if (!context) {
    return { values: base, hadPrefill: false }
  }

  const { next, prefilledFieldIds } = applyWorkOrderPrefillToCertificateValues({
    template,
    values: base,
    context,
    touchedFieldIds: options?.touchedFieldIds,
  })

  return {
    values: next,
    hadPrefill: prefilledFieldIds.length > 0,
  }
}
