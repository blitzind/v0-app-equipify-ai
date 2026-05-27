import fs from "node:fs"
import path from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"

/** SQL markers that uniquely identify the provider query cache migration. */
export const GROWTH_PROVIDER_CACHE_SCHEMA_MARKERS = [
  "growth.provider_query_cache",
  "provider_query_cache_provider_hash_unique",
  "Provider query cache + cost control",
] as const

const DEFAULT_MIGRATIONS_DIR = path.join(process.cwd(), "supabase/migrations")

export function assertGrowthProviderCacheSchemaMigrationContent(migrationSql: string): void {
  for (const marker of GROWTH_PROVIDER_CACHE_SCHEMA_MARKERS) {
    if (!migrationSql.includes(marker)) {
      throw new Error(`Provider cache migration missing marker: ${marker}`)
    }
  }
}

/** Locate provider cache migration by required SQL content, not brittle filename. */
export function resolveGrowthProviderCacheSchemaMigration(
  migrationsDir = DEFAULT_MIGRATIONS_DIR,
): string {
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort()

  const matches = files.filter((file) => {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8")
    try {
      assertGrowthProviderCacheSchemaMigrationContent(sql)
      return true
    } catch {
      return false
    }
  })

  if (matches.length === 0) {
    throw new Error(
      "Provider cache schema migration not found. Expected SQL creating growth.provider_query_cache.",
    )
  }

  if (matches.length > 1) {
    throw new Error(`Multiple provider cache migrations matched: ${matches.join(", ")}`)
  }

  return matches[0]!
}

export const GROWTH_PROVIDER_CACHE_SCHEMA_MIGRATION = resolveGrowthProviderCacheSchemaMigration()

export const GROWTH_PROVIDER_CACHE_SCHEMA_SETUP_MESSAGE = `Provider query cache tables are not ready. Apply migration ${GROWTH_PROVIDER_CACHE_SCHEMA_MIGRATION}.`

export async function isGrowthProviderCacheSchemaReady(
  admin: SupabaseClient,
): Promise<boolean> {
  const { error } = await admin
    .schema("growth")
    .from("provider_query_cache")
    .select("id")
    .limit(1)
  return !error
}
