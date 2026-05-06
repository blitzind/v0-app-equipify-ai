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
      const subscriptionUrl = `/api/session/organization-subscription?organizationId=${encodeURIComponent(organizationId)}`
      const workspaceUrl = `/api/organizations/${encodeURIComponent(organizationId)}/workspace`

      let organizationSubscription: {
        planId: PlanId
        status: string
        intendedPlanId: string | null
      } | null = null

      let workspacePayload: {
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
          documentLogoUrl: string
          primaryColor: string
          secondaryBrandColor: string
          whiteLabelSettings: Record<string, unknown>
        }
      } | null = null

      let workspaceStatus: number | null = null

      try {
        const [subRes, wRes] = await Promise.all([
          fetch(subscriptionUrl, { cache: "no-store" }),
          fetch(workspaceUrl, { cache: "no-store" }),
        ])
        workspaceStatus = wRes.status

        if (subRes.ok) {
          const body = (await subRes.json()) as {
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

        if (wRes.ok) {
          workspacePayload = (await wRes.json()) as typeof workspacePayload
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

      const o = workspacePayload?.organization
      if (!wResOk(workspaceStatus) || !o) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[tenant-workspace-sync] workspace GET missing or failed", {
            organizationId,
            status: workspaceStatus,
          })
        }
        return
      }

      if (cancelled) return
      if (process.env.NODE_ENV === "development") {
        console.info("[tenant-workspace-sync] HYDRATE_ORGANIZATION_PROFILE", {
          organizationId,
          logoUrl: o.logoUrl,
          documentLogoUrl: o.documentLogoUrl,
        })
      }
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
          documentLogoUrl: o.documentLogoUrl ?? "",
          primaryColor: o.primaryColor,
          secondaryBrandColor: o.secondaryBrandColor ?? "",
          whiteLabelSettings:
            o.whiteLabelSettings && typeof o.whiteLabelSettings === "object" && !Array.isArray(o.whiteLabelSettings)
              ? o.whiteLabelSettings
              : {},
        },
      })
    }

    void run()
    return () => {
      cancelled = true
    }
    // workspace.name is only a fallback when organizationName is empty; omitting it avoids re-sync loops after HYDRATE.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [status, organizationId, organizationSlug, organizationName, dispatch])

  return null
}

function wResOk(status: number | null): status is number {
  return typeof status === "number" && status >= 200 && status < 300
}
