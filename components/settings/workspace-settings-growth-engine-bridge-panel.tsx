"use client"

import Link from "next/link"
import { ArrowRight, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAdmin } from "@/lib/admin-store"
import {
  getGrowthEngineSettingsAdminFallbackHref,
  getGrowthEngineSettingsBridgeDescription,
} from "@/lib/growth/navigation/growth-workspace-settings-canonical"
import type { WorkspaceSettingsNavItem } from "@/lib/settings/workspace-settings-navigation"

export const WORKSPACE_SETTINGS_GROWTH_ENGINE_BRIDGE_QA_MARKER =
  "workspace-settings-growth-engine-bridge-8i-v1" as const

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
  const primaryLabel = section.existingConfigLabel ?? "Open Growth Settings"
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
              {primaryLabel}
              <ArrowRight className="ml-2 size-3.5" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">{bridgeDescription}</p>
        <p className="mt-3 text-sm text-muted-foreground">
          Growth-specific communication and deliverability settings now live under{" "}
          <span className="font-medium text-foreground">Growth Engine workspace settings</span>. Use the
          button below when you are ready to switch into that workspace — your Core Workspace Settings
          navigation stays in place until you choose to open Growth Settings.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild>
            <Link href={growthSettingsHref}>
              Open Growth Settings
              <ExternalLink className="ml-2 size-3.5" />
            </Link>
          </Button>
          {isPlatformAdmin && adminFallbackHref ? (
            <Button asChild variant="outline">
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
