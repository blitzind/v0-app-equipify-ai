import { Shield } from "lucide-react"
import { GrowthComplianceDashboardPanel } from "@/components/growth/growth-compliance-dashboard"
import { GROWTH_SETTINGS_SECTION_GAP } from "@/components/growth/growth-settings-ui"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ExternalLink } from "lucide-react"

export default function GrowthSettingsCompliancePage() {
  return (
    <div className={GROWTH_SETTINGS_SECTION_GAP}>
      <GrowthWorkspacePageHeader
        title="Compliance"
        description="Unsubscribe settings, suppression lists, and outreach compliance rules."
        icon={Shield}
        actions={
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/admin/growth/providers/compliance">
              Platform admin
              <ExternalLink className="ml-1.5 size-3.5" />
            </Link>
          </Button>
        }
      />
      <GrowthComplianceDashboardPanel />
    </div>
  )
}
