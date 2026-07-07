"use client"

import Link from "next/link"
import { Mail, ShieldCheck } from "lucide-react"
import type { GrowthHomeMailboxDomainHealth } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { cn } from "@/lib/utils"

export function GrowthHomeMailboxDomainHealthSection({
  health,
  embedded = false,
}: {
  health: GrowthHomeMailboxDomainHealth | null
  embedded?: boolean
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
  ].filter((row): row is { label: string; value: string } => row != null)

  return (
    <section
      data-qa-section="home-mailbox-domain-health"
      className={cn(
        embedded
          ? "h-full rounded-xl border border-border/70 bg-card p-4 space-y-3"
          : "rounded-2xl border border-border/70 bg-card p-5 space-y-4 sm:p-6",
      )}
    >
      <div className="flex items-center gap-2">
        <Mail className="size-4 text-muted-foreground" aria-hidden />
        <h3 className="text-base font-semibold tracking-tight">Mailbox Health</h3>
      </div>
      {health.summary ? <p className="text-sm text-muted-foreground line-clamp-2">{health.summary}</p> : null}
      <div className="grid grid-cols-2 gap-2">
        {poolRows.map((row) => (
          <div key={row.label} className="rounded-lg bg-muted/20 px-2.5 py-2">
            <p className="text-[11px] text-muted-foreground">{row.label}</p>
            <p className="text-lg font-semibold tabular-nums">{row.value}</p>
          </div>
        ))}
        {domainRows.slice(0, 2).map((row) => (
          <div key={row.label} className="rounded-lg bg-muted/20 px-2.5 py-2">
            <p className="text-[11px] text-muted-foreground">{row.label}</p>
            <p className="text-sm font-medium">{row.value}</p>
          </div>
        ))}
      </div>
      {health.href ? (
        <Link href={health.href} className="text-sm font-medium text-primary hover:underline">
          Review mailbox settings
        </Link>
      ) : null}
    </section>
  )
}
