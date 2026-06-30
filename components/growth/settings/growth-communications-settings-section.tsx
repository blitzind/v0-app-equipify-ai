"use client"

import type { ElementType, ReactNode } from "react"
import Link from "next/link"
import { ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  GROWTH_SETTINGS_COMMUNICATIONS_REFINEMENT_2C_QA_MARKER,
  GROWTH_SETTINGS_SECTION_GAP,
} from "@/components/growth/growth-settings-ui"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import {
  GROWTH_COMMUNICATIONS_SETTINGS_PATH,
  GROWTH_COMMUNICATIONS_SETTINGS_QA_MARKER,
} from "@/lib/growth/navigation/growth-communications-settings-navigation"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"

type GrowthCommunicationsSettingsSectionProps = {
  title: string
  description: string
  icon?: ElementType
  adminFallbackHref?: string
  adminFallbackLabel?: string
  children: ReactNode
}

const GROWTH_SETTINGS_HUB_PATH = `${GROWTH_WORKSPACE_BASE_PATH}/settings`

export function GrowthCommunicationsSettingsSection({
  title,
  description,
  icon,
  adminFallbackHref,
  adminFallbackLabel = "Platform admin",
  children,
}: GrowthCommunicationsSettingsSectionProps) {
  return (
    <div
      className={GROWTH_SETTINGS_SECTION_GAP}
      data-growth-communications-settings={GROWTH_COMMUNICATIONS_SETTINGS_QA_MARKER}
      data-growth-settings-communications-refinement={GROWTH_SETTINGS_COMMUNICATIONS_REFINEMENT_2C_QA_MARKER}
    >
      <GrowthWorkspacePageHeader
        title={title}
        description={description}
        icon={icon}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href={GROWTH_COMMUNICATIONS_SETTINGS_PATH}>All communications</Link>
            </Button>
            <Button type="button" variant="ghost" size="sm" asChild>
              <Link href={GROWTH_SETTINGS_HUB_PATH}>All settings</Link>
            </Button>
            {adminFallbackHref ? (
              <Button type="button" variant="ghost" size="sm" asChild>
                <Link href={adminFallbackHref}>
                  {adminFallbackLabel}
                  <ExternalLink className="ml-1.5 size-3.5" />
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />
      {children}
    </div>
  )
}
