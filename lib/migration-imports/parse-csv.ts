/** Minimal CSV parser with quoted fields (no dependency). */

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ""
  let i = 0
  let inQuotes = false
  while (i < line.length) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      cur += c
      i += 1
      continue
    }
    if (c === '"') {
      inQuotes = true
      i += 1
      continue
    }
    if (c === ",") {
      out.push(cur)
      cur = ""
      i += 1
      continue
    }
    cur += c
    i += 1
  }
  out.push(cur)
  return out
}

export type ParsedCsv = {
  headers: string[]
  rows: Record<string, string>[]
}

export function parseCsvText(text: string, maxRows: number): ParsedCsv {
  const normalized = text.replace(/^\uFEFF/, "")
  const lines = normalized.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) {
    return { headers: [], rows: [] }
  }
  const headers = parseCsvLine(lines[0]).map((h) => h.trim())
  const rows: Record<string, string>[] = []
  for (let r = 1; r < lines.length && rows.length < maxRows; r++) {
    const cells = parseCsvLine(lines[r])
    const row: Record<string, string> = {}
    for (let c = 0; c < headers.length; c++) {
      row[headers[c] ?? `column_${c}`] = (cells[c] ?? "").trim()
    }
    rows.push(row)
  }
  return { headers, rows }
}

export function shortImportRef(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase()
}
