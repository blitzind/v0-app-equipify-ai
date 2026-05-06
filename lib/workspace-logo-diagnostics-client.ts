"use client"

/** Dev / Vercel preview / NEXT_PUBLIC_WORKSPACE_LOGO_DEBUG — surfaces logo upload diagnostics on Workspace Settings. */
export function showWorkspaceLogoDiagnostics(): boolean {
  if (process.env.NODE_ENV === "development") return true
  if (typeof window !== "undefined" && /\.vercel\.app$/i.test(window.location.hostname)) return true
  return process.env.NEXT_PUBLIC_WORKSPACE_LOGO_DEBUG === "1"
}

export function logWorkspaceLogoUpload(label: string, payload: unknown): void {
  if (!showWorkspaceLogoDiagnostics()) return
  console.log(label, payload)
}
