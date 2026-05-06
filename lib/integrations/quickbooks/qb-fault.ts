/** Intuit JSON fault extractor (may appear with HTTP 200). */
export function readQuickBooksFaultMessage(data: unknown): string | null {
  if (!data || typeof data !== "object") return null
  const d = data as {
    Fault?: { Error?: Array<{ Message?: string; Detail?: string }> }
    fault?: { error?: Array<{ message?: string }> }
  }
  const e = d.Fault?.Error?.[0]
  if (e) {
    return [e.Message, e.Detail].filter(Boolean).join(" — ").trim() || null
  }
  const e2 = d.fault?.error?.[0]
  if (e2?.message) return e2.message
  return null
}
