import { z } from "zod"
import type { CreateMaintenancePlanFromEquipmentPreviewPayload } from "@/lib/aiden/actions/resolvers/create-maintenance-plan-from-equipment-types"

const planIntervalEnum = z.enum(["Annual", "Semi-Annual", "Quarterly", "Monthly", "Custom"])
const workOrderTypeEnum = z.enum(["Repair", "PM", "Inspection", "Install", "Emergency"])
const workOrderPriorityEnum = z.enum(["Low", "Normal", "High", "Critical"])

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const customerSchema = z.object({
  id: z.string().regex(UUID_RE),
  companyName: z.string().min(1).max(500),
})

const equipmentSchema = z.object({
  id: z.string().regex(UUID_RE),
  name: z.string().min(1).max(500),
  serialNumber: z.string().max(200).nullable(),
  category: z.string().max(200).nullable(),
  location: z.string().max(500).nullable(),
})

const previewSchema = z.object({
  customer: customerSchema,
  equipment: equipmentSchema,
  planName: z.string().min(2).max(500),
  intervalUi: planIntervalEnum,
  customIntervalDays: z.number().int().min(0).max(3650),
  nextDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lastServiceDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()]),
  serviceScope: z.string().min(3).max(4000),
  estimatedDurationMinutes: z.union([z.number().int().min(15).max(960), z.null()]).optional(),
  workOrderTypeUi: workOrderTypeEnum,
  workOrderPriorityUi: workOrderPriorityEnum,
  preferredServiceTime: z.string().regex(/^\d{1,2}:\d{2}$/),
  technicianSelectionId: z.union([z.string().regex(UUID_RE), z.literal(""), z.null()]).optional(),
  technicianLabel: z.string().max(300).nullable().optional(),
  autoCreateWorkOrder: z.boolean(),
  notes: z.string().max(12_000),
})

function normalizePreview(p: z.infer<typeof previewSchema>): CreateMaintenancePlanFromEquipmentPreviewPayload {
  const tid =
    p.technicianSelectionId === "" || p.technicianSelectionId === null || p.technicianSelectionId === undefined ?
      null
    : p.technicianSelectionId
  const [hh, mm] = p.preferredServiceTime.split(":").map((x) => Number.parseInt(x, 10))
  const safeH = Number.isFinite(hh) ? Math.min(23, Math.max(0, hh)) : 8
  const safeM = Number.isFinite(mm) ? Math.min(59, Math.max(0, mm)) : 0
  const timeNorm = `${String(safeH).padStart(2, "0")}:${String(safeM).padStart(2, "0")}`
  return {
    customer: p.customer,
    equipment: p.equipment,
    planName: p.planName.trim(),
    intervalUi: p.intervalUi,
    customIntervalDays: p.customIntervalDays,
    nextDueDate: p.nextDueDate,
    lastServiceDate: p.lastServiceDate,
    serviceScope: p.serviceScope.trim(),
    estimatedDurationMinutes: p.estimatedDurationMinutes ?? null,
    workOrderTypeUi: p.workOrderTypeUi,
    workOrderPriorityUi: p.workOrderPriorityUi,
    preferredServiceTime: timeNorm,
    technicianSelectionId: tid,
    technicianLabel: p.technicianLabel ?? null,
    autoCreateWorkOrder: p.autoCreateWorkOrder,
    notes: p.notes,
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

export function mergeAndValidateCreateMaintenancePlanFromEquipmentPreviewForPatch(
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
    customer: isRecord(existing.customer) ? existing.customer : {},
    equipment: isRecord(existing.equipment) ? existing.equipment : {},
  }

  const parsed = previewSchema.safeParse(merged)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ") || "Invalid preview."
    return { ok: false, message: msg }
  }

  const normalized = normalizePreview(parsed.data)
  return { ok: true, previewPayload: { preview: normalized } }
}
