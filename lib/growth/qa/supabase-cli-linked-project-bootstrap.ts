/**
 * Resolve production Supabase credentials from the linked Supabase CLI project.
 * Used when Vercel Production env pull/run cannot materialize Sensitive secrets locally.
 */

import { execSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

export function resolveLinkedSupabaseProjectRef(cwd = process.cwd()): string | null {
  const refPath = resolve(cwd, "supabase/.temp/project-ref")
  if (existsSync(refPath)) {
    const ref = readFileSync(refPath, "utf8").trim()
    if (ref) return ref
  }

  for (const key of ["SUPABASE_PROJECT_REF", "NEXT_PUBLIC_SUPABASE_PROJECT_REF"]) {
    const value = (process.env[key] ?? "").trim()
    if (value) return value
  }

  return null
}

function fetchSupabaseApiKeysFromCli(projectRef: string): Array<{ name: string; api_key: string }> | null {
  try {
    const raw = execSync(`supabase projects api-keys --project-ref ${projectRef} -o json`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
    const rows = JSON.parse(raw) as Array<{ name: string; api_key: string }>
    return Array.isArray(rows) ? rows : null
  } catch {
    return null
  }
}

export function fetchSupabaseServiceRoleKeyFromCli(projectRef: string): string | null {
  const rows = fetchSupabaseApiKeysFromCli(projectRef)
  const row = rows?.find((entry) => entry.name === "service_role")
  const apiKey = row?.api_key?.trim()
  return apiKey || null
}

export function fetchSupabaseAnonKeyFromCli(projectRef: string): string | null {
  const rows = fetchSupabaseApiKeysFromCli(projectRef)
  const row = rows?.find((entry) => entry.name === "anon")
  const apiKey = row?.api_key?.trim()
  return apiKey || null
}

export function resolveSupabaseUrlForProjectRef(projectRef: string): string {
  return `https://${projectRef}.supabase.co`
}
