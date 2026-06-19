"use client"

import { useCallback, useState } from "react"
import type { ReactNode } from "react"
import { ChevronRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { GrowthDomainDeliverabilitySetupDrawer } from "@/components/growth/growth-domain-deliverability-setup-drawer"
import { dnsHealthTierLabel } from "@/lib/growth/deliverability/dns-health"
import type { GrowthDnsHealthTier } from "@/lib/growth/deliverability/deliverability-types"

export type GrowthDomainDeliverabilityTableRow = {
  domainId: string
  domain: string
  spfValid: boolean
  dkimValid: boolean
  dmarcValid: boolean
  mxValid: boolean
  deliverabilityScore: number
  healthLabel: string
  healthTier?: GrowthDnsHealthTier | string
  lastCheckedAt?: string | null
  riskLevel?: string | null
}

type GrowthDomainDeliverabilityDomainsTableProps = {
  rows: GrowthDomainDeliverabilityTableRow[]
  emptyMessage?: ReactNode
  showRisk?: boolean
  showLastCheck?: boolean
  onDomainUpdated?: () => void
}

const TIER_TONE: Record<string, "healthy" | "attention" | "critical" | "neutral" | "blocked"> = {
  healthy: "healthy",
  warning: "attention",
  degraded: "attention",
  critical: "critical",
  connected: "healthy",
  valid: "healthy",
  low: "healthy",
  medium: "attention",
  high: "attention",
}

function boolBadge(value: boolean): { label: string; tone: "healthy" | "critical" | "neutral" } {
  return value ? { label: "Valid", tone: "healthy" } : { label: "Missing", tone: "critical" }
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

export function GrowthDomainDeliverabilityDomainsTable({
  rows,
  emptyMessage,
  showRisk = false,
  showLastCheck = false,
  onDomainUpdated,
}: GrowthDomainDeliverabilityDomainsTableProps) {
  const [selectedRow, setSelectedRow] = useState<GrowthDomainDeliverabilityTableRow | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const openDrawer = useCallback((row: GrowthDomainDeliverabilityTableRow) => {
    setSelectedRow(row)
  }, [])

  async function runValidate(domainId: string, actionKey: string) {
    setActionLoading(actionKey)
    setActionError(null)
    try {
      const response = await fetch(`/api/platform/growth/deliverability/domain/${domainId}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const payload = (await response.json()) as { message?: string }
      if (!response.ok) {
        throw new Error(payload.message ?? "DNS validation failed.")
      }
      onDomainUpdated?.()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "DNS validation failed.")
    } finally {
      setActionLoading(null)
    }
  }

  const columnCount = 8 + (showRisk ? 1 : 0) + (showLastCheck ? 1 : 0)

  return (
    <>
      {actionError ? (
        <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
          {actionError}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="w-8 px-2 py-2" aria-hidden />
              <th className="px-2 py-2">Domain</th>
              <th className="px-2 py-2">SPF</th>
              <th className="px-2 py-2">DKIM</th>
              <th className="px-2 py-2">DMARC</th>
              <th className="px-2 py-2">MX</th>
              <th className="px-2 py-2">Deliverability</th>
              <th className="px-2 py-2">Health</th>
              {showRisk ? <th className="px-2 py-2">Risk</th> : null}
              {showLastCheck ? <th className="px-2 py-2">Last check</th> : null}
              <th className="sticky right-0 bg-card px-2 py-2 shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.15)]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="px-2 py-4 text-muted-foreground">
                  {emptyMessage ?? "No sending domains yet."}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const spf = boolBadge(row.spfValid)
                const dkim = boolBadge(row.dkimValid)
                const dmarc = boolBadge(row.dmarcValid)
                const mx = boolBadge(row.mxValid)
                const healthTone = TIER_TONE[row.healthTier ?? row.healthLabel] ?? "neutral"
                const healthLabel =
                  row.healthTier && row.healthTier in { healthy: 1, warning: 1, degraded: 1, critical: 1 }
                    ? dnsHealthTierLabel(row.healthTier as GrowthDnsHealthTier)
                    : row.healthLabel

                return (
                  <tr
                    key={row.domainId}
                    className="group cursor-pointer border-b border-border/60 transition-colors hover:bg-muted/40"
                    onClick={() => openDrawer(row)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        openDrawer(row)
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Open DNS setup for ${row.domain}`}
                  >
                    <td className="px-2 py-3 text-muted-foreground">
                      <ChevronRight className="size-4 opacity-60 transition group-hover:opacity-100" />
                    </td>
                    <td className="px-2 py-3 font-medium">{row.domain}</td>
                    <td className="px-2 py-3">
                      <GrowthBadge label={spf.label} tone={spf.tone} />
                    </td>
                    <td className="px-2 py-3">
                      <GrowthBadge label={dkim.label} tone={dkim.tone} />
                    </td>
                    <td className="px-2 py-3">
                      <GrowthBadge label={dmarc.label} tone={dmarc.tone} />
                    </td>
                    <td className="px-2 py-3">
                      <GrowthBadge label={mx.label} tone={mx.tone} />
                    </td>
                    <td className="px-2 py-3">{row.deliverabilityScore}%</td>
                    <td className="px-2 py-3">
                      <GrowthBadge label={healthLabel} tone={healthTone} />
                    </td>
                    {showRisk ? (
                      <td className="px-2 py-3">
                        {row.riskLevel ? (
                          <GrowthBadge label={row.riskLevel} tone={TIER_TONE[row.riskLevel] ?? "neutral"} />
                        ) : (
                          "—"
                        )}
                      </td>
                    ) : null}
                    {showLastCheck ? (
                      <td className="px-2 py-3">{formatDate(row.lastCheckedAt)}</td>
                    ) : null}
                    <td
                      className="sticky right-0 bg-card px-2 py-3 shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.15)] group-hover:bg-muted/40"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <div className="flex min-w-[280px] flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => openDrawer(row)}
                        >
                          View Setup Instructions
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={Boolean(actionLoading)}
                          onClick={() => void runValidate(row.domainId, `verify-${row.domainId}`)}
                        >
                          {actionLoading === `verify-${row.domainId}` ? (
                            <Loader2 className="mr-1 size-3.5 animate-spin" />
                          ) : null}
                          Verify DNS
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={Boolean(actionLoading)}
                          onClick={() => void runValidate(row.domainId, `refresh-${row.domainId}`)}
                        >
                          {actionLoading === `refresh-${row.domainId}` ? (
                            <Loader2 className="mr-1 size-3.5 animate-spin" />
                          ) : null}
                          Refresh DNS
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <GrowthDomainDeliverabilitySetupDrawer
        domainId={selectedRow?.domainId ?? null}
        domainLabel={selectedRow?.domain ?? null}
        open={Boolean(selectedRow)}
        onOpenChange={(open) => {
          if (!open) setSelectedRow(null)
        }}
        onDomainUpdated={onDomainUpdated}
      />
    </>
  )
}
