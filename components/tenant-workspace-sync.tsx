"use client"

import { useLayoutEffect } from "react"
import { normalizePlanIdForRead } from "@/lib/billing/plan-id"
import type { PlanId } from "@/lib/plans"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useTenant } from "@/lib/tenant-store"
import { workspaceTemplateIdForOrgSlug } from "@/lib/workspace-org-map"

/**
 * Keeps tenant workspace metadata + mock bundle key aligned with the active Supabase organization
 * (does not replace the signed-in user — unlike legacy SWITCH_WORKSPACE).
 * Loads subscription from `/api/session/organization-subscription` so platform admins can impersonate
 * orgs they are not members of (RLS-safe).
 */
export function TenantWorkspaceSync() {
  const { status, organizationId, organizationSlug, organizationName } = useActiveOrganization()
  const { workspace, dispatch } = useTenant()

  useLayoutEffect(() => {
    if (status !== "ready" || !organizationId) return

    let cancelled = false

    const run = async () => {
      let organizationSubscription: {
        planId: PlanId
        status: string
        intendedPlanId: string | null
      } | null = null

      try {
        const res = await fetch(
          `/api/session/organization-subscription?organizationId=${encodeURIComponent(organizationId)}`,
          { cache: "no-store" },
        )
        if (res.ok) {
          const body = (await res.json()) as {
            subscription?: {
              plan_id?: string | null
              status?: string | null
              intended_plan_id?: string | null
            } | null
          }
          const row = body.subscription
          if (row) {
            organizationSubscription = {
              planId: normalizePlanIdForRead(row.plan_id ?? "solo"),
              status: row.status ?? "active",
              intendedPlanId: row.intended_plan_id ?? null,
            }
          } else {
            organizationSubscription = null
          }
        }
      } catch {
        organizationSubscription = null
      }

      if (cancelled) return

      const slug = organizationSlug ?? ""
      const templateId = workspaceTemplateIdForOrgSlug(slug)
      const displayName = organizationName?.trim() || workspace.name

      dispatch({
        type: "SYNC_WORKSPACE_FROM_ACTIVE_ORG",
        payload: {
          templateWorkspaceId: templateId,
          displayName,
          slug,
          organizationSubscription,
        },
      })

      try {
        const wRes = await fetch(
          `/api/organizations/${encodeURIComponent(organizationId)}/workspace`,
          { cache: "no-store" },
        )
        if (!wRes.ok) return
        const wBody = (await wRes.json()) as {
          organization?: {
            name: string
            slug: string
            companyEmail: string
            companyPhone: string
            companyWebsite: string
            companyAddress: string
            timezone: string
            dateFormat: string
            currency: string
            logoUrl: string
            primaryColor: string
            secondaryBrandColor: string
            whiteLabelSettings: Record<string, unknown>
          }
        }
        const o = wBody.organization
        if (!o || cancelled) return
        dispatch({
          type: "HYDRATE_ORGANIZATION_PROFILE",
          payload: {
            name: o.name,
            slug: o.slug,
            companyEmail: o.companyEmail,
            companyPhone: o.companyPhone,
            companyWebsite: o.companyWebsite,
            companyAddress: o.companyAddress,
            timezone: o.timezone,
            dateFormat: o.dateFormat,
            currency: o.currency,
            logoUrl: o.logoUrl,
            primaryColor: o.primaryColor,
            secondaryBrandColor: o.secondaryBrandColor ?? "",
            whiteLabelSettings:
              o.whiteLabelSettings && typeof o.whiteLabelSettings === "object" && !Array.isArray(o.whiteLabelSettings)
                ? o.whiteLabelSettings
                : {},
          },
        })
      } catch {
        /* profile optional — subscription sync still applied */
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [status, organizationId, organizationSlug, organizationName, workspace.name, dispatch])

  return null
}
