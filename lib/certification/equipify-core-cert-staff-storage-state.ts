/**
 * EC-6B — cert-org staff Playwright storage state (magic link; no .env.local).
 */

import { execSync } from "node:child_process"
import { existsSync, mkdirSync } from "node:fs"
import { resolve } from "node:path"
import type { Page } from "@playwright/test"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { ACTIVE_ORG_STORAGE_KEY } from "@/lib/auth/session-context-storage"
import { EQUIPIFY_CORE_PRODUCTION_HOST } from "@/lib/certification/equipify-core-runtime-inventory"
import { resolveLinkedSupabaseProjectRef } from "@/lib/growth/qa/supabase-cli-linked-project-bootstrap"

export const EQUIPIFY_CORE_CERT_STORAGE_PATH = "scripts/.equipify-core-cert-storage-state.json"

const ROLE_PRIORITY = ["owner", "admin", "manager"] as const

export type CertOrgStaffResolution = {
  user_id: string
  email: string
  role: string
  organization_id: string
}

function resolveAnonKey(supabaseUrl: string): string {
  const fromEnv = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim()
  if (fromEnv) return fromEnv
  const projectRef =
    resolveLinkedSupabaseProjectRef() ?? supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
  if (!projectRef) throw new Error("Could not resolve Supabase anon key (no project ref).")
  const raw = execSync(`supabase projects api-keys --project-ref ${projectRef} -o json`, {
    encoding: "utf8",
  })
  const anon = (JSON.parse(raw) as Array<{ name: string; api_key: string }>).find(
    (entry) => entry.name === "anon",
  )?.api_key
  if (!anon?.trim()) throw new Error("Could not resolve Supabase anon key from CLI.")
  return anon.trim()
}

export async function resolveCertOrgStaffMember(
  admin: SupabaseClient,
  organizationId: string,
): Promise<CertOrgStaffResolution | null> {
  const { data: members, error } = await admin
    .from("organization_members")
    .select("user_id, role")
    .eq("organization_id", organizationId)
    .eq("status", "active")

  if (error || !members?.length) return null

  const sorted = [...members].sort((a, b) => {
    const aIdx = ROLE_PRIORITY.indexOf((a.role ?? "").toLowerCase() as (typeof ROLE_PRIORITY)[number])
    const bIdx = ROLE_PRIORITY.indexOf((b.role ?? "").toLowerCase() as (typeof ROLE_PRIORITY)[number])
    return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx)
  })

  for (const member of sorted) {
    const userId = member.user_id?.trim()
    if (!userId) continue

    const { data: profile } = await admin
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .maybeSingle()

    let email = profile?.email?.trim() ?? ""
    if (!email) {
      const { data: authUser } = await admin.auth.admin.getUserById(userId)
      email = authUser.user?.email?.trim() ?? ""
    }
    if (!email) continue

    return {
      user_id: userId,
      email,
      role: member.role?.trim() || "member",
      organization_id: organizationId,
    }
  }

  return null
}

async function applyMagicLinkSession(
  page: Page,
  supabaseUrl: string,
  serviceRoleKey: string,
  email: string,
  redirectPath: string,
): Promise<void> {
  const anonKey = resolveAnonKey(supabaseUrl)
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

  const link = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${EQUIPIFY_CORE_PRODUCTION_HOST}${redirectPath}` },
  })
  const hashed = link.data?.properties?.hashed_token
  if (!hashed) throw new Error("generate_link_failed")

  const anon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
  const verified = await anon.auth.verifyOtp({ token_hash: hashed, type: "email" })
  const session = verified.data.session
  if (!session?.access_token || !session.refresh_token) throw new Error("verify_otp_failed")

  const cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }> = []
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => [],
      setAll: (cookies) => {
        for (const cookie of cookies) cookiesToSet.push(cookie)
      },
    },
  })
  await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  })

  const host = new URL(EQUIPIFY_CORE_PRODUCTION_HOST).hostname
  await page.context().addCookies(
    cookiesToSet.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: host,
      path: "/",
      httpOnly: Boolean(cookie.options?.httpOnly),
      secure: true,
      sameSite: "Lax" as const,
    })),
  )
}

export type SaveCertStaffStorageStateResult = {
  ok: boolean
  path: string | null
  staff_user: CertOrgStaffResolution | null
  accessible_org: string | null
  detail: string
}

export async function saveEquipifyCoreCertStaffStorageState(options: {
  admin: SupabaseClient
  supabaseUrl: string
  serviceRoleKey: string
  organizationId: string
  quoteId?: string | null
  invoiceId?: string | null
  outPath?: string
}): Promise<SaveCertStaffStorageStateResult> {
  const outPath = resolve(process.cwd(), options.outPath ?? EQUIPIFY_CORE_CERT_STORAGE_PATH)
  const staff = await resolveCertOrgStaffMember(options.admin, options.organizationId)
  if (!staff) {
    return {
      ok: false,
      path: null,
      staff_user: null,
      accessible_org: null,
      detail: "No active staff member with email found on cert org.",
    }
  }

  let chromium: typeof import("@playwright/test").chromium
  try {
    ;({ chromium } = await import("@playwright/test"))
  } catch {
    return {
      ok: false,
      path: null,
      staff_user: staff,
      accessible_org: null,
      detail: "@playwright/test unavailable.",
    }
  }

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    baseURL: EQUIPIFY_CORE_PRODUCTION_HOST,
  })
  const page = await context.newPage()

  try {
    await applyMagicLinkSession(page, options.supabaseUrl, options.serviceRoleKey, staff.email, "/quotes")

    await page.goto("/quotes", { waitUntil: "domcontentloaded", timeout: 45_000 })
    if (page.url().includes("/login")) {
      throw new Error("auth_setup_failed:redirected_to_login")
    }

    await page.evaluate(
      ([storageKey, orgId]) => {
        window.localStorage.setItem(storageKey, orgId)
      },
      [ACTIVE_ORG_STORAGE_KEY, options.organizationId] as const,
    )

    const quotePath =
      options.quoteId ?
        `/quotes?open=${encodeURIComponent(options.quoteId)}`
      : "/quotes"
    await page.goto(quotePath, { waitUntil: "domcontentloaded", timeout: 45_000 })
    await page.waitForTimeout(2000)
    if (page.url().includes("/login")) {
      throw new Error("auth_setup_failed:quotes_redirected_to_login")
    }

    if (options.invoiceId) {
      await page.goto(`/invoices?open=${encodeURIComponent(options.invoiceId)}`, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      })
      await page.waitForTimeout(2000)
      if (page.url().includes("/login")) {
        throw new Error("auth_setup_failed:invoices_redirected_to_login")
      }
    }

    mkdirSync(resolve(process.cwd(), "scripts"), { recursive: true })
    await context.storageState({ path: outPath })

    return {
      ok: true,
      path: outPath,
      staff_user: staff,
      accessible_org: options.organizationId,
      detail: `Staff storage state saved for ${staff.email} on cert org.`,
    }
  } catch (error) {
    return {
      ok: false,
      path: null,
      staff_user: staff,
      accessible_org: options.organizationId,
      detail: error instanceof Error ? error.message : String(error),
    }
  } finally {
    await browser.close()
  }
}

export function resolveEquipifyCoreCertStaffStorageStatePath(): string | null {
  const candidates = [
    process.env.EQUIPIFY_CORE_CERT_STORAGE_STATE?.trim(),
    EQUIPIFY_CORE_CERT_STORAGE_PATH,
  ].filter(Boolean) as string[]
  for (const candidate of candidates) {
    const absolute = resolve(process.cwd(), candidate)
    if (existsSync(absolute)) return absolute
  }
  return null
}
