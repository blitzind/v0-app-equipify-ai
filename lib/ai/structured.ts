import type { z } from "zod"

/** Extract first JSON object from model output (handles stray prose / fences). */
export function extractFirstJsonObject(raw: string): string | null {
  const t = raw.trim()
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(t)
  const body = fence ? fence[1].trim() : t
  const start = body.indexOf("{")
  if (start === -1) return null
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < body.length; i++) {
    const c = body[i]
    if (inStr) {
      if (esc) {
        esc = false
      } else if (c === "\\") {
        esc = true
      } else if (c === '"') {
        inStr = false
      }
      continue
    }
    if (c === '"') {
      inStr = true
      continue
    }
    if (c === "{") depth++
    else if (c === "}") {
      depth--
      if (depth === 0) return body.slice(start, i + 1)
    }
  }
  return null
}

export function parseJsonSafe(raw: string): unknown {
  const slice = extractFirstJsonObject(raw)
  if (!slice) throw new SyntaxError("No JSON object found in model output")
  return JSON.parse(slice) as unknown
}

export function parseWithSchema<T>(raw: string, schema: z.ZodType<T>): T {
  const parsed = parseJsonSafe(raw)
  return schema.parse(parsed)
}

export async function parseWithSchemaSafe<T>(
  raw: string,
  schema: z.ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; error: Error }> {
  try {
    const data = parseWithSchema(raw, schema)
    return { ok: true, data }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e : new Error(String(e)) }
  }
}

/** Heuristic: find lowest numeric confidence in common shapes (0–1). */
export function extractMinConfidence(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === "number" && value >= 0 && value <= 1) return value
  if (typeof value === "object" && !Array.isArray(value)) {
    const o = value as Record<string, unknown>
    if (typeof o.confidence === "number" && o.confidence >= 0 && o.confidence <= 1) return o.confidence
  }
  if (Array.isArray(value)) {
    let min: number | null = null
    for (const row of value) {
      if (row && typeof row === "object") {
        const c = (row as Record<string, unknown>).confidence
        if (typeof c === "number" && c >= 0 && c <= 1) {
          min = min === null ? c : Math.min(min, c)
        }
      }
    }
    return min
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>
    const rows = o.rows
    if (Array.isArray(rows)) return extractMinConfidence(rows)
  }
  return null
}
