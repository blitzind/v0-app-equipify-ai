"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { ExternalLink, Phone } from "lucide-react"
import { GrowthCommunicationSettingsPanel } from "@/components/growth/growth-communication-settings"
import { GrowthLiveCoachingSettingsPanel } from "@/components/growth/growth-live-coaching-settings"
import { GrowthOperatorAssistPreferencesPanel } from "@/components/growth/growth-operator-assist-preferences"
import { GrowthCallingConnectionStatusPanel } from "@/components/growth/settings/growth-calling-connection-status-panel"
import { GrowthCallingPreferencesReadinessSummary } from "@/components/growth/settings/growth-calling-preferences-readiness-summary"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"
import {
  GROWTH_SETTINGS_SECTION_GAP,
  GROWTH_SETTINGS_VOICE_CALLING_REFINEMENT_2D_QA_MARKER,
} from "@/components/growth/growth-settings-ui"
import { growthAvaCallAssistanceTitle } from "@/lib/growth/workspace/growth-workspace-ava-identity"
import { Button } from "@/components/ui/button"

export const GROWTH_SETTINGS_CALLING_PREFERENCES_PAGE_QA_MARKER =
  "growth-settings-calling-preferences-wiring-1a-v1" as const

const PLATFORM_ADMIN_VOICE_HREF = "/admin/growth/settings/communications"

function CallingPreferencesSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="space-y-3" aria-labelledby={`calling-section-${title.replace(/\s+/g, "-").toLowerCase()}`}>
      <div>
        <h2
          id={`calling-section-${title.replace(/\s+/g, "-").toLowerCase()}`}
          className="text-sm font-semibold tracking-tight text-foreground"
        >
          {title}
        </h2>
        {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

export function GrowthSettingsCallingPreferencesPage() {
  const { teammate } = useAiTeammateIdentity()
  return (
    <div
      className={GROWTH_SETTINGS_SECTION_GAP}
      data-qa-marker={GROWTH_SETTINGS_CALLING_PREFERENCES_PAGE_QA_MARKER}
      data-growth-settings-voice-calling-refinement={GROWTH_SETTINGS_VOICE_CALLING_REFINEMENT_2D_QA_MARKER}
    >
      <GrowthWorkspacePageHeader
        title="Calling Preferences"
        description={`Dialer defaults, call assistance from ${teammate.name}, and live coaching for outbound and inbound calls.`}
        icon={Phone}
        actions={
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href={PLATFORM_ADMIN_VOICE_HREF}>
              Platform admin
              <ExternalLink className="ml-1.5 size-3.5" aria-hidden />
            </Link>
          </Button>
        }
      />

      <GrowthCallingPreferencesReadinessSummary />

      <CallingPreferencesSection
        title="Connection status"
        description="Workspace telephony connection at a glance."
      >
        <GrowthCallingConnectionStatusPanel />
      </CallingPreferencesSection>

      <CallingPreferencesSection
        title="Dialer"
        description="How calls launch from records and the call workspace."
      >
        <GrowthCommunicationSettingsPanel mode="operator" variant="calling-preferences" />
      </CallingPreferencesSection>

      <CallingPreferencesSection
        title={growthAvaCallAssistanceTitle(teammate)}
        description="Real-time guidance and coaching during live calls."
      >
        <div className={GROWTH_SETTINGS_SECTION_GAP}>
          <GrowthOperatorAssistPreferencesPanel />
          <GrowthLiveCoachingSettingsPanel mode="operator" />
        </div>
      </CallingPreferencesSection>
    </div>
  )
}
