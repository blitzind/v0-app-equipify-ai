"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { ExternalLink, Shield } from "lucide-react"
import { GrowthComplianceDashboardPanel } from "@/components/growth/growth-compliance-dashboard"
import { GrowthComplianceReadinessSummary } from "@/components/growth/settings/growth-compliance-readiness-summary"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import {
  GROWTH_SETTINGS_COMPLIANCE_REFINEMENT_2G_QA_MARKER,
  GROWTH_SETTINGS_SECTION_GAP,
} from "@/components/growth/growth-settings-ui"
import { Button } from "@/components/ui/button"

export const GROWTH_SETTINGS_COMPLIANCE_PAGE_QA_MARKER = "growth-settings-compliance-wiring-1a-v1" as const

const PLATFORM_ADMIN_COMPLIANCE_HREF = "/admin/growth/providers/compliance"

export function GrowthSettingsCompliancePage() {
  return (
    <div
      className={GROWTH_SETTINGS_SECTION_GAP}
      data-qa-marker={GROWTH_SETTINGS_COMPLIANCE_PAGE_QA_MARKER}
      data-growth-settings-compliance-refinement={GROWTH_SETTINGS_COMPLIANCE_REFINEMENT_2G_QA_MARKER}
    >
      <GrowthWorkspacePageHeader
        title="Compliance"
        description="Trust, safety, and outreach policy for your workspace."
        icon={Shield}
        actions={
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href={PLATFORM_ADMIN_COMPLIANCE_HREF}>
              Platform admin
              <ExternalLink className="ml-1.5 size-3.5" aria-hidden />
            </Link>
          </Button>
        }
      />

      <GrowthComplianceReadinessSummary />

      <GrowthComplianceDashboardPanel variant="operator" />
    </div>
  )
}
