/** Client helpers for bulk customer archive. */

export type BulkArchiveCustomersApiResult =
  | { ok: true; succeededCount: number; failedCount: number; failedIds: string[] }
  | { ok: false; message: string }

export function friendlyBulkCustomerArchiveApiError(status: number, message: string | undefined): string {
  const m = message?.trim() ?? ""
  if (status === 401) return "Sign in to manage customers."
  if (status === 403) return m || "You do not have permission to archive customers."
  if (status === 400 && m) return m
  if (status >= 500) return "Could not complete that action. Try again in a moment."
  return m || "Could not complete that action. Try again."
}

export async function bulkArchiveCustomersViaApi(args: {
  organizationId: string
  customerIds: string[]
}): Promise<BulkArchiveCustomersApiResult> {
  const res = await fetch(
    `/api/organizations/${encodeURIComponent(args.organizationId)}/customers/bulk-archive`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerIds: args.customerIds }),
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

  return { ok: false, message: friendlyBulkCustomerArchiveApiError(res.status, message) }
}
