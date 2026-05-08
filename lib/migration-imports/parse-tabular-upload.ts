import * as XLSX from "xlsx"
import { parseCsvText, serializeCsv, type ParsedCsv } from "./parse-csv"

export type ParsedTabularUpload = ParsedCsv & {
  sourceType: "csv" | "xlsx"
  normalizedCsv: string
  worksheets: string[]
  selectedWorksheet: string | null
  detectedColumns: string[]
  rowCountEstimate: number
}

export type TabularWorkbookInspection = {
  sourceType: "csv" | "xlsx"
  worksheets: string[]
  selectedWorksheet: string | null
  detectedColumns: string[]
  rowCountEstimate: number
}

function sourceTypeForFile(fileName: string, mimeType: string): "csv" | "xlsx" {
  const lower = fileName.toLowerCase()
  if (
    lower.endsWith(".xlsx") ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return "xlsx"
  }
  return "csv"
}

function stringValue(value: unknown): string {
  if (value == null) return ""
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).trim()
}

function parseXlsxBuffer(buffer: Buffer, maxRows: number, worksheetName?: string | null): ParsedTabularUpload {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
    raw: false,
  })
  const worksheets = workbook.SheetNames
  const selectedWorksheet = worksheetName && worksheets.includes(worksheetName) ? worksheetName : worksheets[0] ?? null
  if (!selectedWorksheet) {
    return {
      sourceType: "xlsx",
      normalizedCsv: "",
      worksheets,
      selectedWorksheet: null,
      detectedColumns: [],
      rowCountEstimate: 0,
      headers: [],
      rows: [],
    }
  }

  const sheet = workbook.Sheets[selectedWorksheet]
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
    raw: false,
  })

  const [headerRow, ...bodyRows] = rawRows
  const headers =
    headerRow?.map((cell, index) => stringValue(cell) || `column_${index + 1}`).filter((header) => header.length > 0) ?? []
  const rows: Record<string, string>[] = []

  for (const bodyRow of bodyRows) {
    if (rows.length >= maxRows) break
    const values = bodyRow.map(stringValue)
    if (values.every((value) => value.length === 0)) continue

    const row: Record<string, string> = {}
    for (let i = 0; i < headers.length; i++) {
      row[headers[i]] = values[i] ?? ""
    }
    rows.push(row)
  }

  return {
    sourceType: "xlsx",
    normalizedCsv: serializeCsv(headers, rows),
    worksheets,
    selectedWorksheet,
    detectedColumns: headers,
    rowCountEstimate: Math.max(bodyRows.length, rows.length),
    headers,
    rows,
  }
}

export function parseTabularUpload({
  buffer,
  fileName,
  mimeType,
  maxRows,
  worksheetName,
}: {
  buffer: Buffer
  fileName: string
  mimeType: string
  maxRows: number
  worksheetName?: string | null
}): ParsedTabularUpload {
  const sourceType = sourceTypeForFile(fileName, mimeType)
  if (sourceType === "xlsx") {
    return parseXlsxBuffer(buffer, maxRows, worksheetName)
  }

  const text = new TextDecoder("utf-8", { fatal: false }).decode(buffer)
  const parsed = parseCsvText(text, maxRows)
  return {
    ...parsed,
    sourceType: "csv",
    normalizedCsv: serializeCsv(parsed.headers, parsed.rows),
    worksheets: [],
    selectedWorksheet: null,
    detectedColumns: parsed.headers,
    rowCountEstimate: parsed.rows.length,
  }
}

export function inspectTabularUpload(args: {
  buffer: Buffer
  fileName: string
  mimeType: string
  maxRows: number
  worksheetName?: string | null
}): TabularWorkbookInspection {
  const parsed = parseTabularUpload(args)
  return {
    sourceType: parsed.sourceType,
    worksheets: parsed.worksheets,
    selectedWorksheet: parsed.selectedWorksheet,
    detectedColumns: parsed.detectedColumns,
    rowCountEstimate: parsed.rowCountEstimate,
  }
}
