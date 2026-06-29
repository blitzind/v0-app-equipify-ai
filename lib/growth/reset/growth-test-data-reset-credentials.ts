/**
 * GS-GROWTH-OPS-7B — Credential resolution for Growth reset CLI.
 *
 * Does not read .env.local or Vercel env files.
 */

import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import readline from "node:readline"
import type { GrowthProductionSupabaseConfig } from "@/lib/growth/canonical-companies/load-growth-production-supabase-env"

export const GROWTH_RESET_CREDENTIALS_HELP = `
Growth test data reset — Supabase credentials

This script never reads .env.local or Vercel env files (production values are encrypted).

Credential resolution order:
  1) Shell env
     export NEXT_PUBLIC_SUPABASE_URL="https://<project-ref>.supabase.co"
     export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"

  2) Supabase CLI / Management API
     export SUPABASE_PROJECT_REF="<project-ref>"
     export SUPABASE_ACCESS_TOKEN="<personal-access-token>"
     # Token: https://supabase.com/dashboard/account/tokens
     # Fetches service role via GET /v1/projects/{ref}/api-keys?reveal=true

  3) Interactive prompt (TTY only, skipped with --no-prompt)
     Prompts for project ref + service role key (hidden input)

Modes:
  pnpm growth:reset-test-data --dry-run
  GROWTH_RESET_TEST_DATA_CONFIRM=yes pnpm growth:reset-test-data --confirm
  pnpm growth:reset-test-data --report
  pnpm growth:reset-test-data --inventory-only

Flags:
  --help, -h          Show this help
  --dry-run           Audit + counts only (no writes)
  --confirm           Delete test data (requires GROWTH_RESET_TEST_DATA_CONFIRM=yes)
  --report            Print summary from tmp/ reports
  --inventory-only    Print table catalog JSON (no DB)
  --no-prompt         Do not prompt for credentials interactively
  --local             Allow localhost Supabase URLs

Vercel encrypted env values cannot be pulled. Get the service role key from
Supabase Dashboard → Project Settings → API, or provide SUPABASE_PROJECT_REF
+ SUPABASE_ACCESS_TOKEN.
`.trim()

export const GROWTH_RESET_CREDENTIALS_ERROR =
  "Vercel encrypted env values cannot be pulled. Get the service role key from Supabase Dashboard → Project Settings → API, or provide SUPABASE_PROJECT_REF + SUPABASE_ACCESS_TOKEN."

export type ResolveGrowthResetSupabaseOptions = {
  cwd?: string
  allowLocal?: boolean
  allowPrompt?: boolean
}

type SupabaseApiKeyRecord = {
  name?: string
  type?: string
  api_key?: string
  secret_jwt_template?: { role?: string }
}

function isUsableSupabaseUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === "https:" || (parsed.protocol === "http:" && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1"))
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

function normalizeEnvValue(value: string | undefined): string {
  if (!value) return ""
  let normalized = value.trim()
  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1).trim()
  }
  return normalized.replace(/\\+$/g, "")
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

export function extractSupabaseProjectRefFromUrl(url: string): string | null {
  return extractProjectRef(url)
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

function pickShellEnv(): { url: string; serviceRoleKey: string } | null {
  const env = process.env as Record<string, string | undefined>
  const url =
    [
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_URL,
      env.PRODUCTION_NEXT_PUBLIC_SUPABASE_URL,
      env.PRODUCTION_SUPABASE_URL,
    ]
      .map(normalizeEnvValue)
      .find((value) => value && isUsableSupabaseUrl(value)) ?? ""
  const serviceRoleKey =
    [env.SUPABASE_SERVICE_ROLE_KEY, env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY]
      .map(normalizeEnvValue)
      .find((value) => value && isUsableServiceRoleKey(value)) ?? ""
  if (!url || !serviceRoleKey) return null
  return { url, serviceRoleKey }
}

export function describeGrowthResetShellEnvGap(): string {
  const env = process.env as Record<string, string | undefined>
  const url =
    [
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_URL,
      env.PRODUCTION_NEXT_PUBLIC_SUPABASE_URL,
      env.PRODUCTION_SUPABASE_URL,
    ]
      .map(normalizeEnvValue)
      .find((value) => value && isUsableSupabaseUrl(value)) ?? ""
  const serviceRoleKey =
    [env.SUPABASE_SERVICE_ROLE_KEY, env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY]
      .map(normalizeEnvValue)
      .find((value) => value && isUsableServiceRoleKey(value)) ?? ""

  if (url && !serviceRoleKey) {
    return "NEXT_PUBLIC_SUPABASE_URL is set but SUPABASE_SERVICE_ROLE_KEY is missing or invalid (expected eyJ… or sb_secret_…)."
  }
  if (serviceRoleKey && !url) {
    return "SUPABASE_SERVICE_ROLE_KEY is set but NEXT_PUBLIC_SUPABASE_URL is missing or invalid."
  }
  return "Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in shell env."
}

export function pickServiceRoleFromApiKeys(keys: SupabaseApiKeyRecord[]): string | null {
  const legacy = keys.find((key) => key.name === "service_role" && key.api_key)
  if (legacy?.api_key && isUsableServiceRoleKey(legacy.api_key)) return legacy.api_key

  const secret = keys.find(
    (key) =>
      key.type === "secret" &&
      key.secret_jwt_template?.role === "service_role" &&
      key.api_key &&
      isUsableServiceRoleKey(key.api_key),
  )
  if (secret?.api_key) return secret.api_key

  const fallbackSecret = keys.find(
    (key) => key.type === "secret" && key.api_key && isUsableServiceRoleKey(key.api_key),
  )
  return fallbackSecret?.api_key ?? null
}

export async function fetchServiceRoleKeyViaSupabaseManagementApi(input: {
  projectRef: string
  accessToken: string
}): Promise<string> {
  const url = `https://api.supabase.com/v1/projects/${encodeURIComponent(input.projectRef)}/api-keys?reveal=true`
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      Accept: "application/json",
    },
  })

  const bodyText = await response.text()
  if (!response.ok) {
    throw new Error(
      `Supabase Management API api-keys failed (${response.status}): ${bodyText.slice(0, 300)}`,
    )
  }

  let keys: SupabaseApiKeyRecord[]
  try {
    keys = JSON.parse(bodyText) as SupabaseApiKeyRecord[]
  } catch {
    throw new Error("Supabase Management API api-keys returned invalid JSON.")
  }

  const serviceRoleKey = pickServiceRoleFromApiKeys(Array.isArray(keys) ? keys : [])
  if (!serviceRoleKey) {
    throw new Error("Supabase Management API response did not include a service role key.")
  }
  return serviceRoleKey
}

async function promptLine(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

async function promptSecret(question: string): Promise<string> {
  if (!process.stdin.isTTY) {
    throw new Error("Cannot prompt for service role key without an interactive TTY.")
  }

  process.stdout.write(question)

  return new Promise((resolve, reject) => {
    const stdin = process.stdin
    const wasRaw = stdin.isRaw
    stdin.setRawMode?.(true)
    stdin.resume()
    stdin.setEncoding("utf8")

    let value = ""

    const cleanup = () => {
      stdin.setRawMode?.(wasRaw ?? false)
      stdin.pause()
      stdin.removeListener("data", onData)
      process.stdout.write("\n")
    }

    const onData = (chunk: string) => {
      const char = chunk

      if (char === "\u0003") {
        cleanup()
        reject(new Error("Credential prompt cancelled."))
        return
      }

      if (char === "\r" || char === "\n" || char === "\u0004") {
        cleanup()
        resolve(value.trim())
        return
      }

      if (char === "\u007f" || char === "\b") {
        value = value.slice(0, -1)
        return
      }

      value += char
    }

    stdin.on("data", onData)
  })
}

async function promptForCredentials(): Promise<{ projectRef: string; serviceRoleKey: string }> {
  const projectRef = await promptLine("Supabase project ref: ")
  if (!projectRef) {
    throw new Error("Project ref is required.")
  }
  const serviceRoleKey = await promptSecret("Supabase service role key (hidden): ")
  if (!isUsableServiceRoleKey(serviceRoleKey)) {
    throw new Error("Service role key must start with eyJ or sb_secret_.")
  }
  return { projectRef, serviceRoleKey }
}

function validateConfig(input: {
  url: string
  serviceRoleKey: string
  allowLocal: boolean
  linkedProjectRef: string | null
  credentialSource: string
}): GrowthProductionSupabaseConfig {
  const { url, serviceRoleKey, allowLocal, linkedProjectRef, credentialSource } = input

  if (!allowLocal && (url.includes("localhost") || url.includes("127.0.0.1"))) {
    throw new Error(
      "Refusing non-production Supabase URL (localhost). Export production NEXT_PUBLIC_SUPABASE_URL or pass --local.",
    )
  }

  if (!isUsableSupabaseUrl(url)) {
    throw new Error("Supabase URL must be https://<project-ref>.supabase.co (or localhost with --local).")
  }

  if (!isUsableServiceRoleKey(serviceRoleKey)) {
    throw new Error(GROWTH_RESET_CREDENTIALS_ERROR)
  }

  const urlRef = extractProjectRef(url)
  if (
    linkedProjectRef &&
    urlRef &&
    linkedProjectRef !== urlRef &&
    credentialSource !== "shell_env"
  ) {
    throw new Error(
      `Supabase URL project ref (${urlRef}) does not match linked project ref (${linkedProjectRef}). Aborting.`,
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

  return {
    url,
    serviceRoleKey,
    projectRef: urlRef ?? linkedProjectRef ?? jwtRef,
    urlHost: new URL(url).hostname,
    credentialSource,
    linkedProjectRef,
    schema: "growth",
  }
}

export async function resolveGrowthResetSupabaseConfig(
  options: ResolveGrowthResetSupabaseOptions = {},
): Promise<GrowthProductionSupabaseConfig> {
  const cwd = options.cwd ?? process.cwd()
  const allowLocal = options.allowLocal === true
  const allowPrompt = options.allowPrompt !== false
  const linkedProjectRef = readLinkedProjectRef(cwd)

  const shell = pickShellEnv()
  if (shell) {
    return validateConfig({
      ...shell,
      allowLocal,
      linkedProjectRef,
      credentialSource: "shell_env",
    })
  }

  const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim() ?? ""
  const projectRef =
    process.env.SUPABASE_PROJECT_REF?.trim() || linkedProjectRef || ""

  if (accessToken && projectRef) {
    const serviceRoleKey = await fetchServiceRoleKeyViaSupabaseManagementApi({
      projectRef,
      accessToken,
    })
    return validateConfig({
      url: urlFromProjectRef(projectRef),
      serviceRoleKey,
      allowLocal,
      linkedProjectRef,
      credentialSource: process.env.SUPABASE_PROJECT_REF?.trim()
        ? "supabase_management_api"
        : "supabase_management_api+linked_project_ref",
    })
  }

  if (allowPrompt && process.stdin.isTTY) {
    const prompted = await promptForCredentials()
    return validateConfig({
      url: urlFromProjectRef(prompted.projectRef),
      serviceRoleKey: prompted.serviceRoleKey,
      allowLocal,
      linkedProjectRef,
      credentialSource: "interactive_prompt",
    })
  }

  throw new Error(
    allowPrompt ? GROWTH_RESET_CREDENTIALS_ERROR : describeGrowthResetShellEnvGap(),
  )
}
