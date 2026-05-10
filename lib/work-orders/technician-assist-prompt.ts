import "server-only"

import type { LoadedWorkOrderDetail } from "@/lib/work-orders/detail-load"
import type { ServiceSummaryContextHints } from "@/lib/work-orders/service-summary-prompt"

function partSnapshotNoCost(detail: LoadedWorkOrderDetail) {
  const parts = detail.workOrder.repairLog.partsUsed ?? []
  return parts.map((p) => ({
    name: (p.name ?? "").trim() || "Part",
    partNumber: p.partNumber?.trim() || undefined,
    quantity: p.quantity,
  }))
}

function taskSnapshot(detail: LoadedWorkOrderDetail) {
  const tasks = detail.workOrder.repairLog.tasks ?? []
  return tasks.map((t) => ({
    label: t.label,
    done: t.done,
    description: t.description?.trim() || undefined,
  }))
}

function equipmentSnapshot(detail: LoadedWorkOrderDetail) {
  return detail.equipmentAssets.map((a) => ({
    name: a.name,
    equipmentCode: a.equipmentCode,
    serialNumber: a.serialNumber,
    category: a.category,
    locationLabel: a.locationLabel,
    isPrimary: a.isPrimary,
    certificateStatus: a.certificateStatus,
    nextServiceDueYmd: a.nextServiceDueYmd ?? null,
    nextCalibrationDueYmd: a.nextCalibrationDueYmd ?? null,
  }))
}

/**
 * Technician-assist context: internal/staff only. Excludes dollar amounts, invoice, billing identifiers.
 */
export function buildWorkOrderTechnicianAssistContextJson(params: {
  detail: LoadedWorkOrderDetail
  hints?: ServiceSummaryContextHints
}): Record<string, unknown> {
  const { detail, hints } = params
  const wo = detail.workOrder
  const rl = wo.repairLog

  return {
    role: "technician_field_guidance",
    workOrder: {
      id: wo.id,
      workOrderNumber: wo.workOrderNumber ?? null,
      title: wo.description?.trim() || "",
      status: wo.status,
      type: wo.type,
      priority: wo.priority,
      scheduledDate: wo.scheduledDate || null,
      completedDate: wo.completedDate || null,
      customerName: wo.customerName,
      equipmentName: wo.equipmentName,
      equipmentLocation: wo.location || null,
      equipmentCode: wo.equipmentCode || null,
      serialNumber: wo.equipmentSerialNumber || null,
      equipmentCategory: wo.equipmentCategory || null,
      maintenancePlanName: wo.maintenancePlanName || null,
      problemReported: rl.problemReported?.trim() || "",
      diagnosis: rl.diagnosis?.trim() || "",
      technicianNotes: rl.technicianNotes?.trim() || "",
      technicianName: wo.technicianName,
      warrantyReviewRequired: wo.warrantyReviewRequired === true,
      equipmentWarrantyActive: wo.equipmentWarrantyActive === true,
      warrantyVendorName: wo.warrantyVendorName?.trim() || null,
      usesTasksTable: detail.usesTasksTable,
      usesPartsLineItems: detail.usesPartsLineItems,
    },
    internalWorkOrderNotes: detail.notes?.trim() || "",
    tasks: taskSnapshot(detail),
    parts: partSnapshotNoCost(detail),
    equipmentAssets: equipmentSnapshot(detail),
    planServicesSummary:
      Array.isArray(detail.planServices) && detail.planServices.length > 0 ?
        `${detail.planServices.length} plan service line(s) on file — use names from work order context only.`
      : null,
    optionalHints: hints && Object.keys(hints).length ? hints : undefined,
  }
}

export function buildWorkOrderTechnicianAssistMessages(params: {
  detail: LoadedWorkOrderDetail
  hints?: ServiceSummaryContextHints
}): { system: string; user: string } {
  const ctx = buildWorkOrderTechnicianAssistContextJson(params)

  const system = [
    "You assist field technicians with safe, practical guidance for an equipment work order.",
    "Return JSON ONLY with these exact keys:",
    "troubleshootingSteps (string array), customerQuestions (string array), partsAndToolsChecklist (string array),",
    "safetyAndEscalation (string array), customerSafeWording (single string paragraph or short bullets as one string).",
    "Rules:",
    "- Suggestions only — nothing is executed automatically.",
    "- Do NOT include dollar amounts, invoices, quotes, line-item costs, labor rates, or any financial detail.",
    "- Do NOT invent part numbers, warranty coverage, or compliance outcomes; stay within the context JSON.",
    "- troubleshootingSteps: ordered, concrete checks a tech can perform on site.",
    "- customerQuestions: neutral questions to clarify symptoms, access, downtime, prior repairs.",
    "- partsAndToolsChecklist: likely consumables/tools by generic description (no ordering or pricing).",
    "- safetyAndEscalation: PPE, lockout/tagout reminders, when to stop and escalate to supervisor or OEM.",
    "- customerSafeWording: professional wording the tech could say aloud or paste into a customer message — must NOT leak internal-only notes, diagnosis confidence, or office/dispatcher commentary.",
    "- If context is thin, stay general and advise verifying in Equipify / with the shop.",
    "No markdown. Plain strings only inside arrays and customerSafeWording.",
  ].join("\n")

  const user = ["context_json:", JSON.stringify(ctx)].join("\n")

  return { system, user }
}
