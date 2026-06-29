"use client"

import Link from "next/link"
import { ArrowRight, Chrome, Command, Mail, Phone, Calendar } from "lucide-react"
import { GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_PATH } from "@/lib/growth/navigation/growth-communications-settings-navigation"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"

const ADVANCED_CARDS = [
  {
    id: "sidebar-preferences",
    title: "Command Center Preferences",
    description: "Favorite destinations and sidebar defaults for Cmd+K and workspace navigation.",
    href: `${GROWTH_WORKSPACE_BASE_PATH}/settings/sidebar-preferences`,
    icon: Command,
  },
  {
    id: "browser-notifications",
    title: "Browser Notifications",
    description: "Desktop notification permissions for live operator signals.",
    href: `${GROWTH_WORKSPACE_BASE_PATH}/settings/browser-notifications`,
    icon: Chrome,
  },
  {
    id: "calling-preferences",
    title: "Calling Preferences",
    description: "Dialer defaults, call disposition behavior, and live-call preferences.",
    href: `${GROWTH_WORKSPACE_BASE_PATH}/settings/calling-preferences`,
    icon: Phone,
  },
  {
    id: "calendar-preferences",
    title: "Calendar Preferences",
    description: "Meeting booking defaults, availability, and calendar routing rules.",
    href: `${GROWTH_WORKSPACE_BASE_PATH}/settings/calendar-preferences`,
    icon: Calendar,
  },
  {
    id: "gmail",
    title: "Gmail",
    description: "Connect Gmail mailboxes for outbound and inbox tracking.",
    href: GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_PATH,
    icon: Mail,
  },
] as const

export function GrowthSettingsAdvancedHub() {
  return (
    <div className="space-y-6">
      <GrowthWorkspacePageHeader
        title="Advanced"
        description="Operator preferences, integrations shortcuts, and settings that are still migrating into the canonical Growth settings experience."
        icon={Command}
        iconClassName="bg-slate-100 text-slate-600"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {ADVANCED_CARDS.map((card) => (
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
          </Link>
        ))}
      </div>
    </div>
  )
}
