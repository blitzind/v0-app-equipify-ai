/**
 * Production Supabase credentials for Growth CLI scripts (no .env.local).
 */

import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

const PRODUCTION_ENV_FILES = [
  ".env.production.local",
  ".env.vercel.production",
  ".vercel/.env.production.local",
] as const

const BLOCKED_ENV_FILES = [".env.local", ".env.local.active", ".env.development.local"] as const

export type GrowthProductionSupabaseConfig = {
  url: string
  serviceRoleKey: string
  projectRef: string | null
  urlHost: string
  credentialSource: string
  linkedProjectRef: string | null
  schema: "growth"
}

function parseEnvFile(path: string): Record<string, string> {
  const vars: Record<string, string> = {}
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
    if (value) vars[key] = value
  }
  return vars
}

function readLinkedProjectRef(cwd: string): string | null {
  const paths = [
    join(cwd, "supabase/.temp/project-ref"),
    join(cwd, "supabase/.temp/linked-project.json"),
  ]
  for (const path of paths) {
    try {
      if (!existsSync(path)) continue
      const raw = readFileSync(path, "utf8").trim()
      if (path.endsWith("project-ref")) return raw || null
      const json = JSON.parse(raw) as { ref?: string }
      return json.ref?.trim() || null
    } catch {
      /* optional */
    }
  }
  return null
}

function isUsableSupabaseUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === "https:" && parsed.hostname.endsWith(".supabase.co")
  } catch {
    return false
  }
}

function isUsableServiceRoleKey(key: string): boolean {
  return key.startsWith("eyJ") || key.startsWith("sb_secret_")
}

function urlFromProjectRef(ref: string): string {
  return `https://${ref}.supabase.co`
}

function extractProjectRef(url: string): string | null {
  try {
    const host = new URL(url).hostname
    const match = host.match(/^([a-z0-9]+)\.supabase\.co$/i)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

function pickFromRecord(
  record: Record<string, string>,
  urlKeys: string[],
  keyKeys: string[],
): { url: string; key: string } {
  let url = ""
  let key = ""
  for (const k of urlKeys) {
    if (record[k] && isUsableSupabaseUrl(record[k])) {
      url = record[k]
      break
    }
  }
  for (const k of keyKeys) {
    if (record[k] && isUsableServiceRoleKey(record[k])) {
      key = record[k]
      break
    }
  }
  return { url, key }
}

export type ResolveGrowthProductionSupabaseOptions = {
  cwd?: string
  allowLocal?: boolean
}

export function resolveGrowthProductionSupabaseConfig(
  options: ResolveGrowthProductionSupabaseOptions = {},
): GrowthProductionSupabaseConfig {
  const cwd = options.cwd ?? process.cwd()
  const allowLocal = options.allowLocal === true
  const linkedRef = readLinkedProjectRef(cwd)

  const urlKeys = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_URL",
    "PRODUCTION_NEXT_PUBLIC_SUPABASE_URL",
    "PRODUCTION_SUPABASE_URL",
  ]
  const keyKeys = [
    "SUPABASE_SERVICE_ROLE_KEY",
    "PRODUCTION_SUPABASE_SERVICE_ROLE_KEY",
  ]

  let url = ""
  let serviceRoleKey = ""
  let credentialSource = "process.env"

  const fromEnv = pickFromRecord(process.env as Record<string, string>, urlKeys, keyKeys)
  url = fromEnv.url
  serviceRoleKey = fromEnv.key

  for (const blocked of BLOCKED_ENV_FILES) {
    if (existsSync(join(cwd, blocked))) {
      /* never loaded — presence alone is fine */
    }
  }

  if (!url || !serviceRoleKey) {
    for (const file of PRODUCTION_ENV_FILES) {
      const path = join(cwd, file)
      if (!existsSync(path)) continue
      try {
        const fromFile = pickFromRecord(parseEnvFile(path), urlKeys, keyKeys)
        if (!url && fromFile.url) {
          url = fromFile.url
          credentialSource = file
        }
        if (!serviceRoleKey && fromFile.key) {
          serviceRoleKey = fromFile.key
          credentialSource = file
        }
      } catch {
        /* optional */
      }
      if (url && serviceRoleKey) break
    }
  }

  if (!url && linkedRef) {
    url = urlFromProjectRef(linkedRef)
    if (!serviceRoleKey) {
      credentialSource = "linked_project_ref_only"
    } else if (credentialSource === "process.env") {
      credentialSource = `process.env+supabase/.temp/project-ref`
    }
  }

  if (!allowLocal && url && (url.includes("localhost") || url.includes("127.0.0.1"))) {
    throw new Error(
      "Refusing non-production Supabase URL (localhost). Export production NEXT_PUBLIC_SUPABASE_URL or pass --local for explicit local runs.",
    )
  }

  if (!isUsableSupabaseUrl(url)) {
    throw new Error(
      "Missing production NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL). Must be https://<project-ref>.supabase.co. Linked ref: " +
        (linkedRef ?? "none"),
    )
  }

  if (!isUsableServiceRoleKey(serviceRoleKey)) {
    throw new Error(
      "Missing production SUPABASE_SERVICE_ROLE_KEY in environment. Do not use .env.local; export the production service role key before running this script.",
    )
  }

  const urlRef = extractProjectRef(url)
  if (linkedRef && urlRef && linkedRef !== urlRef) {
    throw new Error(
      `Supabase URL project ref (${urlRef}) does not match linked project ref (${linkedRef}). Aborting to avoid wrong database.`,
    )
  }

  const jwtRef = serviceRoleKey.startsWith("eyJ")
    ? (() => {
        try {
          const payload = JSON.parse(
            Buffer.from(serviceRoleKey.split(".")[1], "base64url").toString(),
          ) as { ref?: string }
          return payload.ref?.trim() ?? null
        } catch {
          return null
        }
      })()
    : null

  if (jwtRef && urlRef && jwtRef !== urlRef) {
    throw new Error(
      `Service role JWT ref (${jwtRef}) does not match URL project ref (${urlRef}). Aborting.`,
    )
  }

  const projectRef = urlRef ?? linkedRef ?? jwtRef

  return {
    url,
    serviceRoleKey,
    projectRef,
    urlHost: new URL(url).hostname,
    credentialSource,
    linkedProjectRef: linkedRef,
    schema: "growth",
  }
}

export function formatGrowthProductionTargetBanner(
  config: GrowthProductionSupabaseConfig,
  mode: "dry_run" | "apply",
): Record<string, unknown> {
  return {
    target_schema: config.schema,
    mode,
    supabase_url_host: config.urlHost,
    supabase_project_ref: config.projectRef,
    linked_project_ref: config.linkedProjectRef,
    credential_source: config.credentialSource,
    apply_confirm_required: mode === "apply" ? "GROWTH_CANONICAL_COMPANY_APPLY_CONFIRM=yes" : null,
  }
}
