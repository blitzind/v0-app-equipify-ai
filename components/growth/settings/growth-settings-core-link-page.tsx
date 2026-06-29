"use client"

import type { ElementType } from "react"
import Link from "next/link"
import { ArrowRight, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GROWTH_SETTINGS_PAGE_HEADER_ICON } from "@/components/growth/growth-settings-ui"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"

type GrowthSettingsCoreLinkPageProps = {
  title: string
  description: string
  icon: ElementType
  iconClassName?: string
  externalHref: string
  externalLabel?: string
  cardDescription: string
}

export function GrowthSettingsCoreLinkPage({
  title,
  description,
  icon,
  iconClassName = GROWTH_SETTINGS_PAGE_HEADER_ICON,
  externalHref,
  externalLabel = "Open workspace settings",
  cardDescription,
}: GrowthSettingsCoreLinkPageProps) {
  return (
    <div className="space-y-6">
      <GrowthWorkspacePageHeader
        title={title}
        description={description}
        icon={icon}
        iconClassName={iconClassName}
      />

      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">{cardDescription}</p>
        <p className="mt-3 text-sm text-muted-foreground">
          These settings are managed in your main workspace. You will leave Growth to configure them.
        </p>
        <Button type="button" className="mt-4" asChild>
          <Link href={externalHref}>
            {externalLabel}
            <ExternalLink className="ml-2 size-3.5" />
          </Link>
        </Button>
      </section>
    </div>
  )
}

type GrowthSettingsCoreLinkHubProps = {
  title: string
  description: string
  icon: ElementType
  iconClassName?: string
  cards: Array<{
    id: string
    title: string
    description: string
    href: string
    icon: ElementType
    growthSettingsPath: string
  }>
}

export function GrowthSettingsCoreLinkHub({
  title,
  description,
  icon,
  iconClassName = GROWTH_SETTINGS_PAGE_HEADER_ICON,
  cards,
}: GrowthSettingsCoreLinkHubProps) {
  return (
    <div className="space-y-6">
      <GrowthWorkspacePageHeader
        title={title}
        description={description}
        icon={icon}
        iconClassName={iconClassName}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.id}
            href={card.growthSettingsPath}
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

      <p className="text-sm text-muted-foreground">
        Team, organization, billing, and integrations use your existing workspace settings — open any card above to
        continue.
      </p>
    </div>
  )
}
