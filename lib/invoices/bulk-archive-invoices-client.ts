/** Client helpers for bulk invoice archive. */

export type BulkArchiveInvoicesApiResult =
  | { ok: true; succeededCount: number; failedCount: number; failedIds: string[] }
  | { ok: false; message: string }

export function friendlyBulkInvoiceArchiveApiError(status: number, message: string | undefined): string {
  const m = message?.trim() ?? ""
  if (status === 401) return "Sign in to manage invoices."
  if (status === 403) return m || "You do not have permission to archive invoices."
  if (status === 400 && m) return m
  if (status >= 500) return "Could not complete that action. Try again in a moment."
  return m || "Could not complete that action. Try again."
}

export async function bulkArchiveInvoicesViaApi(args: {
  organizationId: string
  invoiceIds: string[]
}): Promise<BulkArchiveInvoicesApiResult> {
  const res = await fetch(
    `/api/organizations/${encodeURIComponent(args.organizationId)}/invoices/bulk-archive`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceIds: args.invoiceIds }),
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

  return { ok: false, message: friendlyBulkInvoiceArchiveApiError(res.status, message) }
}
