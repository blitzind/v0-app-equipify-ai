"use client"

import Link from "next/link"
import type { GrowthHomeMailboxDomainHealth } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"

export function GrowthHomeMailboxDomainHealthSection({
  health,
}: {
  health: GrowthHomeMailboxDomainHealth | null
}) {
  if (!health) return null

  const poolRows = [
    { label: "Healthy", value: health.mailboxPool.healthy },
    { label: "Warming", value: health.mailboxPool.warming },
    { label: "Paused", value: health.mailboxPool.paused },
    { label: "Warning", value: health.mailboxPool.warning },
  ].filter((row) => row.value > 0)

  const domainRows = [
    health.domainHealth.spf ? { label: "SPF", value: health.domainHealth.spf } : null,
    health.domainHealth.dkim ? { label: "DKIM", value: health.domainHealth.dkim } : null,
    health.domainHealth.dmarc ? { label: "DMARC", value: health.domainHealth.dmarc } : null,
    health.domainHealth.mx ? { label: "MX", value: health.domainHealth.mx } : null,
    health.domainHealth.warmupPercent != null
      ? { label: "Warmup", value: `${health.domainHealth.warmupPercent}%` }
      : null,
    health.domainHealth.dailyUtilization
      ? { label: "Daily utilization", value: health.domainHealth.dailyUtilization }
      : null,
  ].filter((row): row is { label: string; value: string } => row != null)

  return (
    <section
      data-qa-section="home-mailbox-domain-health"
      className="rounded-2xl border border-border/70 bg-card p-6 space-y-5"
    >
      <div>
        <h3 className="text-base font-semibold tracking-tight">Mailbox & domain health</h3>
        {health.summary ? <p className="mt-1 text-sm text-muted-foreground">{health.summary}</p> : null}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {poolRows.length > 0 ? (
          <div className="rounded-xl border border-border/70 bg-card p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground">Mailbox Pool</p>
            <div className="grid grid-cols-2 gap-3">
              {poolRows.map((row) => (
                <div key={row.label} className="rounded-lg bg-muted/20 px-3 py-2">
                  <p className="text-xs text-muted-foreground">{row.label}</p>
                  <p className="text-lg font-semibold tabular-nums">{row.value}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {domainRows.length > 0 ? (
          <div className="rounded-xl border border-border/70 bg-card p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground">Domain Health</p>
            <div className="grid grid-cols-2 gap-3">
              {domainRows.map((row) => (
                <div key={row.label} className="rounded-lg bg-muted/20 px-3 py-2">
                  <p className="text-xs text-muted-foreground">{row.label}</p>
                  <p className="text-sm font-medium">{row.value}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      {health.href ? (
        <Link href={health.href} className="text-sm font-medium text-indigo-700 hover:underline dark:text-indigo-300">
          Review mailbox settings
        </Link>
      ) : null}
    </section>
  )
}
