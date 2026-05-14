"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useAdmin } from "@/lib/admin-store"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { EQUIPIFY_SUPPORT_SESSION_ORG_CACHE_KEY } from "@/lib/support-session-storage"

const STORAGE_KEY = "equipify_active_organization_id"

export type ActiveOrgRow = {
  id: string
  name: string
  slug: string
}

/** Canonical demo org slugs — stable sidebar order (matches lib/tenant-data MOCK_WORKSPACES). */
const DEMO_WORKSPACE_SLUG_ORDER = ["acme", "zephyr", "medology", "precision-biomedical-demo"]

function sortOrganizationsDemoFirst(orgs: ActiveOrgRow[]): ActiveOrgRow[] {
  return [...orgs].sort((a, b) => {
    const sa = a.slug.trim().toLowerCase()
    const sb = b.slug.trim().toLowerCase()
    const ia = DEMO_WORKSPACE_SLUG_ORDER.indexOf(sa)
    const ib = DEMO_WORKSPACE_SLUG_ORDER.indexOf(sb)
    if (ia !== -1 || ib !== -1) {
      if (ia === -1) return 1
      if (ib === -1) return -1
      if (ia !== ib) return ia - ib
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  })
}

type Status = "loading" | "ready"

interface ActiveOrganizationContextValue {
  status: Status
  /** True while switching org (profile update in flight). */
  switching: boolean
  organizations: ActiveOrgRow[]
  organizationId: string | null
  organizationSlug: string | null
  organizationName: string | null
  error: string | null
  /** Active org is locked to a platform support session (must exit support to switch). */
  supportAccessActive: boolean
  /** Persist selection: updates profile.default_organization_id, localStorage, and in-memory state. */
  switchOrganization: (orgId: string) => Promise<{ error?: string }>
  /** Re-resolve org list + active org from DB and storage (e.g. after login). */
  refresh: () => Promise<void>
}

const ActiveOrganizationContext = createContext<ActiveOrganizationContextValue | null>(null)

function normalizeOrgRows(
  rows: Array<{
    organization_id: string
    organizations:
      | { id: string; name: string; slug: string; status?: string | null }
      | { id: string; name: string; slug: string; status?: string | null }[]
      | null
  }> | null,
): ActiveOrgRow[] {
  const out: ActiveOrgRow[] = []
  for (const row of rows ?? []) {
    const o = row.organizations
    const org = Array.isArray(o) ? o[0] : o
    if (org?.status === "archived") continue
    if (org?.id && org.name) {
      out.push({ id: org.id, name: org.name, slug: String(org.slug ?? "") })
    }
  }
  return out
}

function debugActiveOrg(details: Record<string, unknown>) {
  if (process.env.NEXT_PUBLIC_DEBUG_NAV !== "true") return
  const prod = process.env.NODE_ENV === "production"
  const payload = prod
    ? {
        ...details,
        organizationId: undefined,
        organizationHint:
          typeof details.organizationId === "string" && (details.organizationId as string).length > 8
            ? `…${(details.organizationId as string).slice(-6)}`
            : undefined,
      }
    : details
  console.info("[equipify:active-org]", payload)
}

export function ActiveOrganizationProvider({ children }: { children: ReactNode }) {
  const { impersonation, isPlatformAdmin } = useAdmin()
  const impersonationRef = useRef(impersonation)
  const isPlatformAdminRef = useRef(isPlatformAdmin)
  impersonationRef.current = impersonation
  isPlatformAdminRef.current = isPlatformAdmin

  /** After first successful resolution for this browser session, avoid flipping `status` to "loading" on refresh — downstream providers treat "loading" as loss of org. */
  const initialOrgResolutionCompleteRef = useRef(false)
  const lastResolvedUserIdRef = useRef<string | null>(null)

  const [status, setStatus] = useState<Status>("loading")
  const [switching, setSwitching] = useState(false)
  const [organizations, setOrganizations] = useState<ActiveOrgRow[]>([])
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [organizationSlug, setOrganizationSlug] = useState<string | null>(null)
  const [organizationName, setOrganizationName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [supportAccessActive, setSupportAccessActive] = useState(false)

  const refresh = useCallback(async () => {
    setError(null)
    const supabase = createBrowserSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      initialOrgResolutionCompleteRef.current = false
      lastResolvedUserIdRef.current = null
      setSupportAccessActive(false)
      try {
        localStorage.removeItem(STORAGE_KEY)
        localStorage.removeItem(EQUIPIFY_SUPPORT_SESSION_ORG_CACHE_KEY)
      } catch {
        /* ignore */
      }
      setOrganizations([])
      setOrganizationId(null)
      setOrganizationSlug(null)
      setOrganizationName(null)
      setStatus("ready")
      return
    }

    if (lastResolvedUserIdRef.current !== user.id) {
      initialOrgResolutionCompleteRef.current = false
      lastResolvedUserIdRef.current = user.id
    }

    if (!initialOrgResolutionCompleteRef.current) {
      setStatus("loading")
    }

    setSupportAccessActive(false)

    let supportData: {
      active?: boolean
      organizationId?: string
      organizationName?: string
      organizationSlug?: string
    } | null = null
    try {
      const res = await fetch("/api/platform/support-session", { cache: "no-store" })
      supportData = (await res.json().catch(() => ({}))) as typeof supportData
    } catch {
      supportData = null
    }

    const supportOrgId =
      supportData?.active && typeof supportData.organizationId === "string"
        ? supportData.organizationId.trim()
        : ""

    if (!supportOrgId) {
      try {
        localStorage.removeItem(EQUIPIFY_SUPPORT_SESSION_ORG_CACHE_KEY)
      } catch {
        /* ignore */
      }
    } else {
      try {
        localStorage.setItem(EQUIPIFY_SUPPORT_SESSION_ORG_CACHE_KEY, supportOrgId)
      } catch {
        /* ignore */
      }
      const slug = (supportData?.organizationSlug ?? "").trim()
      const name = (supportData?.organizationName ?? "").trim() || "Organization"
      const row: ActiveOrgRow = { id: supportOrgId, name, slug }
      setOrganizations([row])
      setOrganizationId(supportOrgId)
      setOrganizationSlug(slug || null)
      setOrganizationName(name)
      try {
        localStorage.setItem(STORAGE_KEY, supportOrgId)
      } catch {
        /* ignore */
      }
      setSupportAccessActive(true)
      setStatus("ready")
      initialOrgResolutionCompleteRef.current = true
      debugActiveOrg({
        source: "support_session",
        chosenFrom: "support_session_api",
        organizationId: supportOrgId,
      })
      return
    }

    const imp = impersonationRef.current
    if (imp.active && imp.accountId && isPlatformAdminRef.current) {
      const slug = imp.accountSlug?.trim() ?? ""
      const name = imp.accountName?.trim() || "Organization"
      const row: ActiveOrgRow = { id: imp.accountId, name, slug }
      setOrganizations([row])
      setOrganizationId(imp.accountId)
      setOrganizationSlug(slug || null)
      setOrganizationName(name)
      try {
        localStorage.setItem(STORAGE_KEY, imp.accountId)
      } catch {
        /* ignore */
      }
      setStatus("ready")
      initialOrgResolutionCompleteRef.current = true
      debugActiveOrg({ source: "impersonation_banner", chosenFrom: "client_impersonation", organizationId: imp.accountId })
      return
    }

    /** Sidebar org list: only rows in `organization_members` for this auth user with `status = active`.
     *  Platform Admin “accounts” lists every org via service role — not comparable without membership. */
    const memberSelect =
      "organization_id, organizations(id, name, slug, status)" as const

    let { data: memberRows, error: memberError } = await supabase
      .from("organization_members")
      .select(memberSelect)
      .eq("user_id", user.id)
      .eq("status", "active")

    if (memberError) {
      setError(memberError.message)
      setOrganizations([])
      setOrganizationId(null)
      setOrganizationSlug(null)
      setOrganizationName(null)
      setStatus("ready")
      initialOrgResolutionCompleteRef.current = true
      return
    }

    const runDevMultiDemo =
      process.env.NODE_ENV === "development" ||
      process.env.NEXT_PUBLIC_ENABLE_MULTI_DEMO_ORGS === "true"

    if (runDevMultiDemo) {
      const { error: ensureErr } = await supabase.rpc("ensure_dev_demo_workspace_orgs")
      if (ensureErr) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[equipify] ensure_dev_demo_workspace_orgs:", ensureErr.message)
        }
      } else {
        const { error: seedErr } = await supabase.rpc("seed_precision_biomedical_demo_if_empty")
        if (seedErr) {
          if (process.env.NODE_ENV === "development") {
            console.warn("[equipify] seed_precision_biomedical_demo_if_empty:", seedErr.message)
          }
        }
        const refetch = await supabase
          .from("organization_members")
          .select(memberSelect)
          .eq("user_id", user.id)
          .eq("status", "active")
        if (!refetch.error && refetch.data) {
          memberRows = refetch.data
        }
      }
    }

    const orgs = sortOrganizationsDemoFirst(normalizeOrgRows(memberRows as never))

    const resolvedOrgs = orgs

    setOrganizations(resolvedOrgs)
    const memberIds = new Set(resolvedOrgs.map((o) => o.id))

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("default_organization_id")
      .eq("id", user.id)
      .single()

    if (profileError) {
      setError(profileError.message)
    }

    let stored: string | null = null
    try {
      stored = localStorage.getItem(STORAGE_KEY)
    } catch {
      stored = null
    }

    let chosen: string | null =
      stored && memberIds.has(stored)
        ? stored
        : profile?.default_organization_id && memberIds.has(profile.default_organization_id)
          ? profile.default_organization_id
          : resolvedOrgs[0]?.id ?? null

    let chosenFrom: "localStorage" | "profile_default" | "first_member" | "none" = "none"
    if (stored && memberIds.has(stored)) chosenFrom = "localStorage"
    else if (profile?.default_organization_id && memberIds.has(profile.default_organization_id))
      chosenFrom = "profile_default"
    else if (resolvedOrgs[0]?.id) chosenFrom = "first_member"

    if (chosen && !memberIds.has(chosen)) {
      chosen = resolvedOrgs[0]?.id ?? null
      chosenFrom = resolvedOrgs[0]?.id ? "first_member" : "none"
    }

    const row = chosen ? resolvedOrgs.find((o) => o.id === chosen) ?? null : null
    setOrganizationId(chosen)
    setOrganizationSlug(row?.slug ?? null)
    setOrganizationName(row?.name ?? null)

    if (chosen) {
      try {
        localStorage.setItem(STORAGE_KEY, chosen)
      } catch {
        /* ignore */
      }
    } else {
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        /* ignore */
      }
    }

    setStatus("ready")
    initialOrgResolutionCompleteRef.current = true
    debugActiveOrg({
      source: "membership",
      chosenFrom,
      organizationId: chosen,
      orgCount: resolvedOrgs.length,
    })
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh, impersonation.active, impersonation.accountId, impersonation.accountSlug, isPlatformAdmin])

  const switchOrganization = useCallback(
    async (orgId: string) => {
      const imp = impersonationRef.current
      if (supportAccessActive && orgId !== organizationId) {
        return {
          error: "Exit platform support access (Back to Platform Admin) before switching workspaces.",
        }
      }
      if (imp.active && isPlatformAdminRef.current && imp.accountId && orgId !== imp.accountId) {
        return {
          error: "Switching workspaces is disabled while viewing another account as a platform admin.",
        }
      }

      const org = organizations.find((o) => o.id === orgId)
      if (!org) return { error: "Organization not found or you are not a member." }

      setSwitching(true)
      setError(null)
      const supabase = createBrowserSupabaseClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setSwitching(false)
        return { error: "Not signed in." }
      }

      const { data: memActive } = await supabase
        .from("organization_members")
        .select("id")
        .eq("organization_id", orgId)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle()

      if (!memActive) {
        try {
          localStorage.setItem(STORAGE_KEY, orgId)
        } catch {
          /* ignore */
        }
        setOrganizationId(org.id)
        setOrganizationSlug(org.slug)
        setOrganizationName(org.name)
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("equipify:organization-changed", { detail: { organizationId: orgId } }),
          )
        }
        setSwitching(false)
        return {}
      }

      const { error: upErr } = await supabase
        .from("profiles")
        .update({ default_organization_id: orgId, updated_at: new Date().toISOString() })
        .eq("id", user.id)

      if (upErr) {
        setError(upErr.message)
        setSwitching(false)
        return { error: upErr.message }
      }

      try {
        localStorage.setItem(STORAGE_KEY, orgId)
      } catch {
        /* ignore */
      }

      setOrganizationId(org.id)
      setOrganizationSlug(org.slug)
      setOrganizationName(org.name)

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("equipify:organization-changed", { detail: { organizationId: orgId } }),
        )
      }

      setSwitching(false)
      return {}
    },
    [organizations, organizationId, supportAccessActive],
  )

  const value = useMemo<ActiveOrganizationContextValue>(
    () => ({
      status,
      switching,
      organizations,
      organizationId,
      organizationSlug,
      organizationName,
      error,
      supportAccessActive,
      switchOrganization,
      refresh,
    }),
    [
      status,
      switching,
      organizations,
      organizationId,
      organizationSlug,
      organizationName,
      error,
      supportAccessActive,
      switchOrganization,
      refresh,
    ],
  )

  return (
    <ActiveOrganizationContext.Provider value={value}>{children}</ActiveOrganizationContext.Provider>
  )
}

export function useActiveOrganization() {
  const ctx = useContext(ActiveOrganizationContext)
  if (!ctx) throw new Error("useActiveOrganization must be used within ActiveOrganizationProvider")
  return ctx
}

/** Safe for modules that may render outside the provider (returns null). */
export function useActiveOrganizationOptional(): ActiveOrganizationContextValue | null {
  return useContext(ActiveOrganizationContext)
}
