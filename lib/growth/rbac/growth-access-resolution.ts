import "server-only"

import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import {
  getGrowthEngineAiOrgId,
  isGrowthEngineEnabledEnv,
  logGrowthEngine,
  resolveGrowthEnginePlatformUserResolution,
} from "@/lib/growth/growth-engine-session"
import {
  GROWTH_MANAGER_ORG_ROLES,
  isGrowthManagerEmail,
  isGrowthOperatorEmail,
} from "@/lib/growth/rbac/growth-role-policy"
import {
  resolveGrowthApiMinimumRole,
  resolveGrowthWorkspacePageMinimumRole,
} from "@/lib/growth/rbac/growth-route-access-matrix"
import {
  growthRoleMeetsMinimum,
  GROWTH_ROLE_LABELS,
  type GrowthRole,
} from "@/lib/growth/rbac/growth-role-types"
import { isPlatformAdminEmail } from "@/lib/platform-admin"
import { displayNameFromProfile } from "@/lib/user-display"
import type { SessionIdentity } from "@/lib/session-identity"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { headers } from "next/headers"

export const GROWTH_RBAC_ACCESS_QA_MARKER = "growth-rbac-access-1a-v1" as const

export type GrowthAccessContext = {
  role: GrowthRole
  userId: string
  userEmail: string
  organizationId: string | null
  isPlatformAdmin: boolean
}

export type GrowthEngineAccess =
  | (GrowthAccessContext & {
      ok: true
      admin: SupabaseClient
    })
  | { ok: false; response: NextResponse }

export type GrowthWorkspacePageAccessResult =
  | {
      ok: true
      identity: SessionIdentity
      access: GrowthAccessContext
    }
  | { ok: false; reason: "unauthenticated" | "feature_disabled" | "forbidden" }

export type GrowthAccessOptions = {
  minimumRole?: GrowthRole
  pathname?: string | null
}

async function isActiveGrowthWorkspaceOrgMember(
  admin: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<{ active: boolean; orgRole: string | null }> {
  const { data, error } = await admin
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return { active: false, orgRole: null }
  const orgRole = typeof data.role === "string" ? data.role.trim().toLowerCase() : null
  return { active: true, orgRole }
}

export async function resolveGrowthRoleForUser(input: {
  userId: string
  userEmail: string
}): Promise<GrowthAccessContext | null> {
  const organizationId = getGrowthEngineAiOrgId()
  const isPlatformAdmin = isPlatformAdminEmail(input.userEmail)

  if (isPlatformAdmin) {
    return {
      role: "platform_admin",
      userId: input.userId,
      userEmail: input.userEmail,
      organizationId,
      isPlatformAdmin: true,
    }
  }

  if (!isGrowthEngineEnabledEnv()) {
    return null
  }

  if (isGrowthManagerEmail(input.userEmail)) {
    return {
      role: "growth_manager",
      userId: input.userId,
      userEmail: input.userEmail,
      organizationId,
      isPlatformAdmin: false,
    }
  }

  if (isGrowthOperatorEmail(input.userEmail)) {
    return {
      role: "growth_operator",
      userId: input.userId,
      userEmail: input.userEmail,
      organizationId,
      isPlatformAdmin: false,
    }
  }

  if (!organizationId) return null

  try {
    const admin = createServiceRoleSupabaseClient()
    const membership = await isActiveGrowthWorkspaceOrgMember(admin, input.userId, organizationId)
    if (!membership.active) return null

    const role: GrowthRole =
      membership.orgRole && GROWTH_MANAGER_ORG_ROLES.has(membership.orgRole)
        ? "growth_manager"
        : "growth_operator"

    return {
      role,
      userId: input.userId,
      userEmail: input.userEmail,
      organizationId,
      isPlatformAdmin: false,
    }
  } catch {
    return null
  }
}

function resolveMinimumRoleFromPathname(pathname: string): GrowthRole {
  if (pathname.startsWith("/growth")) {
    return resolveGrowthWorkspacePageMinimumRole(pathname)
  }

  if (pathname.startsWith("/api/growth/") || pathname.startsWith("/api/platform/growth/")) {
    return resolveGrowthApiMinimumRole(pathname)
  }

  return "platform_admin"
}

async function resolveRequestPathname(
  request: Request | undefined,
  options?: GrowthAccessOptions,
): Promise<string | null> {
  if (options?.pathname) return options.pathname

  if (request) {
    try {
      return new URL(request.url).pathname
    } catch {
      /* fall through */
    }
  }

  try {
    const headerStore = await headers()
    return (
      headerStore.get("x-growth-api-pathname") ??
      headerStore.get("x-growth-pathname") ??
      null
    )
  } catch {
    return null
  }
}

async function buildGrowthSessionIdentity(
  access: GrowthAccessContext,
): Promise<SessionIdentity> {
  const supabase = await createServerSupabaseClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", access.userId)
    .maybeSingle()

  return {
    authUserId: access.userId,
    email: access.userEmail,
    displayName: displayNameFromProfile(
      (profile as { full_name?: string | null } | null)?.full_name,
      access.userEmail,
    ),
    platformAdmin: access.isPlatformAdmin,
    platformRoleLabel: GROWTH_ROLE_LABELS[access.role],
    growthRole: access.role,
  }
}

export async function requireGrowthAccess(
  request?: Request,
  options?: GrowthAccessOptions,
): Promise<GrowthEngineAccess> {
  if (!isGrowthEngineEnabledEnv()) {
    logGrowthEngine("access_denied", { reason: "feature_disabled", rbac: GROWTH_RBAC_ACCESS_QA_MARKER })
    return {
      ok: false,
      response: NextResponse.json(
        { error: "feature_disabled", message: "Growth Engine is not enabled for this deployment." },
        { status: 403 },
      ),
    }
  }

  const resolution = await resolveGrowthEnginePlatformUserResolution(request)
  const resolvedUser = resolution.resolved_user
  if (!resolvedUser) {
    let hostname: string | null = null
    let pathname: string | null = null
    try {
      if (request) {
        const url = new URL(request.url)
        hostname = url.hostname
        pathname = url.pathname
      }
    } catch {
      /* ignore malformed request URL */
    }
    if (!pathname) {
      pathname = await resolveRequestPathname(request, options)
    }
    logGrowthEngine("access_denied", {
      reason: "unauthenticated",
      rbac: GROWTH_RBAC_ACCESS_QA_MARKER,
      auth_attempted: true,
      user_resolved: false,
      cookie_user_resolved: resolution.cookie_user_resolved,
      cookie_auth_timeout: resolution.cookie_auth_timeout,
      cookie_auth_error_code: resolution.cookie_auth_error_code,
      cookie_auth_error_message_safe: resolution.cookie_auth_error_message_safe,
      bearer_resolution_attempted: resolution.bearer_resolution_attempted,
      bearer_user_resolved: resolution.bearer_user_resolved,
      bearer_resolution_error_code: resolution.bearer_resolution_error_code,
      bearer_resolution_error_message_safe: resolution.bearer_resolution_error_message_safe,
      hostname,
      pathname,
      deployment_id: process.env.VERCEL_DEPLOYMENT_ID ?? null,
    })
    return {
      ok: false,
      response: NextResponse.json(
        { error: "unauthenticated", message: "Sign in to access Growth Engine." },
        { status: 401 },
      ),
    }
  }

  const accessContext = await resolveGrowthRoleForUser(resolvedUser)
  if (!accessContext) {
    logGrowthEngine("access_denied", {
      reason: "forbidden",
      rbac: GROWTH_RBAC_ACCESS_QA_MARKER,
      email: resolvedUser.userEmail,
    })
    return {
      ok: false,
      response: NextResponse.json(
        { error: "forbidden", message: "Growth Engine access required." },
        { status: 403 },
      ),
    }
  }

  const pathname = await resolveRequestPathname(request, options)
  const minimumRole = options?.minimumRole ?? (pathname ? resolveMinimumRoleFromPathname(pathname) : "platform_admin")
  if (!growthRoleMeetsMinimum(accessContext.role, minimumRole)) {
    logGrowthEngine("access_denied", {
      reason: "insufficient_role",
      rbac: GROWTH_RBAC_ACCESS_QA_MARKER,
      role: accessContext.role,
      minimum_role: minimumRole,
      email: resolvedUser.userEmail,
    })
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "forbidden",
          message: `${GROWTH_ROLE_LABELS[minimumRole]} access required.`,
          required_role: minimumRole,
          role: accessContext.role,
        },
        { status: 403 },
      ),
    }
  }

  try {
    return {
      ok: true,
      admin: createServiceRoleSupabaseClient(),
      ...accessContext,
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    const missingServiceRoleKey = detail.includes("SUPABASE_SERVICE_ROLE_KEY")
    logGrowthEngine("access_denied", { reason: "server_config", detail, rbac: GROWTH_RBAC_ACCESS_QA_MARKER })
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "server_config",
          message: missingServiceRoleKey
            ? "SUPABASE_SERVICE_ROLE_KEY is not configured. Growth Engine requires the service role client for growth schema access."
            : "Server is not configured for Growth Engine operations.",
        },
        { status: 503 },
      ),
    }
  }
}

export async function resolveGrowthWorkspacePageAccess(input?: {
  request?: Request
  pathname?: string
}): Promise<GrowthWorkspacePageAccessResult> {
  try {
    const pathname = input?.pathname ?? ""
    const minimumRole = resolveGrowthWorkspacePageMinimumRole(pathname || "/growth")
    const access = await requireGrowthAccess(input?.request, { minimumRole, pathname })

    if (!access.ok) {
      const status = access.response.status
      if (status === 401) return { ok: false, reason: "unauthenticated" }
      if (status === 403) {
        const body = (await access.response.clone().json().catch(() => null)) as { error?: string } | null
        if (body?.error === "feature_disabled") return { ok: false, reason: "feature_disabled" }
        return { ok: false, reason: "forbidden" }
      }
      return { ok: false, reason: "forbidden" }
    }

    const identity = await buildGrowthSessionIdentity(access)
    return {
      ok: true,
      identity,
      access: {
        role: access.role,
        userId: access.userId,
        userEmail: access.userEmail,
        organizationId: access.organizationId,
        isPlatformAdmin: access.isPlatformAdmin,
      },
    }
  } catch {
    return { ok: false, reason: "forbidden" }
  }
}

export async function loadGrowthSessionIdentity(): Promise<SessionIdentity | null> {
  const resolution = await resolveGrowthEnginePlatformUserResolution()
  const resolvedUser = resolution.resolved_user
  if (!resolvedUser) return null

  const accessContext = await resolveGrowthRoleForUser(resolvedUser)
  if (!accessContext) return null

  return buildGrowthSessionIdentity(accessContext)
}

export { growthRoleCanAccessGrowthApiPath as growthRoleCanAccessApiPath, growthRoleCanAccessWorkspacePath as growthRoleCanAccessPath } from "@/lib/growth/rbac/growth-route-access-matrix"
