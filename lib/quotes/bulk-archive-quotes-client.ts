/** Client helpers for bulk quote archive. */

export type BulkArchiveQuotesApiResult =
  | { ok: true; succeededCount: number; failedCount: number; failedIds: string[] }
  | { ok: false; message: string }

export function friendlyBulkQuoteArchiveApiError(status: number, message: string | undefined): string {
  const m = message?.trim() ?? ""
  if (status === 401) return "Sign in to manage quotes."
  if (status === 403) return m || "You do not have permission to archive quotes."
  if (status === 400 && m) return m
  if (status >= 500) return "Could not complete that action. Try again in a moment."
  return m || "Could not complete that action. Try again."
}

export async function bulkArchiveQuotesViaApi(args: {
  organizationId: string
  quoteIds: string[]
}): Promise<BulkArchiveQuotesApiResult> {
  const res = await fetch(
    `/api/organizations/${encodeURIComponent(args.organizationId)}/quotes/bulk-archive`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quoteIds: args.quoteIds }),
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

  return { ok: false, message: friendlyBulkQuoteArchiveApiError(res.status, message) }
}
