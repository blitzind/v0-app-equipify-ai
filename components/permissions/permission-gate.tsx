"use client"

/**
 * Role-based Permissions — Phase 1
 *
 * `<PermissionGate>` hides children when the active organization role lacks
 * a capability. Pass `mode="disable"` to render a disabled wrapper instead
 * of unmounting (useful for buttons where layout shifts would be jarring).
 *
 * Server-side authorization remains the source of truth — this is a UI hint
 * only. Always pair gated UI with a server guard (`requireOrgPermission`).
 */

import * as React from "react"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import type { OrgPermissionKey } from "@/lib/permissions/model"

export type PermissionGateProps = {
  /** Required capability OR list of capabilities (any). */
  capability?: OrgPermissionKey
  anyOf?: OrgPermissionKey[]
  allOf?: OrgPermissionKey[]
  mode?: "hide" | "disable"
  /** Optional fallback when the gate is closed (only used in `hide` mode). */
  fallback?: React.ReactNode
  /** When `mode="disable"`, the wrapper class to apply to the disabled state. */
  disabledClassName?: string
  children: React.ReactNode
}

export function PermissionGate({
  capability,
  anyOf,
  allOf,
  mode = "hide",
  fallback = null,
  disabledClassName = "opacity-50 pointer-events-none cursor-not-allowed",
  children,
}: PermissionGateProps) {
  const { permissions, status } = useOrgPermissions()

  if (status === "loading") {
    // While the session is bootstrapping, hide rather than flashing UI a
    // restricted user shouldn't see.
    return mode === "hide" ? <>{fallback}</> : null
  }

  let allowed = true
  if (capability) {
    allowed = Boolean(permissions[capability])
  } else if (anyOf?.length) {
    allowed = anyOf.some((k) => permissions[k])
  } else if (allOf?.length) {
    allowed = allOf.every((k) => permissions[k])
  }

  if (allowed) return <>{children}</>
  if (mode === "hide") return <>{fallback}</>

  return (
    <div aria-disabled className={disabledClassName} title="Restricted to other roles">
      {children}
    </div>
  )
}

/** Convenience hook for inline checks. */
export function useHasCapability(
  capability: OrgPermissionKey | OrgPermissionKey[],
): boolean {
  const { permissions } = useOrgPermissions()
  if (Array.isArray(capability)) return capability.some((k) => permissions[k])
  return Boolean(permissions[capability])
}
