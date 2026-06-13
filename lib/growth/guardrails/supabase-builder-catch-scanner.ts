/**
 * Supabase Postgrest builder `.catch()` / `.finally()` guardrail scanner.
 *
 * Rule: builders are thenables (`.then` only), not full Promises. Never chain
 * `.catch()` / `.finally()` directly on a builder — insert `.then(...)` first.
 */
import fs from "node:fs"
import path from "node:path"

export const GROWTH_SUPABASE_BUILDER_CATCH_QA_MARKER = "growth-supabase-builder-catch-v1" as const

export const GROWTH_SUPABASE_BUILDER_CATCH_SCAN_DIRS = [
  "lib/growth",
  "app/api/platform/growth",
  "app/api/cron",
] as const

export const GROWTH_SUPABASE_BUILDER_CATCH_FIXTURE_DIR =
  "scripts/fixtures/growth-supabase-builder-catch" as const

const SOURCE_EXT = /\.(tsx|ts)$/

const BUILDER_ROOT = /^(?:admin|[A-Za-z_$][\w$]*Table)$/
const TABLE_ADMIN_CALL = /^table\s*\(\s*admin\s*\)$/

export type SupabaseBuilderCatchViolation = {
  file: string
  line: number
  snippet: string
}

function lineNumber(source: string, index: number): number {
  return source.slice(0, index).split("\n").length
}

function snippetAt(source: string, index: number): string {
  const lineStart = source.lastIndexOf("\n", index) + 1
  const lineEnd = source.indexOf("\n", index)
  return source.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim()
}

function findCatchSites(source: string): number[] {
  const indices: number[] = []
  let i = 0
  while (i < source.length) {
    const ch = source[i]!
    const next = source[i + 1]

    if (ch === "/" && next === "/") {
      i += 2
      while (i < source.length && source[i] !== "\n") i += 1
      continue
    }

    if (ch === "/" && next === "*") {
      i += 2
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) i += 1
      i += 2
      continue
    }

    if (ch === "'" || ch === '"' || ch === "`") {
      const quote = ch
      i += 1
      while (i < source.length) {
        if (source[i] === "\\") {
          i += 2
          continue
        }
        if (source[i] === quote) {
          i += 1
          break
        }
        i += 1
      }
      continue
    }

    if (ch === "." && source.slice(i, i + 6) === ".catch") {
      indices.push(i)
      i += 6
      continue
    }

    if (ch === "." && source.slice(i, i + 8) === ".finally") {
      indices.push(i)
      i += 8
      continue
    }

    i += 1
  }

  return indices
}

function readMethodCall(
  source: string,
  openParenIndex: number,
): { method: string; isDotCall: boolean } | null {
  let i = openParenIndex - 1
  while (i >= 0 && /\s/.test(source[i]!)) i -= 1

  const methodEnd = i + 1
  while (i >= 0 && /[\w$]/.test(source[i]!)) i -= 1
  const method = source.slice(i + 1, methodEnd)
  if (!method) return null

  while (i >= 0 && /\s/.test(source[i]!)) i -= 1
  const isDotCall = i >= 0 && source[i] === "."
  return { method, isDotCall }
}

function matchingOpenParen(source: string, closeIndex: number): number {
  let depth = 1
  let i = closeIndex - 1
  while (i >= 0 && depth > 0) {
    const ch = source[i]!
    if (ch === ")") depth += 1
    else if (ch === "(") depth -= 1
    i -= 1
  }
  return i + 1
}

function readCallExpression(source: string, openParenIndex: number, closeIndex: number): string {
  let i = openParenIndex - 1
  while (i >= 0 && /\s/.test(source[i]!)) i -= 1
  const end = i + 1
  while (i >= 0 && /[\w$]/.test(source[i]!)) i -= 1
  return source.slice(i + 1, closeIndex + 1)
}

function isTableAdminHelperCall(source: string, openParenIndex: number, closeIndex: number): boolean {
  const expr = readCallExpression(source, openParenIndex, closeIndex)
  return TABLE_ADMIN_CALL.test(expr) || /Table\s*\(\s*admin\s*\)/.test(expr)
}

function isAdminRootExpression(source: string, openParenIndex: number): boolean {
  let i = openParenIndex - 1
  while (i >= 0 && /\s/.test(source[i]!)) i -= 1
  while (i >= 0 && /[\w$]/.test(source[i]!)) i -= 1
  while (i >= 0 && /\s/.test(source[i]!)) i -= 1
  if (i < 0 || source[i] !== ".") return false

  i -= 1
  while (i >= 0 && /\s/.test(source[i]!)) i -= 1
  if (i < 0) return false

  const end = i + 1
  while (i >= 0 && /[\w$]/.test(source[i]!)) i -= 1
  const root = source.slice(i + 1, end)
  return BUILDER_ROOT.test(root)
}

function analyzeCatchChain(source: string, catchIndex: number): { builderDirect: boolean } {
  if (source[catchIndex] !== ".") return { builderDirect: false }

  let i = catchIndex - 1
  let sawThen = false

  while (i >= 0) {
    while (i >= 0 && /\s/.test(source[i]!)) i -= 1
    if (i < 0 || source[i] !== ")") return { builderDirect: false }

    const closeIndex = i
    const openIndex = matchingOpenParen(source, closeIndex)
    const call = readMethodCall(source, openIndex)

    if (!call) return { builderDirect: false }

    const { method: callee, isDotCall } = call

    if (callee === "then" || callee === "finally") {
      sawThen = true
      let j = openIndex - 1
      while (j >= 0 && /[\w$]/.test(source[j]!)) j -= 1
      if (j >= 0 && source[j] === ".") j -= 1
      i = j
      continue
    }

    if (callee === "catch") return { builderDirect: false }

    if (!isDotCall) {
      if (isTableAdminHelperCall(source, openIndex, closeIndex)) {
        return { builderDirect: !sawThen }
      }
      return { builderDirect: false }
    }

    if (callee === "schema" && isAdminRootExpression(source, openIndex)) {
      return { builderDirect: !sawThen }
    }

    if (callee === "from") {
      if (isAdminRootExpression(source, openIndex)) {
        return { builderDirect: !sawThen }
      }
      let j = openIndex - 1
      while (j >= 0 && /[\w$]/.test(source[j]!)) j -= 1
      if (j >= 0 && source[j] === ".") j -= 1
      i = j
      continue
    }

    let j = openIndex - 1
    while (j >= 0 && /[\w$]/.test(source[j]!)) j -= 1
    if (j >= 0 && source[j] === ".") j -= 1
    i = j
  }

  return { builderDirect: false }
}

/** Detect builder-direct `.catch()` / `.finally()` in a single source file. */
export function collectViolations(relativePath: string, source: string): SupabaseBuilderCatchViolation[] {
  const violations: SupabaseBuilderCatchViolation[] = []
  const seen = new Set<number>()

  for (const catchIndex of findCatchSites(source)) {
    if (seen.has(catchIndex)) continue
    const { builderDirect } = analyzeCatchChain(source, catchIndex)
    if (!builderDirect) continue
    seen.add(catchIndex)
    violations.push({
      file: relativePath,
      line: lineNumber(source, catchIndex),
      snippet: snippetAt(source, catchIndex),
    })
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

function scanFiles(root: string, files: string[]): SupabaseBuilderCatchViolation[] {
  const allViolations: SupabaseBuilderCatchViolation[] = []
  for (const abs of files) {
    const rel = path.relative(root, abs).replace(/\\/g, "/")
    const source = fs.readFileSync(abs, "utf8")
    allViolations.push(...collectViolations(rel, source))
  }
  return allViolations
}

export type SupabaseBuilderCatchFixtureResult = {
  ok: boolean
  badFailures: string[]
  goodFailures: Array<{ fixture: string; violations: SupabaseBuilderCatchViolation[] }>
}

/** Self-test scanner against bad-* / good-* fixtures (no process exit). */
export function runSupabaseBuilderCatchFixtureSuite(
  root = process.cwd(),
): SupabaseBuilderCatchFixtureResult {
  const fixtureDir = path.join(root, GROWTH_SUPABASE_BUILDER_CATCH_FIXTURE_DIR)
  const badFailures: string[] = []
  const goodFailures: Array<{ fixture: string; violations: SupabaseBuilderCatchViolation[] }> = []

  if (!fs.existsSync(fixtureDir)) {
    return {
      ok: false,
      badFailures: ["missing fixture directory"],
      goodFailures: [],
    }
  }

  const entries = fs.readdirSync(fixtureDir).filter((name) => SOURCE_EXT.test(name))
  const badFixtures = entries.filter((name) => name.startsWith("bad-"))
  const goodFixtures = entries.filter((name) => name.startsWith("good-"))

  if (badFixtures.length === 0 || goodFixtures.length === 0) {
    return {
      ok: false,
      badFailures: ["expected bad-* and good-* fixtures"],
      goodFailures: [],
    }
  }

  for (const name of badFixtures) {
    const rel = `${GROWTH_SUPABASE_BUILDER_CATCH_FIXTURE_DIR}/${name}`
    const source = fs.readFileSync(path.join(fixtureDir, name), "utf8")
    const violations = collectViolations(rel, source)
    if (violations.length === 0) {
      badFailures.push(`${name} should FAIL but passed`)
    }
  }

  for (const name of goodFixtures) {
    const rel = `${GROWTH_SUPABASE_BUILDER_CATCH_FIXTURE_DIR}/${name}`
    const source = fs.readFileSync(path.join(fixtureDir, name), "utf8")
    const violations = collectViolations(rel, source)
    if (violations.length > 0) {
      goodFailures.push({ fixture: name, violations })
    }
  }

  return {
    ok: badFailures.length === 0 && goodFailures.length === 0,
    badFailures,
    goodFailures,
  }
}

/** Scan Growth production tree directories for builder-direct catch/finally. */
export function scanSupabaseBuilderCatchProductionTree(
  root = process.cwd(),
): SupabaseBuilderCatchViolation[] {
  const files: string[] = []
  for (const dir of GROWTH_SUPABASE_BUILDER_CATCH_SCAN_DIRS) {
    walk(path.join(root, dir), files)
  }
  return scanFiles(root, files)
}

export function formatSupabaseBuilderCatchViolations(
  violations: SupabaseBuilderCatchViolation[],
): string[] {
  return violations.map((v) => `  ${v.file}:${v.line}  ${v.snippet}`)
}
