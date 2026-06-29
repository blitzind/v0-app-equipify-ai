"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  GROWTH_COMMUNICATIONS_SETTINGS_CARDS,
  GROWTH_COMMUNICATIONS_SETTINGS_QA_MARKER,
} from "@/lib/growth/navigation/growth-communications-settings-navigation"
import { GROWTH_SETTINGS_SECTION_GAP } from "@/components/growth/growth-settings-ui"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"
import { Truck } from "lucide-react"

export function GrowthCommunicationsSettingsHub() {
  const pathname = usePathname()
  void pathname

  return (
    <div className={GROWTH_SETTINGS_SECTION_GAP} data-qa-marker={GROWTH_COMMUNICATIONS_SETTINGS_QA_MARKER}>
      <GrowthWorkspacePageHeader
        title="Communications"
        description="Mailboxes, DNS, warmup, sender pools, and reputation — configure outbound email readiness here."
        icon={Truck}
        actions={
          <Button type="button" variant="ghost" size="sm" asChild>
            <Link href={`${GROWTH_WORKSPACE_BASE_PATH}/settings`}>All settings</Link>
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
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-300">
                  <card.icon size={17} />
                </span>
                <div>
                  <h2 className="font-semibold tracking-tight">{card.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
                </div>
              </div>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        Connect Gmail or Microsoft mailboxes, validate DNS, and send approved test messages from{" "}
        <Button type="button" variant="link" className="h-auto p-0 text-sm" asChild>
          <Link href={GROWTH_COMMUNICATIONS_SETTINGS_CARDS[0].href}>Mailboxes</Link>
        </Button>
        .
      </div>
    </div>
  )
}
