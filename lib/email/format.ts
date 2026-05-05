/** Escape HTML entities for safe interpolation into HTML emails. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** Convert plain-text user message to simple HTML (paragraphs / line breaks). */
export function plainTextToHtml(text: string): string {
  const escaped = escapeHtml(text.trim())
  if (!escaped) return "<p></p>"
  const paragraphs = escaped.split(/\n\n+/).map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
  return paragraphs.join("")
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(to: string): boolean {
  const t = to.trim()
  return t.length > 3 && EMAIL_RE.test(t)
}
