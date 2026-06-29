import { Signature } from "lucide-react"
import { GrowthEmailSignaturesPanel } from "@/components/growth/signatures/growth-email-signatures-panel"
import { GROWTH_SETTINGS_SECTION_GAP } from "@/components/growth/growth-settings-ui"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"

export default function Page() {
  return (
    <div className={GROWTH_SETTINGS_SECTION_GAP}>
      <GrowthWorkspacePageHeader
        title="Email Signatures"
        description="Sender profiles, signature templates, and mailbox assignments for outreach."
        icon={Signature}
      />
      <GrowthEmailSignaturesPanel />
    </div>
  )
}
