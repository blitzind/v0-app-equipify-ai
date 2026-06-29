"use client"

import { WorkspaceSettingsGrowthEngineConnectedMailboxesSection } from "@/components/settings/workspace-settings-growth-engine-connected-mailboxes-section"
import { WorkspaceSettingsGrowthEngineDnsVerificationSection } from "@/components/settings/workspace-settings-growth-engine-dns-verification-section"
import { WorkspaceSettingsGrowthEngineSenderPoolsSection } from "@/components/settings/workspace-settings-growth-engine-sender-pools-section"
import { WorkspaceSettingsGrowthEngineSendingDomainsSection } from "@/components/settings/workspace-settings-growth-engine-sending-domains-section"
import { WorkspaceSettingsGrowthEngineWarmupSection } from "@/components/settings/workspace-settings-growth-engine-warmup-section"

/** PROD-HOTFIX — hard route isolation for sections without a direct panel restore. */
export const GROWTH_ENGINE_SETTINGS_HARD_ISOLATION_QA_MARKER =
  "growth-engine-settings-hard-isolation-v1" as const

export const WORKSPACE_SETTINGS_GROWTH_ENGINE_CONNECTED_MAILBOXES_SECTION_ID =
  "connected-mailboxes" as const

export const WORKSPACE_SETTINGS_GROWTH_ENGINE_SENDING_DOMAINS_SECTION_ID =
  "sending-domains" as const

export const WORKSPACE_SETTINGS_GROWTH_ENGINE_DNS_VERIFICATION_SECTION_ID =
  "dns-verification" as const

export const WORKSPACE_SETTINGS_GROWTH_ENGINE_WARMUP_SECTION_ID = "warmup" as const

export const WORKSPACE_SETTINGS_GROWTH_ENGINE_SENDER_POOLS_SECTION_ID = "sender-pools" as const

type WorkspaceSettingsGrowthEngineSectionPageProps = {
  sectionId: string
}

function WorkspaceSettingsGrowthEngineHardIsolationMarker() {
  console.log("SECTION PAGE RENDERED")

  return (
    <div
      data-growth-engine-settings-hard-isolation="v1"
      data-qa-marker={GROWTH_ENGINE_SETTINGS_HARD_ISOLATION_QA_MARKER}
      style={{
        padding: 32,
        background: "#fff",
        border: "3px solid red",
        fontSize: 24,
      }}
    >
      SECTION PAGE RENDERED
    </div>
  )
}

function WorkspaceSettingsGrowthEngineRestoredSection({ sectionId }: { sectionId: string }) {
  switch (sectionId) {
    case WORKSPACE_SETTINGS_GROWTH_ENGINE_CONNECTED_MAILBOXES_SECTION_ID:
      return <WorkspaceSettingsGrowthEngineConnectedMailboxesSection />
    case WORKSPACE_SETTINGS_GROWTH_ENGINE_SENDING_DOMAINS_SECTION_ID:
      return <WorkspaceSettingsGrowthEngineSendingDomainsSection />
    case WORKSPACE_SETTINGS_GROWTH_ENGINE_DNS_VERIFICATION_SECTION_ID:
      return <WorkspaceSettingsGrowthEngineDnsVerificationSection />
    case WORKSPACE_SETTINGS_GROWTH_ENGINE_WARMUP_SECTION_ID:
      return <WorkspaceSettingsGrowthEngineWarmupSection />
    case WORKSPACE_SETTINGS_GROWTH_ENGINE_SENDER_POOLS_SECTION_ID:
      return <WorkspaceSettingsGrowthEngineSenderPoolsSection />
    default:
      return <WorkspaceSettingsGrowthEngineHardIsolationMarker />
  }
}

export default function WorkspaceSettingsGrowthEngineSectionPage({
  sectionId,
}: WorkspaceSettingsGrowthEngineSectionPageProps) {
  return <WorkspaceSettingsGrowthEngineRestoredSection sectionId={sectionId} />
}

export { WorkspaceSettingsGrowthEngineSectionPage }
