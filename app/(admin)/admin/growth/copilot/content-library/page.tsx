import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import { GrowthContentLibraryDashboardView } from "@/components/growth/growth-content-library-dashboard"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
} from "@/components/admin/platform-admin-shell"

export default function GrowthContentLibraryPage() {
  return (
    <PlatformAdminPageShell>
      <PlatformAdminTabNav activeKey="growth_leads" />
      <GrowthSectionLayout
        title="Content Library"
        description="Governed templates and snippets for sequences, reply drafts, booking follow-ups, and manual tasks — approval required before live send, no unsafe merge fields."
      >
        <GrowthContentLibraryDashboardView />
      </GrowthSectionLayout>
    </PlatformAdminPageShell>
  )
}
