/**
 * Best-effort extraction of user-visible warnings from stored preview JSON.
 */
export function extractPreviewWarningsFromPayload(previewPayload: Record<string, unknown>): string[] {
  const out: string[] = []
  const preview = previewPayload.preview
  if (!preview || typeof preview !== "object" || Array.isArray(preview)) {
    return out
  }
  const p = preview as Record<string, unknown>
  const w = p.warnings
  if (Array.isArray(w)) {
    for (const x of w) {
      if (typeof x === "string" && x.trim()) out.push(x.trim())
    }
  }
  const bw = p.batchWarnings
  if (Array.isArray(bw)) {
    for (const x of bw) {
      if (typeof x === "string" && x.trim()) out.push(x.trim())
    }
  }
  return [...new Set(out)]
}
