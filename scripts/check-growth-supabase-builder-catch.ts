/**
 * Guardrail: Supabase Postgrest builders are PromiseLike (.then only), not full Promises.
 * Direct `.catch()` / `.finally()` on a builder chain throws synchronously.
 *
 * Run: pnpm test:growth-supabase-builder-catch
 */
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const SCAN_DIRS = [
  "lib/growth",
  "app/api/platform/growth",
  "app/api/cron",
]
const SOURCE_EXT = /\.(tsx|ts)$/

/** Terminators that commonly precede a mistaken builder `.catch()`. */
const BUILDER_TERMINATOR =
  /\.(?:limit|maybeSingle|single|returns|throwOnError)\([^)]*\)\s*\n\s*\.(?:catch|finally)\(/g

/** Mutations ending in filter before `.catch()`. */
const MUTATION_TERMINATOR =
  /\.(?:eq|in|gte|lte|contains|or|not|filter|match)\([^)]*\)\s*\n\s*\.(?:catch|finally)\(/g

/** Insert/update without intermediate `.then()` before `.catch()`. */
const INSERT_UPDATE_CATCH =
  /\.(?:insert|update|upsert|delete)\([\s\S]{0,800}?\)\s*\n\s*\.catch\(/g

type Violation = { file: string; line: number; snippet: string }

function lineNumber(source: string, index: number): number {
  return source.slice(0, index).split("\n").length
}

function snippetAt(source: string, index: number): string {
  const lineStart = source.lastIndexOf("\n", index) + 1
  const lineEnd = source.indexOf("\n", index)
  return source.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim()
}

function hasThenBeforeCatch(source: string, catchIndex: number): boolean {
  const windowStart = Math.max(0, catchIndex - 400)
  const segment = source.slice(windowStart, catchIndex)
  return /\.then\s*\(/.test(segment)
}

function isSupabaseChainLookback(segment: string): boolean {
  return (
    /\.from\s*\(/.test(segment) ||
    /Table\s*\(\s*admin\s*\)/.test(segment) ||
    /\.schema\s*\(\s*["']growth["']\s*\)/.test(segment)
  )
}

function collectViolations(relativePath: string, source: string): Violation[] {
  const violations: Violation[] = []
  const patterns = [BUILDER_TERMINATOR, MUTATION_TERMINATOR, INSERT_UPDATE_CATCH]

  for (const pattern of patterns) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(source)) !== null) {
      const catchIndex = match.index + match[0].indexOf(".catch")
      if (catchIndex >= 0 && hasThenBeforeCatch(source, catchIndex)) continue
      const lookbackStart = Math.max(0, match.index - 600)
      const lookback = source.slice(lookbackStart, match.index)
      if (!isSupabaseChainLookback(lookback)) continue
      violations.push({
        file: relativePath,
        line: lineNumber(source, match.index),
        snippet: snippetAt(source, match.index),
      })
    }
  }

  return violations
}

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue
      walk(abs, out)
    } else if (SOURCE_EXT.test(entry.name)) {
      out.push(abs)
    }
  }
  return out
}

function main(): void {
  const files: string[] = []
  for (const dir of SCAN_DIRS) {
    walk(path.join(ROOT, dir), files)
  }

  const allViolations: Violation[] = []
  for (const abs of files) {
    const rel = path.relative(ROOT, abs).replace(/\\/g, "/")
    const source = fs.readFileSync(abs, "utf8")
    allViolations.push(...collectViolations(rel, source))
  }

  if (allViolations.length === 0) {
    console.log("check-growth-supabase-builder-catch: OK (no builder-direct .catch/.finally detected).")
    return
  }

  console.error("check-growth-supabase-builder-catch: FAILED")
  for (const v of allViolations) {
    console.error(`  ${v.file}:${v.line}  ${v.snippet}`)
  }
  process.exit(1)
}

main()
