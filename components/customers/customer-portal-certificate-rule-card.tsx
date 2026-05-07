"use client"

/**
 * Certificates + Portal Release Workflow — Phase 2
 *
 * Read-only clarity card on the customer detail Overview tab. Explains how
 * the customer inherits the workspace default certificate release policy or
 * overrides it, and what each policy means in practice.
 *
 * No raw UUIDs — only human-readable mode labels.
 */

import * as React from "react"
import { CheckCircle2, Clock, Info, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import {
  modeLabel,
  CERTIFICATE_RELEASE_OPTIONS,
} from "@/lib/portal/certificate-release-staff"
import {
  normalizeReleaseMode,
  type CertificateReleaseMode,
} from "@/lib/portal/certificate-release"

export type CustomerPortalCertificateRuleCardProps = {
  organizationId: string
  /** Customer-level override; null/empty means inherit org default. */
  customerMode: string | null
  className?: string
}

export function CustomerPortalCertificateRuleCard({
  organizationId,
  customerMode,
  className,
}: CustomerPortalCertificateRuleCardProps) {
  const [orgMode, setOrgMode] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (!organizationId) {
      setLoading(false)
      return
    }
    let cancelled = false
    void (async () => {
      const supabase = createBrowserSupabaseClient()
      const { data } = await supabase
        .from("organizations")
        .select("portal_certificate_release_mode")
        .eq("id", organizationId)
        .maybeSingle()
      if (cancelled) return
      setOrgMode(
        (data as { portal_certificate_release_mode?: string | null } | null)?.portal_certificate_release_mode ??
          null,
      )
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [organizationId])

  const customerOverride = (() => {
    const m = (customerMode ?? "").trim()
    if (m === "immediate_release" || m === "release_on_payment" || m === "manual_release") {
      return m as CertificateReleaseMode
    }
    return null
  })()
  const usingDefault = customerOverride === null
  const effectiveMode: CertificateReleaseMode = customerOverride ?? normalizeReleaseMode(orgMode)
  const orgDefaultLabel = modeLabel(orgMode as CertificateReleaseMode | null)

  const helper =
    CERTIFICATE_RELEASE_OPTIONS.find((o) => o.value === effectiveMode)?.helper ?? ""

  const Icon =
    effectiveMode === "immediate_release"
      ? CheckCircle2
      : effectiveMode === "release_on_payment"
        ? Clock
        : ShieldCheck

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 space-y-3",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex w-8 h-8 rounded-lg bg-secondary/40 items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-foreground" aria-hidden />
        </span>
        <div className="min-w-0 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Portal certificate access
          </p>
          <p className="text-sm font-semibold text-foreground">
            {modeLabel(effectiveMode)}
          </p>
          <p className="text-xs text-muted-foreground leading-snug">{helper}</p>
        </div>
      </div>

      <div className="border-t border-border pt-3 space-y-1.5 text-[11px] text-muted-foreground">
        {loading ? (
          <p>Loading workspace policy…</p>
        ) : usingDefault ? (
          <p className="flex items-start gap-1.5">
            <Info className="w-3 h-3 mt-0.5 shrink-0" aria-hidden />
            <span>
              Using the workspace default (<span className="text-foreground font-medium">{orgDefaultLabel}</span>).
              Update the workspace setting under <span className="font-medium text-foreground">Settings → Customer portal</span> to
              change behavior for every customer that uses the default.
            </span>
          </p>
        ) : (
          <p className="flex items-start gap-1.5">
            <Info className="w-3 h-3 mt-0.5 shrink-0" aria-hidden />
            <span>
              Override active. Workspace default is{" "}
              <span className="text-foreground font-medium">{orgDefaultLabel}</span>. Switch this customer to “Use organization default”
              in their edit panel to inherit the workspace policy.
            </span>
          </p>
        )}
      </div>
    </div>
  )
}
