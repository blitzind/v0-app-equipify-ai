import "server-only"

import type { LoadedWorkOrderDetail } from "@/lib/work-orders/detail-load"

export type ServiceSummaryAudience = "internal" | "customer_safe"

export type ServiceSummaryContextHints = {
  reliability?: string
  warranty?: string
  replacement?: string
}

function scrubFinancialTokens(text: string): string {
  return text.replace(/\$/g, "").trim().slice(0, 280)
}

export function sanitizeServiceSummaryHints(raw: ServiceSummaryContextHints | undefined): ServiceSummaryContextHints {
  if (!raw) return {}
  const out: ServiceSummaryContextHints = {}
  if (typeof raw.reliability === "string" && raw.reliability.trim()) {
    out.reliability = scrubFinancialTokens(raw.reliability)
  }
  if (typeof raw.warranty === "string" && raw.warranty.trim()) {
    out.warranty = scrubFinancialTokens(raw.warranty)
  }
  if (typeof raw.replacement === "string" && raw.replacement.trim()) {
    out.replacement = scrubFinancialTokens(raw.replacement)
  }
  return out
}

function partSnapshotForInternal(detail: LoadedWorkOrderDetail) {
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
  }))
}

/**
 * Builds non-financial context for AI. `customer_safe` excludes internal-only notes and diagnosis.
 */
export function buildWorkOrderServiceSummaryContextJson(params: {
  detail: LoadedWorkOrderDetail
  audience: ServiceSummaryAudience
  hints?: ServiceSummaryContextHints
}): Record<string, unknown> {
  const { detail, audience, hints } = params
  const wo = detail.workOrder
  const rl = wo.repairLog

  const base = {
    audience,
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
      technicianName: wo.technicianName,
      warrantyReviewRequired: wo.warrantyReviewRequired === true,
      equipmentWarrantyActive: wo.equipmentWarrantyActive === true,
      usesTasksTable: detail.usesTasksTable,
      usesPartsLineItems: detail.usesPartsLineItems,
    },
    tasks: taskSnapshot(detail),
    equipmentAssets: equipmentSnapshot(detail),
    optionalHints: hints && Object.keys(hints).length ? hints : undefined,
  }

  if (audience === "internal") {
    return {
      ...base,
      workOrder: {
        ...(base.workOrder as Record<string, unknown>),
        diagnosis: rl.diagnosis?.trim() || "",
        technicianNotes: rl.technicianNotes?.trim() || "",
      },
      internalWorkOrderNotes: detail.notes?.trim() || "",
      parts: partSnapshotForInternal(detail),
    }
  }

  const safeTasks = (rl.tasks ?? []).map((t) => ({
    label: t.label,
    done: t.done,
  }))

  return {
    ...base,
    tasks: safeTasks,
  }
}

export function buildWorkOrderServiceSummaryMessages(params: {
  detail: LoadedWorkOrderDetail
  audience: ServiceSummaryAudience
  hints?: ServiceSummaryContextHints
}): { system: string; user: string } {
  const ctx = buildWorkOrderServiceSummaryContextJson(params)
  const audience = params.audience

  const system =
    audience === "customer_safe" ?
      [
        "You draft concise, professional service summaries for equipment owners.",
        "Output MUST be JSON only with keys: summary (string) and optional highlights (string array, max 12 short bullets).",
        "Audience: customer-facing. Do not include internal-only commentary, technician-only notes, dispatcher notes, diagnosis detail, pricing, dollar amounts, invoice or billing references, part numbers that imply spend, or anything that could embarrass the service provider.",
        "Use only facts present in the provided context. If information is missing, keep the summary general rather than inventing specifics.",
        "Neutral, clear tone. No markdown in summary or highlight strings.",
      ].join("\n")
    : [
        "You draft internal service handoff summaries for field service teams.",
        "Output MUST be JSON only with keys: summary (string) and optional highlights (string array, max 12 short bullets).",
        "Audience: internal staff. You may reference diagnosis and technician notes from context. Never include dollar amounts, invoice numbers, billing states, unit costs, or other financial details even if you suspect them.",
        "Use only facts present in the provided context. If reliability/warranty/replacement hints are provided, treat them as operator-supplied context only.",
        "No markdown in summary or highlight strings.",
      ].join("\n")

  const user = [
    `audience: ${audience}`,
    "context_json:",
    JSON.stringify(ctx),
  ].join("\n")

  return { system, user }
}
