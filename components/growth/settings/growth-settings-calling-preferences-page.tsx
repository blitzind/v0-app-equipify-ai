"use client"

import Link from "next/link"
import { Phone } from "lucide-react"
import { GrowthCommunicationSettingsPanel } from "@/components/growth/growth-communication-settings"
import { GrowthLiveCoachingSettingsPanel } from "@/components/growth/growth-live-coaching-settings"
import { GrowthNativeDialerSettingsPanel } from "@/components/growth/growth-native-dialer-settings-panel"
import { GrowthOperatorAssistPreferencesPanel } from "@/components/growth/growth-operator-assist-preferences"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GROWTH_SETTINGS_SECTION_GAP } from "@/components/growth/growth-settings-ui"
import { Button } from "@/components/ui/button"
import { ExternalLink } from "lucide-react"

export const GROWTH_SETTINGS_CALLING_PREFERENCES_PAGE_QA_MARKER =
  "growth-settings-calling-preferences-wiring-1a-v1" as const

export function GrowthSettingsCallingPreferencesPage() {
  return (
    <div
      className={GROWTH_SETTINGS_SECTION_GAP}
      data-qa-marker={GROWTH_SETTINGS_CALLING_PREFERENCES_PAGE_QA_MARKER}
    >
      <GrowthWorkspacePageHeader
        title="Calling Preferences"
        description="Dialer defaults, native dialer providers, live coaching, and operator assist preferences."
        icon={Phone}
        iconClassName="bg-sky-50 text-sky-700"
        actions={
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/admin/growth/settings/communications">
              Voice infrastructure (admin)
              <ExternalLink className="ml-1.5 size-3.5" />
            </Link>
          </Button>
        }
      />
      <GrowthCommunicationSettingsPanel mode="operator" />
      <GrowthNativeDialerSettingsPanel />
      <GrowthLiveCoachingSettingsPanel />
      <GrowthOperatorAssistPreferencesPanel />
    </div>
  )
}
