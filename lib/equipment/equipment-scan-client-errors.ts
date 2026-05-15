"use client"

/** Maps thrown errors from Server Actions / network into user-safe copy (no raw stack traces). */
export function mapEquipmentScanTransportError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  const name = err instanceof Error ? err.name : ""
  const combined = `${name} ${msg}`.toLowerCase()

  if (msg === "EXTRACTION_TIMEOUT" || combined.includes("extraction_timeout")) {
    return "AI extraction timed out. Try again with a smaller image, better signal, or enter equipment manually."
  }
  if (
    combined.includes("body exceeded") ||
    combined.includes("bodysizelimit") ||
    combined.includes("413") ||
    combined.includes("e394") ||
    combined.includes("request entity too large")
  ) {
    return "Upload is too large for the server connection. Use a smaller photo (the app compresses automatically — try again) or a PDF under about 4 MB."
  }
  if (combined.includes("401") || combined.includes("unauthorized") || combined.includes("not authenticated")) {
    return "Your session expired. Sign in again, then retry the upload."
  }
  if (combined.includes("403") || combined.includes("forbidden")) {
    return "You do not have permission to run AI scan for this workspace."
  }
  if (combined.includes("abort") || combined.includes("aborted")) {
    return "Upload was cancelled."
  }
  if (
    combined.includes("failed to fetch") ||
    combined.includes("networkerror") ||
    combined.includes("load failed") ||
    combined.includes("network request failed")
  ) {
    return "Network error — check your connection and try again."
  }
  if (combined.includes("timeout") || combined.includes("timed out")) {
    return "The request timed out. Try again with better signal or a smaller file."
  }
  return "Something went wrong while contacting the server. Try again, or use manual equipment entry."
}
