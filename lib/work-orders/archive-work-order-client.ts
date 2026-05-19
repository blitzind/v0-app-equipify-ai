/** Client helpers for archiving / restoring work orders via the archived center API. */

export type WorkOrderArchiveApiResult = { ok: true } | { ok: false; message: string }

export function workOrderAlreadyArchivedMessage(archivedAt: string | null | undefined): string | null {
  return archivedAt ? "This work order is already archived." : null
}

export function friendlyWorkOrderArchiveApiError(status: number, message: string | undefined): string {
  const m = message?.trim() ?? ""
  if (status === 401) return "Sign in to manage work orders."
  if (status === 403) {
    return m || "You do not have permission to archive work orders."
  }
  if (status === 404) return "Work order not found."
  if (status === 400 && m) return m
  if (status >= 500) return "Could not complete that action. Try again in a moment."
  return m || "Could not complete that action. Try again."
}

async function patchArchivedRecord(args: {
  organizationId: string
  recordType: "work_order"
  recordId: string
  endpoint: "archive" | "restore"
}): Promise<WorkOrderArchiveApiResult> {
  const res = await fetch(`/api/archived/${args.endpoint}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      organizationId: args.organizationId,
      recordType: args.recordType,
      recordId: args.recordId,
    }),
  })

  if (res.ok) return { ok: true }

  let message: string | undefined
  try {
    const body = (await res.json()) as { message?: string }
    message = body.message
  } catch {
    message = undefined
  }

  return { ok: false, message: friendlyWorkOrderArchiveApiError(res.status, message) }
}

export function archiveWorkOrderViaApi(args: {
  organizationId: string
  workOrderId: string
}): Promise<WorkOrderArchiveApiResult> {
  return patchArchivedRecord({
    organizationId: args.organizationId,
    recordType: "work_order",
    recordId: args.workOrderId,
    endpoint: "archive",
  })
}

export function restoreWorkOrderViaApi(args: {
  organizationId: string
  workOrderId: string
}): Promise<WorkOrderArchiveApiResult> {
  return patchArchivedRecord({
    organizationId: args.organizationId,
    recordType: "work_order",
    recordId: args.workOrderId,
    endpoint: "restore",
  })
}
