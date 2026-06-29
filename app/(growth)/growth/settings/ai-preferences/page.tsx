import { Bot } from "lucide-react"
import Link from "next/link"
import { GrowthAiCopilotSettingsPanel } from "@/components/growth/growth-ai-copilot-settings"
import { GROWTH_SETTINGS_SECTION_GAP } from "@/components/growth/growth-settings-ui"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { Button } from "@/components/ui/button"
import { ExternalLink } from "lucide-react"

export default function GrowthSettingsAiPreferencesPage() {
  return (
    <div className={GROWTH_SETTINGS_SECTION_GAP}>
      <GrowthWorkspacePageHeader
        title="AI Preferences"
        description="Aiden guidance, copilot tone, and AI assist defaults."
        icon={Bot}
        actions={
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/admin/growth/settings/communications">
              Platform admin
              <ExternalLink className="ml-1.5 size-3.5" />
            </Link>
          </Button>
        }
      />
      <GrowthAiCopilotSettingsPanel />
    </div>
  )
}
