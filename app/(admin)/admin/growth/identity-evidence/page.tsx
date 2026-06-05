"use client"

import { UserCheck } from "lucide-react"
import { useAdmin } from "@/lib/admin-store"
import { GrowthHumanIdentityEvidenceWorkspace } from "@/components/growth/human-identity-evidence/growth-human-identity-evidence-workspace"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import {
  PlatformAdminPageShell,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"
import { GROWTH_HUMAN_IDENTITY_EVIDENCE_QA_MARKER } from "@/lib/growth/human-identity-evidence/human-identity-evidence-types"

export default function AdminGrowthIdentityEvidencePage() {
  const { sessionIdentity } = useAdmin()
  const header = usePlatformAdminHeaderIdentity({
    displayName: sessionIdentity?.displayName,
    email: sessionIdentity?.email,
    platformRoleLabel: sessionIdentity?.platformRoleLabel,
  })

  return (
    <PlatformAdminPageShell header={header}>
      <div
        className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8"
        data-qa-marker={GROWTH_HUMAN_IDENTITY_EVIDENCE_QA_MARKER}
      >
        <GrowthSectionLayout
          icon={UserCheck}
          title="Human identity evidence review"
          description="Review team-page contacts against source evidence. Verification requires existing channels and evidence — no manual phone, email, or LinkedIn creation."
          pageTitleClassName={PAGE_STANDARD_PAGE_TITLE}
        >
          <GrowthHumanIdentityEvidenceWorkspace />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
