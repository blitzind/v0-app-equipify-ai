import { execSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import {
  GROWTH_BROWSER_EXTENSION_DIR,
  GROWTH_BROWSER_EXTENSION_DOWNLOAD_PATH,
  GROWTH_BROWSER_EXTENSION_PACKAGE_FILES,
} from "../../lib/growth/browser-intake/extension-install-types"
import {
  GROWTH_BROWSER_EXTENSION_PACKAGE_METADATA_FILENAME,
  GROWTH_BROWSER_EXTENSION_PACKAGE_METADATA_PUBLIC_FILENAME,
  type GrowthBrowserExtensionPackageMetadata,
} from "../../lib/growth/browser-intake/extension-package-metadata-types"

export const GROWTH_EXTENSION_STALE_ZIP_MESSAGE =
  "Run pnpm package:growth-extension before deploy." as const

const root = process.cwd()
const extensionDir = path.join(root, GROWTH_BROWSER_EXTENSION_DIR)
const outputDir = path.join(root, "public/downloads")
const outputZip = path.join(outputDir, path.basename(GROWTH_BROWSER_EXTENSION_DOWNLOAD_PATH))
const outputMetadata = path.join(outputDir, GROWTH_BROWSER_EXTENSION_PACKAGE_METADATA_PUBLIC_FILENAME)

function assertRequiredSourceFiles(): void {
  if (!fs.existsSync(extensionDir)) {
    throw new Error(`Missing extension directory: ${extensionDir}`)
  }

  for (const file of GROWTH_BROWSER_EXTENSION_PACKAGE_FILES) {
    const filePath = path.join(extensionDir, file)
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing required extension file: ${file}`)
    }
  }
}

function listExtensionSourceFiles(dir = extensionDir): string[] {
  const files: string[] = []

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".DS_Store") continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...listExtensionSourceFiles(fullPath))
    } else {
      files.push(fullPath)
    }
  }

  return files
}

export function readExtensionManifestVersion(): string {
  const manifestPath = path.join(extensionDir, "manifest.json")
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { version?: string }
  const version = manifest.version?.trim()
  if (!version) throw new Error("manifest.json is missing version.")
  return version
}

export function resolveGitSha(): string | null {
  try {
    const sha = execSync("git rev-parse --short HEAD", {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
    return sha || null
  } catch {
    return null
  }
}

export function buildGrowthExtensionPackageMetadata(): GrowthBrowserExtensionPackageMetadata {
  return {
    extension_version: readExtensionManifestVersion(),
    generated_at: new Date().toISOString(),
    git_sha: resolveGitSha(),
  }
}

function copyExtensionSourceTo(targetDir: string): void {
  fs.cpSync(extensionDir, targetDir, { recursive: true })
}

function writeMetadataFiles(metadata: GrowthBrowserExtensionPackageMetadata, stagingDir: string): void {
  const serialized = `${JSON.stringify(metadata, null, 2)}\n`
  fs.writeFileSync(path.join(stagingDir, GROWTH_BROWSER_EXTENSION_PACKAGE_METADATA_FILENAME), serialized)
  fs.mkdirSync(outputDir, { recursive: true })
  fs.writeFileSync(outputMetadata, serialized)
}

function createZipFromStaging(stagingDir: string): void {
  if (fs.existsSync(outputZip)) fs.unlinkSync(outputZip)

  execSync(`zip -r "${outputZip}" growth-browser-intake -x "*.DS_Store"`, {
    cwd: path.dirname(stagingDir),
    stdio: "inherit",
  })
}

export function getGrowthExtensionZipPath(): string {
  return outputZip
}

export function getGrowthExtensionPackageMetadataPath(): string {
  return outputMetadata
}

export function assertGrowthExtensionZipExists(): void {
  if (!fs.existsSync(outputZip)) {
    throw new Error(
      `Missing ${path.relative(root, outputZip)}. Run pnpm package:growth-extension before deploy.`,
    )
  }
}

export function findStaleGrowthExtensionSourceFiles(): string[] {
  assertGrowthExtensionZipExists()
  const zipMtime = fs.statSync(outputZip).mtimeMs
  return listExtensionSourceFiles().filter((filePath) => fs.statSync(filePath).mtimeMs > zipMtime)
}

export function assertGrowthExtensionZipFresh(): void {
  const staleFiles = findStaleGrowthExtensionSourceFiles()
  if (staleFiles.length === 0) return

  const relative = staleFiles
    .slice(0, 5)
    .map((filePath) => path.relative(root, filePath))
    .join(", ")
  const suffix = staleFiles.length > 5 ? ` (+${staleFiles.length - 5} more)` : ""
  throw new Error(`${GROWTH_EXTENSION_STALE_ZIP_MESSAGE} Stale source: ${relative}${suffix}`)
}

export function readPackagedGrowthExtensionMetadata(): GrowthBrowserExtensionPackageMetadata {
  assertGrowthExtensionZipExists()
  if (!fs.existsSync(outputMetadata)) {
    throw new Error(
      `Missing ${path.relative(root, outputMetadata)}. Run pnpm package:growth-extension before deploy.`,
    )
  }

  const metadata = JSON.parse(
    fs.readFileSync(outputMetadata, "utf8"),
  ) as GrowthBrowserExtensionPackageMetadata

  if (!metadata.extension_version || !metadata.generated_at) {
    throw new Error("Package metadata is missing extension_version or generated_at.")
  }

  return metadata
}

export function assertGrowthExtensionPackageMetadataMatchesManifest(): void {
  const metadata = readPackagedGrowthExtensionMetadata()
  const manifestVersion = readExtensionManifestVersion()
  if (metadata.extension_version !== manifestVersion) {
    throw new Error(
      `Package metadata version ${metadata.extension_version} does not match manifest.json ${manifestVersion}.`,
    )
  }
}

export function assertGrowthExtensionZipContainsRequiredFiles(): void {
  assertGrowthExtensionZipExists()
  const zipListing = execSync(`unzip -l "${outputZip}"`, { encoding: "utf8" })
  const required = [...GROWTH_BROWSER_EXTENSION_PACKAGE_FILES, GROWTH_BROWSER_EXTENSION_PACKAGE_METADATA_FILENAME]

  for (const file of required) {
    const pattern = new RegExp(`growth-browser-intake/${file.replace(".", "\\.")}`)
    if (!pattern.test(zipListing)) {
      throw new Error(`ZIP is missing growth-browser-intake/${file}`)
    }
  }
}

export function packageGrowthBrowserExtension(): GrowthBrowserExtensionPackageMetadata {
  assertRequiredSourceFiles()
  const metadata = buildGrowthExtensionPackageMetadata()
  const stagingRoot = fs.mkdtempSync(path.join(os.tmpdir(), "equipify-growth-extension-"))
  const stagingDir = path.join(stagingRoot, "growth-browser-intake")

  try {
    copyExtensionSourceTo(stagingDir)
    writeMetadataFiles(metadata, stagingDir)
    createZipFromStaging(stagingDir)
    assertGrowthExtensionZipExists()
    assertGrowthExtensionZipContainsRequiredFiles()
    assertGrowthExtensionPackageMetadataMatchesManifest()
    return metadata
  } finally {
    fs.rmSync(stagingRoot, { recursive: true, force: true })
  }
}

export function verifyGrowthExtensionPackage(options?: { allowStale?: boolean }): void {
  assertGrowthExtensionZipExists()
  assertGrowthExtensionZipContainsRequiredFiles()
  assertGrowthExtensionPackageMetadataMatchesManifest()
  if (!options?.allowStale) {
    assertGrowthExtensionZipFresh()
  }
}
