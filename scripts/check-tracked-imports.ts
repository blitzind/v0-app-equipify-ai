/**
 * Guardrail: tracked app/lib/components/hooks/actions code must not import local
 * modules that exist on disk but are not committed (common cause of Vercel-only failures).
 *
 * Run: pnpm check:tracked-imports (also runs as prebuild before pnpm build)
 */
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const SCAN_PREFIXES = ["app/", "components/", "lib/", "hooks/", "actions/"]
const SOURCE_EXT = /\.(tsx|ts|jsx|js)$/

function isInsideGitWorkTree(): boolean {
  try {
    execSync("git rev-parse --is-inside-work-tree", { cwd: ROOT, stdio: "ignore" })
    return true
  } catch {
    return false
  }
}

function gitLsFiles(): Set<string> {
  const out = execSync("git ls-files", { cwd: ROOT, encoding: "utf8" })
  return new Set(
    out
      .split("\n")
      .filter(Boolean)
      .map((p) => p.replace(/\\/g, "/")),
  )
}

function shouldScanTrackedEntry(entry: string): boolean {
  if (!SOURCE_EXT.test(entry)) return false
  if (entry.includes("node_modules")) return false
  return SCAN_PREFIXES.some((p) => entry.startsWith(p))
}

function extractImportSpecifiers(source: string): string[] {
  const specs: string[] = []
  const patterns = [
    /\bfrom\s+['"]([^'"]+)['"]/g,
    /\bimport\s+['"]([^'"]+)['"]/g,
    /\bexport\s+[^;]*?\sfrom\s+['"]([^'"]+)['"]/g,
  ]
  for (const re of patterns) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(source)) !== null) {
      const s = m[1]?.trim()
      if (s) specs.push(s.split("?", 1)[0]!)
    }
  }
  return specs
}

function isLocalResolvableSpecifier(spec: string): boolean {
  return spec.startsWith("@/") || spec.startsWith("./") || spec.startsWith("../")
}

function resolveLocalImport(fromTrackedRelative: string, spec: string): string | null {
  const fromAbs = path.join(ROOT, fromTrackedRelative)
  const fromDir = path.dirname(fromAbs)

  let baseAbs: string
  if (spec.startsWith("@/")) {
    baseAbs = path.join(ROOT, spec.slice(2))
  } else if (spec.startsWith("./") || spec.startsWith("../")) {
    baseAbs = path.resolve(fromDir, spec)
  } else {
    return null
  }

  if (!baseAbs.startsWith(ROOT)) {
    return null
  }

  const suffixes = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]
  for (const suf of suffixes) {
    const candidate = baseAbs + suf
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return path.relative(ROOT, candidate).replace(/\\/g, "/")
      }
    } catch {
      /* ignore */
    }
  }

  for (const index of ["/index.ts", "/index.tsx", "/index.js", "/index.jsx"]) {
    const candidate = baseAbs + index
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return path.relative(ROOT, candidate).replace(/\\/g, "/")
      }
    } catch {
      /* ignore */
    }
  }

  try {
    if (fs.existsSync(baseAbs) && fs.statSync(baseAbs).isDirectory()) {
      for (const index of ["index.ts", "index.tsx", "index.js", "index.jsx"]) {
        const candidate = path.join(baseAbs, index)
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return path.relative(ROOT, candidate).replace(/\\/g, "/")
        }
      }
    }
  } catch {
    /* ignore */
  }

  return null
}

type Violation = { from: string; spec: string; resolved: string }

function main(): void {
  if (!isInsideGitWorkTree()) {
    console.warn("check-tracked-imports: not a git repository — skipping.")
    process.exit(0)
  }

  const tracked = gitLsFiles()
  const violations: Violation[] = []

  for (const entry of tracked) {
    if (!shouldScanTrackedEntry(entry)) continue

    const abs = path.join(ROOT, entry)
    let source: string
    try {
      source = fs.readFileSync(abs, "utf8")
    } catch {
      continue
    }

    const specs = extractImportSpecifiers(source)
    const seen = new Set<string>()
    for (const spec of specs) {
      if (!isLocalResolvableSpecifier(spec)) continue
      if (seen.has(spec)) continue
      seen.add(spec)

      const resolved = resolveLocalImport(entry, spec)
      if (!resolved) continue
      if (tracked.has(resolved)) continue

      violations.push({ from: entry, spec, resolved })
    }
  }

  if (violations.length === 0) {
    console.log("check-tracked-imports: OK (no tracked → untracked local imports detected).")
    process.exit(0)
  }

  console.error("")
  console.error("check-tracked-imports: FAILED")
  console.error(
    "Tracked source under app/, components/, lib/, hooks/, or actions/ imports a local file that is not in the git index.",
  )
  console.error("That breaks builds on fresh clones (e.g. Vercel). Add the file to git or fix the import.")
  console.error("")
  for (const v of violations) {
    console.error(`  ${v.from}`)
    console.error(`    import: ${v.spec}`)
    console.error(`    resolves to: ${v.resolved} (on disk but not tracked)`)
    console.error("")
  }
  console.error("Fix: git add <path>  or  remove / change the import.")
  console.error("")
  process.exit(1)
}

main()
