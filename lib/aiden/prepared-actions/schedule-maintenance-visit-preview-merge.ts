import { z } from "zod"
import type { ScheduleMaintenanceVisitPreviewPayload } from "@/lib/aiden/actions/resolvers/schedule-maintenance-visit-types"

const workOrderTypeEnum = z.enum(["Repair", "PM", "Inspection", "Install", "Emergency"])
const workOrderPriorityEnum = z.enum(["Low", "Normal", "High", "Critical"])

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const customerSchema = z.object({
  id: z.string().regex(UUID_RE),
  companyName: z.string().min(1).max(500),
  billingAddressLine1: z.string().max(500).nullable(),
  billingCity: z.string().max(200).nullable(),
  billingState: z.string().max(50).nullable(),
  billingPostalCode: z.string().max(30).nullable(),
})

const equipmentSchema = z.object({
  id: z.string().regex(UUID_RE),
  name: z.string().min(1).max(500),
  serialNumber: z.string().max(200).nullable(),
})

const previewSchema = z.object({
  customer: customerSchema,
  locationSummary: z.string().max(1000),
  equipment: equipmentSchema.nullable(),
  serviceTypeUi: workOrderTypeEnum,
  priorityUi: workOrderPriorityEnum,
  serviceReason: z.string().max(4000),
  durationMinutes: z.union([z.number().int().min(15).max(960), z.null()]).optional(),
  suggestedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  suggestedTime: z.string().regex(/^\d{1,2}:\d{2}$/),
  dateSuggested: z.boolean(),
  technicianSelectionId: z.union([z.string().regex(UUID_RE), z.literal(""), z.null()]).optional(),
  technicianLabel: z.string().max(300).nullable().optional(),
  notes: z.string().max(12_000),
  maintenancePlanId: z.union([z.string().regex(UUID_RE), z.literal(""), z.null()]).optional(),
})

function normalizePreview(p: z.infer<typeof previewSchema>): ScheduleMaintenanceVisitPreviewPayload {
  const tid =
    p.technicianSelectionId === "" || p.technicianSelectionId === null || p.technicianSelectionId === undefined ?
      null
    : p.technicianSelectionId
  const mp =
    p.maintenancePlanId === "" || p.maintenancePlanId === null || p.maintenancePlanId === undefined ?
      null
    : p.maintenancePlanId
  const [hh, mm] = p.suggestedTime.split(":").map((x) => Number.parseInt(x, 10))
  const safeH = Number.isFinite(hh) ? Math.min(23, Math.max(0, hh)) : 8
  const safeM = Number.isFinite(mm) ? Math.min(59, Math.max(0, mm)) : 0
  const timeNorm = `${String(safeH).padStart(2, "0")}:${String(safeM).padStart(2, "0")}`
  return {
    customer: p.customer,
    locationSummary: p.locationSummary.trim(),
    equipment: p.equipment,
    serviceTypeUi: p.serviceTypeUi,
    priorityUi: p.priorityUi,
    serviceReason: p.serviceReason.trim(),
    durationMinutes: p.durationMinutes ?? null,
    suggestedDate: p.suggestedDate,
    suggestedTime: timeNorm,
    dateSuggested: p.dateSuggested,
    technicianSelectionId: tid,
    technicianLabel: p.technicianLabel ?? null,
    notes: p.notes,
    maintenancePlanId: mp,
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

export function mergeAndValidateScheduleMaintenanceVisitPreviewForPatch(
  storedPreviewPayload: Record<string, unknown>,
  body: unknown,
): { ok: true; previewPayload: Record<string, unknown> } | { ok: false; message: string } {
  const existing = storedPreviewPayload.preview
  if (!isRecord(existing)) return { ok: false, message: "Stored preview is missing." }

  let patch: Record<string, unknown> = {}
  if (isRecord(body) && isRecord(body.preview)) {
    patch = body.preview as Record<string, unknown>
  } else if (isRecord(body)) {
    patch = body
  }

  const merged = {
    ...existing,
    ...patch,
    customer: isRecord(patch.customer) ? { ...(isRecord(existing.customer) ? existing.customer : {}), ...patch.customer } : existing.customer,
    equipment:
      patch.equipment === null ? null
      : isRecord(patch.equipment) ?
        { ...(isRecord(existing.equipment) ? existing.equipment : {}), ...patch.equipment }
      : existing.equipment,
  }

  const parsed = previewSchema.safeParse(merged)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ") || "Invalid preview."
    return { ok: false, message: msg }
  }

  const normalized = normalizePreview(parsed.data)
  return { ok: true, previewPayload: { preview: normalized } }
}
