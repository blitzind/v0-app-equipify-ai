/** Client helpers for bulk maintenance plan archive. */

export type BulkArchiveMaintenancePlansApiResult =
  | { ok: true; succeededCount: number; failedCount: number; failedIds: string[] }
  | { ok: false; message: string }

export function friendlyBulkMaintenancePlanArchiveApiError(
  status: number,
  message: string | undefined,
): string {
  const m = message?.trim() ?? ""
  if (status === 401) return "Sign in to manage maintenance plans."
  if (status === 403) return m || "You do not have permission to archive maintenance plans."
  if (status === 400 && m) return m
  if (status >= 500) return "Could not complete that action. Try again in a moment."
  return m || "Could not complete that action. Try again."
}

export async function bulkArchiveMaintenancePlansViaApi(args: {
  organizationId: string
  planIds: string[]
}): Promise<BulkArchiveMaintenancePlansApiResult> {
  const res = await fetch(
    `/api/organizations/${encodeURIComponent(args.organizationId)}/maintenance-plans/bulk-archive`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planIds: args.planIds }),
    },
  )

  if (res.ok) {
    try {
      const body = (await res.json()) as {
        succeededCount?: number
        failedCount?: number
        failedIds?: string[]
      }
      return {
        ok: true,
        succeededCount: body.succeededCount ?? 0,
        failedCount: body.failedCount ?? 0,
        failedIds: Array.isArray(body.failedIds) ? body.failedIds : [],
      }
    } catch {
      return { ok: false, message: "Could not complete that action. Try again." }
    }
  }

  let message: string | undefined
  try {
    const body = (await res.json()) as { message?: string }
    message = body.message
  } catch {
    message = undefined
  }

  return { ok: false, message: friendlyBulkMaintenancePlanArchiveApiError(res.status, message) }
}
