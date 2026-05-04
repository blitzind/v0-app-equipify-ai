"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"

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
      | { id: string; name: string; slug: string }
      | { id: string; name: string; slug: string }[]
      | null
  }> | null,
): ActiveOrgRow[] {
  const out: ActiveOrgRow[] = []
  for (const row of rows ?? []) {
    const o = row.organizations
    const org = Array.isArray(o) ? o[0] : o
    if (org?.id && org.name) {
      out.push({ id: org.id, name: org.name, slug: String(org.slug ?? "") })
    }
  }
  return out
}

export function ActiveOrganizationProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading")
  const [switching, setSwitching] = useState(false)
  const [organizations, setOrganizations] = useState<ActiveOrgRow[]>([])
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [organizationSlug, setOrganizationSlug] = useState<string | null>(null)
  const [organizationName, setOrganizationName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setStatus("loading")
    setError(null)
    const supabase = createBrowserSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      try {
        localStorage.removeItem(STORAGE_KEY)
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

    const memberSelect =
      "organization_id, organizations(id, name, slug)" as const

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
    setOrganizations(orgs)
    const memberIds = new Set(orgs.map((o) => o.id))

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

    let chosen =
      stored && memberIds.has(stored)
        ? stored
        : profile?.default_organization_id && memberIds.has(profile.default_organization_id)
          ? profile.default_organization_id
          : orgs[0]?.id ?? null

    if (chosen && !memberIds.has(chosen)) {
      chosen = orgs[0]?.id ?? null
    }

    const row = chosen ? orgs.find((o) => o.id === chosen) ?? null : null
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
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const switchOrganization = useCallback(
    async (orgId: string) => {
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
    [organizations],
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
