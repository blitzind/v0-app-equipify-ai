/** Detect Next.js `redirect()` / `notFound()` digest errors — must rethrow from Server Actions. */
export function isNextRedirectError(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false
  const d = (e as { digest?: unknown }).digest
  if (typeof d !== "string") return false
  if (d.startsWith("NEXT_REDIRECT")) return true
  const head = d.split(";")[0] ?? ""
  return head === "NEXT_REDIRECT"
}
