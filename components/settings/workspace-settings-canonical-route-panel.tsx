"use client"

import type { ElementType } from "react"
import Link from "next/link"
import { ArrowRight, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { WorkspaceSettingsNavItem } from "@/lib/settings/workspace-settings-navigation"

export const WORKSPACE_SETTINGS_CANONICAL_ROUTE_QA_MARKER =
  "workspace-settings-canonical-route-ge-set-4-v1" as const

type WorkspaceSettingsCanonicalRoutePanelProps = {
  section: WorkspaceSettingsNavItem
  canonicalHref: string
  canonicalLabel?: string
  icon?: ElementType
  iconClassName?: string
}

export function WorkspaceSettingsCanonicalRoutePanel({
  section,
  canonicalHref,
  canonicalLabel = "Open notification preferences",
  icon: Icon,
  iconClassName = "bg-slate-100 text-slate-600",
}: WorkspaceSettingsCanonicalRoutePanelProps) {
  const IconComponent = Icon ?? section.icon

  return (
    <div className="flex flex-col gap-6" data-qa-marker={WORKSPACE_SETTINGS_CANONICAL_ROUTE_QA_MARKER}>
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              className={`flex size-9 shrink-0 items-center justify-center rounded-full ${iconClassName}`}
            >
              <IconComponent size={17} />
            </span>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{section.label}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
            </div>
          </div>
          <Button asChild size="sm">
            <Link href={canonicalHref}>
              {canonicalLabel}
              <ArrowRight className="ml-2 size-3.5" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">
          {section.label} are managed in one canonical editor under{" "}
          <span className="font-medium text-foreground">General → Growth Operator</span>. This Growth Engine
          entry deep-links there to avoid duplicate configuration surfaces.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          The Platform Admin notification center remains available for operational alerts — only the
          preferences editor is consolidated.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link href={canonicalHref}>
            {canonicalLabel}
            <ExternalLink className="ml-2 size-3.5" />
          </Link>
        </Button>
      </section>
    </div>
  )
}
