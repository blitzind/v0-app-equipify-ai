/**
 * Read-only Supabase migration drift guard.
 * Run: pnpm check:migration-drift
 *
 * Compares local migration files with linked remote schema_migrations via Supabase CLI.
 * Does not modify the database.
 */
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

type MigrationRow = {
  local: string | null
  remote: string | null
}

function parseMigrationList(output: string): MigrationRow[] {
  const rows: MigrationRow[] = []
  for (const line of output.split("\n")) {
    const trimmed = line.trim()
    if (!/^\d{14}\s/.test(trimmed)) continue
    const match = trimmed.match(/^(\d{14})\s+\|\s+(\d{14})?\s*\|/)
    if (!match) continue
    const local = match[1]
    const remote = match[2] ?? null
    rows.push({ local, remote })
  }
  return rows
}

function readLocalMigrationVersions(): string[] {
  const dir = path.join(process.cwd(), "supabase/migrations")
  return fs
    .readdirSync(dir)
    .filter((name) => /^\d{14}_.+\.sql$/.test(name))
    .map((name) => name.slice(0, 14))
    .sort()
}

function findDuplicateVersions(versions: string[]): string[] {
  const counts = new Map<string, number>()
  for (const version of versions) {
    counts.set(version, (counts.get(version) ?? 0) + 1)
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([version]) => version)
}

function main(): void {
  const localFiles = readLocalMigrationVersions()
  const duplicateLocal = findDuplicateVersions(localFiles)

  let listOutput = ""
  let listError: string | null = null
  try {
    listOutput = execFileSync("npx", ["supabase", "migration", "list"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string }
    listOutput = err.stdout ?? ""
    listError = err.stderr ?? err.message ?? "Could not run supabase migration list"
  }

  const rows = parseMigrationList(listOutput)
  const localOnly = rows.filter((row) => row.local && !row.remote).map((row) => row.local as string)
  const remoteOnly = rows.filter((row) => row.remote && !row.local).map((row) => row.remote as string)

  const remoteVersions = rows.filter((row) => row.remote).map((row) => row.remote as string).sort()
  const localFromCli = rows.filter((row) => row.local).map((row) => row.local as string).sort()

  const orderingGaps: string[] = []
  for (const remote of remoteVersions) {
    const missingEarlierLocal = localFromCli.filter((local) => local < remote && !remoteVersions.includes(local))
    if (missingEarlierLocal.length > 0) {
      orderingGaps.push(
        `Remote has ${remote} but earlier local migrations are not on remote: ${missingEarlierLocal.join(", ")}`,
      )
    }
  }

  const growthLocal = localFiles.filter((v) => v >= "20270527000000")
  const growthRemote = remoteVersions.filter((v) => v >= "20270527000000")
  const growthPending = growthLocal.filter((v) => !growthRemote.includes(v))

  console.log("=== Supabase migration drift check (read-only) ===\n")
  console.log(`Local migration files: ${localFiles.length}`)
  console.log(`Growth migrations (>= 20270527): ${growthLocal.length} local, ${growthRemote.length} remote`)

  if (listError) {
    console.warn(`\nWarning: migration list stderr: ${listError.trim()}`)
  }

  const blockingDrift = duplicateLocal.length > 0 || remoteOnly.length > 0

  if (duplicateLocal.length > 0) {
    console.error("\nERROR: Duplicate local migration version timestamps:")
    for (const version of duplicateLocal) console.error(`  - ${version}`)
  }

  if (localOnly.length > 0) {
    console.warn("\nLocal-only (not applied remotely yet):")
    for (const version of localOnly) console.warn(`  - ${version}`)
  }

  if (remoteOnly.length > 0) {
    console.error("\nERROR: Remote-only (missing local files — investigate before deploy):")
    for (const version of remoteOnly) console.error(`  - ${version}`)
  }

  if (orderingGaps.length > 0) {
    console.warn("\nWARNING: Out-of-order migration history (apply missing migrations with db push, not --include-all):")
    for (const gap of orderingGaps) console.warn(`  - ${gap}`)
  }

  if (growthPending.length > 0) {
    console.warn("\nPending Growth migrations to apply with db push:")
    for (const version of growthPending) console.warn(`  - ${version}`)
  }

  if (!blockingDrift && orderingGaps.length === 0 && growthPending.length === 0 && duplicateLocal.length === 0) {
    console.log("\nNo migration drift detected.")
    process.exit(0)
  }

  if (blockingDrift) {
    console.error("\nBlocking migration drift detected. Fix duplicate versions or missing local files before deploy.")
    process.exit(1)
  }

  console.log("\nNo blocking drift. Pending/out-of-order migrations may still need db push.")
  process.exit(0)
}

main()
