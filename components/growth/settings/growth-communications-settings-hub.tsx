"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowRight, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  GROWTH_COMMUNICATIONS_SETTINGS_CARDS,
  GROWTH_COMMUNICATIONS_SETTINGS_QA_MARKER,
} from "@/lib/growth/navigation/growth-communications-settings-navigation"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { resolveWorkspaceSettingsBridgeHrefFromGrowthPath } from "@/lib/growth/navigation/growth-workspace-settings-canonical"
import { Truck } from "lucide-react"

export function GrowthCommunicationsSettingsHub() {
  const pathname = usePathname()
  const workspaceSettingsBridgeHref = resolveWorkspaceSettingsBridgeHrefFromGrowthPath(pathname)

  return (
    <div className="space-y-6" data-qa-marker={GROWTH_COMMUNICATIONS_SETTINGS_QA_MARKER}>
      <GrowthWorkspacePageHeader
        title="Communications"
        description="Mailbox delivery, DNS authentication, warmup, sender pools, and reputation — configure outbound email readiness here."
        icon={Truck}
        iconClassName="bg-emerald-50 text-emerald-700"
        actions={
          <Button type="button" variant="ghost" size="sm" asChild>
            <Link href={workspaceSettingsBridgeHref}>Back to Workspace Settings</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {GROWTH_COMMUNICATIONS_SETTINGS_CARDS.map((card) => (
          <Link
            key={card.id}
            href={card.href}
            className="group rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/30 hover:bg-muted/20"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                  <card.icon size={17} />
                </span>
                <div>
                  <h2 className="font-semibold tracking-tight">{card.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
                </div>
              </div>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
            {card.adminFallbackHref ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Platform Admin fallback:{" "}
                <span className="font-mono">{card.adminFallbackHref}</span>
              </p>
            ) : null}
          </Link>
        ))}
      </div>

      <div className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
        Need Gmail OAuth or a quick mailbox test? Open{" "}
        <Button type="button" variant="link" className="h-auto p-0 text-sm" asChild>
          <Link href={GROWTH_COMMUNICATIONS_SETTINGS_CARDS[0].href}>Mailboxes</Link>
        </Button>
        {" "}for connect, validate, and human-approved test sends.
      </div>
    </div>
  )
}
