/**
 * Phase 7.2A — Canonical company backfill (dry-run default).
 *
 *   pnpm tsx scripts/backfill-growth-canonical-companies-7.2a.ts
 *   pnpm tsx scripts/backfill-growth-canonical-companies-7.2a.ts --apply
 */
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"
import { runCanonicalCompanyBackfill } from "../lib/growth/canonical-companies/canonical-company-backfill"
import { isGrowthCanonicalCompanySchemaReady } from "../lib/growth/canonical-companies/canonical-company-schema-health"
import { GROWTH_CANONICAL_COMPANY_QA_MARKER } from "../lib/growth/canonical-companies/canonical-company-types"

function loadEnvFile(path: string): void {
  try {
    const raw = readFileSync(path, "utf8")
    for (const line of raw.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq)
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      value = value.replace(/\\+$/g, "")
      const current = process.env[key]?.trim() ?? ""
      const keyUsable =
        key.includes("SUPABASE") || key.includes("URL")
          ? current.startsWith("eyJ") || current.includes("supabase.co") || current.startsWith("sb_secret_")
          : Boolean(current)
      if (value && !keyUsable) process.env[key] = value
    }
  } catch {
    /* optional */
  }
}

function loadActiveSupabaseCredentials(): void {
  try {
    const raw = readFileSync(".env.local.active", "utf8")
    const jwtKeys: string[] = []
    for (const line of raw.split("\n")) {
      const trimmed = line.trim()
      if (trimmed.startsWith("SUPABASE_SERVICE_ROLE_KEY=")) {
        let value = trimmed.slice("SUPABASE_SERVICE_ROLE_KEY=".length).trim()
        value = value.replace(/^['"]+|['"]+$/g, "").replace(/\\+$/g, "")
        if (value.startsWith("eyJ")) jwtKeys.push(value)
      }
    }
    const jwt = jwtKeys.sort((a, b) => b.length - a.length)[0]
    const currentKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? ""
    if (jwt && (!currentKey.startsWith("eyJ") || currentKey.length < jwt.length)) {
      process.env.SUPABASE_SERVICE_ROLE_KEY = jwt
    }
    if (jwt) {
      const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString()) as {
        ref?: string
      }
      const currentUrl = (
        process.env.NEXT_PUBLIC_SUPABASE_URL ??
        process.env.SUPABASE_URL ??
        ""
      ).trim()
      if (payload.ref && !currentUrl.includes("supabase.co")) {
        process.env.NEXT_PUBLIC_SUPABASE_URL = `https://${payload.ref}.supabase.co`
      }
    }
  } catch {
    /* optional */
  }
}

async function main(): Promise<void> {
  for (const path of [".env.local", ".env.local.active", ".env.vercel.production"]) {
    loadEnvFile(path)
  }
  loadActiveSupabaseCredentials()

  const apply = process.argv.includes("--apply")
  const mode = apply ? "apply" : "dry_run"

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error(
      JSON.stringify({
        error: "missing_supabase_credentials",
        hint: "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
      }),
    )
    process.exit(1)
  }

  if (apply && process.env.GROWTH_CANONICAL_COMPANY_APPLY_CONFIRM !== "yes") {
    console.error(
      JSON.stringify({
        error: "apply_blocked",
        hint: "Set GROWTH_CANONICAL_COMPANY_APPLY_CONFIRM=yes to run apply mode",
      }),
    )
    process.exit(1)
  }

  const admin = createClient(url, key, { auth: { persistSession: false } })
  const ready = await isGrowthCanonicalCompanySchemaReady(admin)
  if (!ready) {
    console.error(
      JSON.stringify({
        error: "schema_not_ready",
        hint: "Apply migration 20270708120000_growth_engine_canonical_companies_7_2a.sql first",
      }),
    )
    process.exit(1)
  }

  const report = await runCanonicalCompanyBackfill(admin, { mode })
  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_CANONICAL_COMPANY_QA_MARKER,
        mode,
        ...report,
      },
      null,
      2,
    ),
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
