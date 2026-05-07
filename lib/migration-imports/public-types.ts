/** Client-safe preview shapes (shared with API responses). */

export type PreviewIssue = {
  rowIndex: number
  severity: "error" | "warning"
  code: string
  message: string
}

export type PreviewSampleRow = {
  rowIndex: number
  cells: Record<string, string>
  issues: PreviewIssue[]
}

/** Estimated outcomes for the selected merge strategy (deterministic preview). */
export type ImportProjection = {
  willCreate: number
  willUpdate: number
  willSkip: number
  willFail: number
}

export type PreviewResult = {
  rowCount: number
  truncated: boolean
  duplicateHints: { rowIndex: number; message: string }[]
  unresolvedRefs: { rowIndex: number; message: string }[]
  sampleRows: PreviewSampleRow[]
  summary: {
    errorRows: number
    warningRows: number
    okRows: number
  }
  /** Present when strategy was supplied to preview/commit prep. */
  projection?: ImportProjection
}
