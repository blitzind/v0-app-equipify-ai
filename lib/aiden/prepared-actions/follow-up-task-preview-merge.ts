import { z } from "zod"
import type { CreateFollowUpTaskPreviewPayload } from "@/lib/aiden/actions/resolvers/create-follow-up-task-types"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const entitySchema = z.object({
  entityType: z.enum([
    "customer",
    "work_order",
    "invoice",
    "quote",
    "equipment",
    "maintenance_plan",
    "prospect",
  ]),
  entityId: z.string().regex(UUID_RE),
  label: z.string().min(1).max(500),
  customerId: z.string().regex(UUID_RE).nullable().optional(),
  customerName: z.string().max(300).nullable().optional(),
})

const previewSchema = z.object({
  title: z.string().trim().min(2).max(200),
  notes: z.string().max(12_000),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduledForIso: z.string().min(8),
  assigneeUserId: z.union([z.string().regex(UUID_RE), z.literal(""), z.null()]).optional(),
  assigneeLabel: z.string().max(200).nullable().optional(),
  reason: z.string().max(2000).optional(),
  relatedRecord: entitySchema,
})

function dueToScheduledIso(ymd: string): string {
  return `${ymd}T12:00:00.000Z`
}

function normalizePreview(p: z.infer<typeof previewSchema>): CreateFollowUpTaskPreviewPayload {
  const assigneeUserId =
    p.assigneeUserId === "" || p.assigneeUserId === null || p.assigneeUserId === undefined ? null : p.assigneeUserId
  return {
    title: p.title.trim(),
    notes: p.notes,
    dueDate: p.dueDate,
    scheduledForIso: dueToScheduledIso(p.dueDate),
    assigneeUserId,
    assigneeLabel: p.assigneeLabel ?? null,
    reason: (p.reason ?? "").trim(),
    relatedRecord: {
      entityType: p.relatedRecord.entityType,
      entityId: p.relatedRecord.entityId,
      label: p.relatedRecord.label.trim(),
      customerId: p.relatedRecord.customerId ?? null,
      customerName: p.relatedRecord.customerName ?? null,
    },
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

/**
 * Merges client PATCH body into stored preview for `create_follow_up_task`.
 */
export function mergeAndValidateFollowUpTaskPreviewForPatch(
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
    relatedRecord:
      isRecord(patch.relatedRecord) ?
        { ...(isRecord(existing.relatedRecord) ? existing.relatedRecord : {}), ...patch.relatedRecord }
      : existing.relatedRecord,
  }

  const parsed = previewSchema.safeParse(merged)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ") || "Invalid preview."
    return { ok: false, message: msg }
  }

  const normalized = normalizePreview(parsed.data)
  return { ok: true, previewPayload: { preview: normalized } }
}
