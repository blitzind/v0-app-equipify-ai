"use client"

/**
 * Role-based Permissions — Phase 1
 *
 * Renders a compact "you don't have access" empty state. Use this in place
 * of leaving sensitive surfaces blank when a viewer / tech navigates to a
 * route they cannot mutate. The notice never grants access on its own —
 * server-side guards (RLS + `requireOrgPermission`) remain the source of
 * truth.
 */

import * as React from "react"
import { Lock, ShieldAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  getCapabilityMetadata,
  ROLE_BEHAVIOR_SUMMARY,
} from "@/lib/permissions/capabilities"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import type { OrgPermissionKey } from "@/lib/permissions/model"

export type RestrictedNoticeProps = {
  capability: OrgPermissionKey
  /** Optional inline variant (smaller, sits next to disabled buttons). */
  inline?: boolean
  /** Optional override for the visible title. */
  title?: string
  /** Optional override for the body text. */
  body?: string
  className?: string
}

export function RestrictedNotice({
  capability,
  inline = false,
  title,
  body,
  className,
}: RestrictedNoticeProps) {
  const { role } = useOrgPermissions()
  const meta = getCapabilityMetadata(capability)
  const roleSummary = role ? ROLE_BEHAVIOR_SUMMARY[role] : null

  if (inline) {
    return (
      <p
        className={cn(
          "inline-flex items-center gap-1.5 text-[11px] text-muted-foreground",
          className,
        )}
      >
        <Lock className="w-3 h-3 shrink-0" aria-hidden />
        {title ?? `${meta.label} restricted to other roles.`}
      </p>
    )
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "rounded-xl border border-border bg-card p-5 flex items-start gap-3",
        className,
      )}
    >
      <div className="w-9 h-9 rounded-full bg-muted/50 flex items-center justify-center shrink-0">
        <ShieldAlert className="w-4 h-4 text-muted-foreground" aria-hidden />
      </div>
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-semibold text-foreground">
          {title ?? `${meta.label} not available for your role`}
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {body ?? meta.description}
        </p>
        {roleSummary ? (
          <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
            <span className="font-medium text-muted-foreground">Your role:</span> {roleSummary}
          </p>
        ) : null}
        <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
          Ask an owner or admin if you need access for this workflow.
        </p>
      </div>
    </div>
  )
}
