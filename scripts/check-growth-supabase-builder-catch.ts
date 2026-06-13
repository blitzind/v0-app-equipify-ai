/**
 * Guardrail: Supabase Postgrest builders are PromiseLike (.then only), not full Promises.
 * Direct `.catch()` / `.finally()` on a builder chain throws synchronously.
 *
 * Run: pnpm test:growth-supabase-builder-catch
 */
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const SCAN_DIRS = ["lib/growth", "app/api/platform/growth", "app/api/cron"]
const FIXTURE_DIR = path.join(ROOT, "scripts/fixtures/growth-supabase-builder-catch")
const SOURCE_EXT = /\.(tsx|ts)$/

const BUILDER_ROOT = /^(?:admin|[A-Za-z_$][\w$]*Table)$/
const TABLE_ADMIN_CALL = /^table\s*\(\s*admin\s*\)$/

type Violation = { file: string; line: number; snippet: string }

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

/**
 * Walk dot-call chain backward from `.catch`/`.finally`.
 * Returns builder-direct when chain roots at admin/table(admin) and never uses `.then()`.
 */
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

export function collectViolations(relativePath: string, source: string): Violation[] {
  const violations: Violation[] = []
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

function scanFiles(files: string[]): Violation[] {
  const allViolations: Violation[] = []
  for (const abs of files) {
    const rel = path.relative(ROOT, abs).replace(/\\/g, "/")
    const source = fs.readFileSync(abs, "utf8")
    allViolations.push(...collectViolations(rel, source))
  }
  return allViolations
}

function runFixtureTests(): void {
  if (!fs.existsSync(FIXTURE_DIR)) {
    console.error("check-growth-supabase-builder-catch: missing fixture directory.")
    process.exit(1)
  }

  const entries = fs.readdirSync(FIXTURE_DIR).filter((name) => SOURCE_EXT.test(name))
  const badFixtures = entries.filter((name) => name.startsWith("bad-"))
  const goodFixtures = entries.filter((name) => name.startsWith("good-"))

  if (badFixtures.length === 0 || goodFixtures.length === 0) {
    console.error("check-growth-supabase-builder-catch: expected bad-* and good-* fixtures.")
    process.exit(1)
  }

  for (const name of badFixtures) {
    const rel = `scripts/fixtures/growth-supabase-builder-catch/${name}`
    const source = fs.readFileSync(path.join(FIXTURE_DIR, name), "utf8")
    const violations = collectViolations(rel, source)
    if (violations.length === 0) {
      console.error(`check-growth-supabase-builder-catch: fixture ${name} should FAIL but passed.`)
      process.exit(1)
    }
  }

  for (const name of goodFixtures) {
    const rel = `scripts/fixtures/growth-supabase-builder-catch/${name}`
    const source = fs.readFileSync(path.join(FIXTURE_DIR, name), "utf8")
    const violations = collectViolations(rel, source)
    if (violations.length > 0) {
      console.error(`check-growth-supabase-builder-catch: fixture ${name} should PASS but failed:`)
      for (const v of violations) {
        console.error(`  ${v.file}:${v.line}  ${v.snippet}`)
      }
      process.exit(1)
    }
  }

  console.log("✓ builder-direct .catch() detected in bad fixtures")
  console.log("✓ safe patterns ignored in good fixtures")
}

function scanProductionTree(): Violation[] {
  const files: string[] = []
  for (const dir of SCAN_DIRS) {
    walk(path.join(ROOT, dir), files)
  }
  return scanFiles(files)
}

function main(): void {
  runFixtureTests()

  const violations = scanProductionTree()
  if (violations.length === 0) {
    console.log("check-growth-supabase-builder-catch: OK (no builder-direct .catch/.finally in production tree).")
    return
  }

  console.error("check-growth-supabase-builder-catch: FAILED")
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  ${v.snippet}`)
  }
  process.exit(1)
}

main()
