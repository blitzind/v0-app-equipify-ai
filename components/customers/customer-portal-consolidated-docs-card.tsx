"use client"

/**
 * Read-only summary for per-customer consolidated portal document access
 * (parent-account rollup). Sits with the certificate release card on the
 * customer overview. Edit lives in the customer edit dialog.
 */

import * as React from "react"
import { Info, Layers } from "lucide-react"
import { cn } from "@/lib/utils"

function effectiveConsolidated(orgDefault: boolean, customerOverride: boolean | null): boolean {
  if (customerOverride === true) return true
  if (customerOverride === false) return false
  return orgDefault === true
}

export type CustomerPortalConsolidatedDocsCardProps = {
  organizationId: string
  /** null = inherit org workspace default */
  customerOverride: boolean | null
  className?: string
}

export function CustomerPortalConsolidatedDocsCard({
  organizationId,
  customerOverride,
  className,
}: CustomerPortalConsolidatedDocsCardProps) {
  const [orgDefault, setOrgDefault] = React.useState<boolean | null>(null)
  const [schemaPending, setSchemaPending] = React.useState(false)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (!organizationId) {
      setLoading(false)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(
          `/api/organizations/${encodeURIComponent(organizationId)}/portal/consolidated-documents-default`,
        )
        const data = (await res.json().catch(() => ({}))) as {
          portal_consolidated_documents_default?: boolean
          schema_migration_pending?: boolean
        }
        if (cancelled) return
        if (data.schema_migration_pending) {
          setSchemaPending(true)
          setOrgDefault(false)
        } else {
          setOrgDefault(data.portal_consolidated_documents_default === true)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [organizationId])

  const effective = effectiveConsolidated(orgDefault ?? false, customerOverride)
  const usingDefault = customerOverride === null

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 space-y-3",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex w-8 h-8 rounded-lg bg-secondary/40 items-center justify-center shrink-0">
          <Layers className="w-4 h-4 text-foreground" aria-hidden />
        </span>
        <div className="min-w-0 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Portal document library
          </p>
          <p className="text-sm font-semibold text-foreground">
            {loading ? "…" : effective ? "Consolidated view on" : "Consolidated view off"}
          </p>
          <p className="text-xs text-muted-foreground leading-snug">
            When on, a portal user for a parent account can also see documents for child accounts, if your
            workspace and hierarchy allow it. Certificate and invoice release rules still apply.
          </p>
        </div>
      </div>

      <div className="border-t border-border pt-3 space-y-1.5 text-[11px] text-muted-foreground">
        {schemaPending ? (
          <p>Consolidated document settings are not available on this database yet.</p>
        ) : loading ? (
          <p>Loading workspace default…</p>
        ) : usingDefault ? (
          <p className="flex items-start gap-1.5">
            <Info className="w-3 h-3 mt-0.5 shrink-0" aria-hidden />
            <span>
              Using the workspace default (
              <span className="text-foreground font-medium">
                {orgDefault ? "consolidated on" : "consolidated off"}
              </span>
              ). Change under <span className="font-medium text-foreground">Settings → Customer portal</span> or
              override in <span className="font-medium text-foreground">Edit</span> for this customer.
            </span>
          </p>
        ) : (
          <p className="flex items-start gap-1.5">
            <Info className="w-3 h-3 mt-0.5 shrink-0" aria-hidden />
            <span>
              Override active. Workspace default is{" "}
              <span className="text-foreground font-medium">
                {orgDefault ? "consolidated on" : "consolidated off"}
              </span>
              . Choose “Use workspace default” in Edit to inherit again.
            </span>
          </p>
        )}
      </div>
    </div>
  )
}
