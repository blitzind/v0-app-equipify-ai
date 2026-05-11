/**
 * Exact phrase required to confirm sample-data removal (Settings UI + POST /api/demo-data/reset).
 * Customer-facing: spaces, no underscores or internal codes.
 */
export const REMOVE_SAMPLE_DATA_CONFIRMATION_PHRASE = "REMOVE SAMPLE DATA" as const

export function describeSampleRemovalSuccess(summary: Record<string, number> | null | undefined): string {
  if (!summary || typeof summary !== "object") {
    return "Sample-only records were removed. Your own customers, equipment, and jobs were not changed."
  }
  const total = Object.values(summary).reduce((acc, v) => acc + (typeof v === "number" ? v : 0), 0)
  if (total === 0) {
    return "No sample-marked rows were found. If you expected examples here, import a practice bundle first."
  }
  return `Removed ${total.toLocaleString()} sample-labeled record${total === 1 ? "" : "s"}. Data you created yourself was not affected.`
}
