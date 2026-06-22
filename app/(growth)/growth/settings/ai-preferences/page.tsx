import { Bot } from "lucide-react"
import Link from "next/link"
import { GrowthAiCopilotSettingsPanel } from "@/components/growth/growth-ai-copilot-settings"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { Button } from "@/components/ui/button"
import { ExternalLink } from "lucide-react"

export default function GrowthSettingsAiPreferencesPage() {
  return (
    <div className="space-y-6">
      <GrowthWorkspacePageHeader
        title="AI Preferences"
        description="Aiden guidance, copilot tone, and AI assist defaults for operators."
        icon={Bot}
        iconClassName="bg-violet-50 text-violet-700"
        actions={
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/admin/growth/settings/communications">
              Admin communications settings
              <ExternalLink className="ml-1.5 size-3.5" />
            </Link>
          </Button>
        }
      />
      <GrowthAiCopilotSettingsPanel />
    </div>
  )
}
