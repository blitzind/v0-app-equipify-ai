import { Shield } from "lucide-react"
import { GrowthComplianceDashboardPanel } from "@/components/growth/growth-compliance-dashboard"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ExternalLink } from "lucide-react"

export default function GrowthSettingsCompliancePage() {
  return (
    <div className="space-y-6">
      <GrowthWorkspacePageHeader
        title="Compliance"
        description="Unsubscribe settings, suppression lists, and outreach compliance rules."
        icon={Shield}
        iconClassName="bg-rose-50 text-rose-700"
        actions={
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/admin/growth/providers/compliance">
              Admin fallback
              <ExternalLink className="ml-1.5 size-3.5" />
            </Link>
          </Button>
        }
      />
      <GrowthComplianceDashboardPanel />
    </div>
  )
}
