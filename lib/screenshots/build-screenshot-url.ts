import { SCREENSHOT_QUERY_FLAG } from "@/lib/screenshots/scenario-types"

/** Append screenshot mode query without dropping existing search params. */
export function withScreenshotMode(path: string): string {
  const hasQuery = path.includes("?")
  const sep = hasQuery ? "&" : "?"
  if (path.includes("equipifyShot=")) return path
  return `${path}${sep}${SCREENSHOT_QUERY_FLAG}`
}
