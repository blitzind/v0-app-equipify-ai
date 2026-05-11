/** Browser CSV download — no server round-trip. */

export function escapeCsvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return ""
  const s = String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function rowsToCsv(rows: string[][]): string {
  return rows.map((r) => r.map(escapeCsvCell).join(",")).join("\r\n")
}

/** Excel on Windows often expects a UTF-8 BOM to infer encoding for plain CSV. */
export function withUtf8Bom(content: string): string {
  return `\uFEFF${content}`
}

export type DownloadCsvOptions = {
  /** Prepend UTF-8 BOM (recommended for Excel). Default true. */
  utf8Bom?: boolean
}

export function downloadCsv(filename: string, content: string, options?: DownloadCsvOptions) {
  const useBom = options?.utf8Bom !== false
  const body = useBom ? withUtf8Bom(content) : content
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
