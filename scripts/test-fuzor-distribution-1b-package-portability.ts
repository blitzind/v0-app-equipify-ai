/**
 * FUZOR-DISTRIBUTION-1B — Production-portable @fuzor/* package source validation.
 * Run: pnpm test:fuzor-distribution-1b-package-portability
 */
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const VENDOR_DIR = path.join(ROOT, "vendor/fuzor-packages")
const MANIFEST_PATH = path.join(VENDOR_DIR, "MANIFEST.json")

type ManifestPackage = {
  name: string
  version: string
  file: string
  sha256: string
}

type Manifest = {
  distribution_milestone: string
  strategy: string
  packages: ManifestPackage[]
}

const ADOPTED_PACKAGES = [
  "@fuzor/configuration",
  "@fuzor/context",
  "@fuzor/decision-records",
  "@fuzor/event-bus",
  "@fuzor/identity",
  "@fuzor/knowledge",
  "@fuzor/memory",
  "@fuzor/observability",
  "@fuzor/sdk",
] as const

const LOCKFILE_BAD_PATH_PATTERNS = [
  /\.\.\/\.\.\/fuzor/,
  /\/fuzor\/packages\//,
  /file:\/Users\//,
] as const

async function main(): Promise<void> {
  console.log("[FUZOR-DISTRIBUTION-1B] Package portability validation")

  function sha256File(filePath: string): string {
    const hash = createHash("sha256")
    hash.update(fs.readFileSync(filePath))
    return hash.digest("hex")
  }

  assert.ok(fs.existsSync(MANIFEST_PATH), "Missing vendor/fuzor-packages/MANIFEST.json")
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as Manifest
  assert.equal(manifest.distribution_milestone, "FUZOR-DISTRIBUTION-1B")
  assert.equal(manifest.strategy, "committed-package-artifacts")
  assert.equal(manifest.packages.length, ADOPTED_PACKAGES.length)

  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")) as {
    dependencies: Record<string, string>
    pnpm?: { overrides?: Record<string, string> }
  }
  const lockfile = fs.readFileSync(path.join(ROOT, "pnpm-lock.yaml"), "utf8")

  for (const pattern of LOCKFILE_BAD_PATH_PATTERNS) {
    assert.doesNotMatch(lockfile, pattern, `pnpm-lock.yaml must not contain ${pattern}`)
  }

  for (const pkgName of ADOPTED_PACKAGES) {
    const dep = packageJson.dependencies[pkgName]
    const override = packageJson.pnpm?.overrides?.[pkgName]
    assert.ok(dep, `Missing dependency: ${pkgName}`)
    assert.match(dep, /^file:vendor\/fuzor-packages\//, `${pkgName} must use vendor tarball path`)
    assert.doesNotMatch(dep, /\.\.\/\.\.\/fuzor/, `${pkgName} must not reference sibling Fuzor path`)
    assert.equal(override, dep, `${pkgName} pnpm override must match dependency`)
  }

  for (const entry of manifest.packages) {
    const tarballPath = path.join(VENDOR_DIR, entry.file)
    assert.ok(fs.existsSync(tarballPath), `Missing tarball: ${entry.file}`)
    assert.equal(sha256File(tarballPath), entry.sha256, `Checksum mismatch for ${entry.file}`)

    const declared = packageJson.dependencies[entry.name]
    assert.ok(declared?.includes(entry.file), `${entry.name} dependency must reference ${entry.file}`)
    assert.equal(entry.version, "0.1.0", `${entry.name} version must remain 0.1.0`)
  }

  for (const pkgName of ADOPTED_PACKAGES) {
    const resolvedDir = path.join(ROOT, "node_modules", ...pkgName.split("/"))
    assert.ok(fs.existsSync(resolvedDir), `Installed package missing: ${pkgName}`)

    const resolvedPackageJson = JSON.parse(
      fs.readFileSync(path.join(resolvedDir, "package.json"), "utf8"),
    ) as { name: string; version: string; type?: string; exports?: Record<string, unknown> }
    assert.equal(resolvedPackageJson.name, pkgName)
    assert.equal(resolvedPackageJson.version, "0.1.0")
    assert.equal(resolvedPackageJson.type, "module")
    assert.ok(resolvedPackageJson.exports, `${pkgName} must expose package exports`)

    const distIndex = path.join(resolvedDir, "dist/index.js")
    const distTypes = path.join(resolvedDir, "dist/index.d.ts")
    assert.ok(fs.existsSync(distIndex), `${pkgName} dist/index.js missing after install`)
    assert.ok(fs.existsSync(distTypes), `${pkgName} dist/index.d.ts missing after install`)

    const resolvedRealPath = fs.realpathSync(resolvedDir)
    assert.ok(
      resolvedRealPath.startsWith(path.join(ROOT, "node_modules")),
      `${pkgName} must resolve inside repository node_modules`,
    )
    assert.doesNotMatch(resolvedRealPath, /\.\.\/\.\.\/fuzor/, `${pkgName} must not resolve to sibling Fuzor source`)
    assert.doesNotMatch(resolvedRealPath, /\/fuzor\/packages\//, `${pkgName} must not resolve to sibling Fuzor source`)
  }

  const identity = await import("@fuzor/identity")
  const observability = await import("@fuzor/observability")
  const configuration = await import("@fuzor/configuration")
  const knowledge = await import("@fuzor/knowledge")
  const memory = await import("@fuzor/memory")
  const context = await import("@fuzor/context")
  const decisionRecords = await import("@fuzor/decision-records")
  const eventBus = await import("@fuzor/event-bus")
  const sdk = await import("@fuzor/sdk")

  assert.equal(typeof identity.PLATFORM_ACTOR_AGENTS, "object")
  assert.equal(typeof observability.looksLikePostgrestMissingSchemaError, "function")
  assert.equal(typeof configuration.PLATFORM_RUNTIME_GUARDRAIL_LIMITS, "object")
  assert.equal(typeof knowledge.searchPlatformKnowledge, "function")
  assert.equal(typeof memory.runPlatformMemoryEngine, "function")
  assert.equal(typeof context.assemblePlatformContextForWorkOrder, "function")
  assert.equal(typeof decisionRecords.createPlatformDecisionRecord, "function")
  assert.equal(typeof eventBus.insertPlatformEvent, "function")
  assert.equal(sdk.FUZOR_SDK_QA_MARKER, "fuzor-sdk-1a-stable-platform-v1")

  console.log("[FUZOR-DISTRIBUTION-1B] PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
