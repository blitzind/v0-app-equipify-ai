"use client"

import Link from "next/link"
import { ArrowRight, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAdmin } from "@/lib/admin-store"
import {
  getGrowthEngineSettingsAdminFallbackHref,
  getGrowthEngineSettingsBridgeDescription,
  getGrowthEngineSettingsBridgeSwitchLabel,
} from "@/lib/growth/navigation/growth-workspace-settings-canonical"
import type { WorkspaceSettingsNavItem } from "@/lib/settings/workspace-settings-navigation"

export const WORKSPACE_SETTINGS_GROWTH_ENGINE_BRIDGE_QA_MARKER =
  "workspace-settings-growth-engine-bridge-8j-v1" as const

type WorkspaceSettingsGrowthEngineBridgePanelProps = {
  section: WorkspaceSettingsNavItem
  growthSettingsHref: string
}

export function WorkspaceSettingsGrowthEngineBridgePanel({
  section,
  growthSettingsHref,
}: WorkspaceSettingsGrowthEngineBridgePanelProps) {
  const { isPlatformAdmin } = useAdmin()
  const Icon = section.icon
  const bridgeDescription = getGrowthEngineSettingsBridgeDescription(section.id, section.label)
  const switchLabel = getGrowthEngineSettingsBridgeSwitchLabel(section.id)
  const adminFallbackHref = getGrowthEngineSettingsAdminFallbackHref(section.id)

  return (
    <div className="flex flex-col gap-6" data-qa-marker={WORKSPACE_SETTINGS_GROWTH_ENGINE_BRIDGE_QA_MARKER}>
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <Icon size={17} />
            </span>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{section.label}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
            </div>
          </div>
          <Button asChild size="sm">
            <Link href={growthSettingsHref}>
              {switchLabel}
              <ArrowRight className="ml-2 size-3.5" />
            </Link>
          </Button>
        </div>
      </section>

      <section
        className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 px-4 py-3 text-sm"
        data-bridge-transition="workspace-to-growth"
      >
        <p className="font-medium text-foreground">Workspace transition</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-muted-foreground">
          <span className="rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground">
            Current area: Workspace Settings
          </span>
          <ArrowRight className="size-3.5 shrink-0" aria-hidden />
          <span className="rounded-md border border-emerald-200 bg-background px-2 py-1 text-xs font-medium text-emerald-900">
            Destination: AI OS Settings
          </span>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <p className="text-sm font-medium text-foreground">
          This setting now lives in the AI OS workspace.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Opening it will switch you from Workspace Settings to AI OS settings.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">{bridgeDescription}</p>
        <p className="mt-3 text-sm text-muted-foreground">
          You are currently in workspace settings. Mailboxes, DNS, warmup, sender pools,
          and reputation are managed in the AI OS workspace because they belong to outbound sales
          operations.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild>
            <Link href={growthSettingsHref}>
              {switchLabel}
              <ExternalLink className="ml-2 size-3.5" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={growthSettingsHref}>
              Open in AI OS
              <ExternalLink className="ml-2 size-3.5" />
            </Link>
          </Button>
          {isPlatformAdmin && adminFallbackHref ? (
            <Button asChild variant="ghost">
              <Link href={adminFallbackHref}>
                Admin fallback
                <ExternalLink className="ml-2 size-3.5" />
              </Link>
            </Button>
          ) : null}
        </div>
      </section>
    </div>
  )
}
