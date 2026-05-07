import type { RowOutcome } from "./types"
import { shortImportRef } from "./parse-csv"

/** Strip database IDs from outcomes for client responses (operational refs only). */
export function outcomesForClient(outcomes: RowOutcome[]): {
  rowIndex: number
  status: RowOutcome["status"]
  codes: string[]
  message: string | null
  ref?: string
}[] {
  return outcomes.map((o) => ({
    rowIndex: o.rowIndex,
    status: o.status,
    codes: o.codes,
    message: o.message,
    ...(o.entityId ? { ref: shortImportRef(o.entityId) } : {}),
  }))
}
