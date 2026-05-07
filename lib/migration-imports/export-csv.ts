import type { RowOutcome } from "./types"
import { shortImportRef } from "./parse-csv"

function csvEscape(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/** Build downloadable outcome CSV (no raw UUIDs in cells). */
export function buildOutcomeCsv(
  rows: Record<string, string>[],
  outcomes: RowOutcome[],
  filter: "all" | "failed" | "skipped",
): string {
  const want = (o: RowOutcome) => {
    if (filter === "failed") return o.status === "error"
    if (filter === "skipped") return o.status === "skipped" || o.status === "duplicate"
    return true
  }

  const headers = [
    "row_number",
    "status",
    "codes",
    "reason",
    "matched_record",
    ...Array.from(
      outcomes.reduce((acc, o) => {
        if (!want(o)) return acc
        const row = rows[o.rowIndex - 1]
        if (row) Object.keys(row).forEach((k) => acc.add(k))
        return acc
      }, new Set<string>()),
    ).sort(),
  ]

  const lines = [headers.map(csvEscape).join(",")]

  const dataHeaderKeys = headers.slice(5)

  for (const o of outcomes) {
    if (!want(o)) continue
    const row = rows[o.rowIndex - 1] ?? {}
    const ref =
      o.matchedLabel?.trim() ||
      (o.entityId ? shortImportRef(o.entityId) : "") ||
      ""
    const cells: string[] = [
      csvEscape(String(o.rowIndex)),
      csvEscape(o.status),
      csvEscape(o.codes.join(";")),
      csvEscape(o.message ?? ""),
      csvEscape(ref),
      ...dataHeaderKeys.map((h) => csvEscape(row[h] ?? "")),
    ]
    lines.push(cells.join(","))
  }

  return lines.join("\r\n")
}
