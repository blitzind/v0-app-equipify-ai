"use client"

import { Bot, ShieldCheck, SlidersHorizontal, Sparkles, Workflow } from "lucide-react"
import { GrowthBrowserExtensionInstallCard } from "@/components/growth/growth-browser-extension-install-card"
import {
  GROWTH_SETTINGS_INNER_GAP,
  GROWTH_SETTINGS_SECTION_GAP,
  GrowthSettingsBadge,
  GrowthSettingsCard,
} from "@/components/growth/growth-settings-ui"

export const GROWTH_ENGINE_SETTINGS_QA_MARKER = "growth-engine-settings-v1" as const

const COMING_SOON_SECTIONS = [
  {
    id: "defaults",
    title: "Growth Engine defaults",
    description: "Org-wide defaults for prospecting, sequencing, and workspace behavior.",
    icon: SlidersHorizontal,
  },
  {
    id: "approval",
    title: "Approval defaults",
    description: "Default approval gates for outreach, personalization, and send actions.",
    icon: ShieldCheck,
  },
  {
    id: "safeguards",
    title: "Automation safeguards",
    description: "Rate limits, quiet hours, and human-in-the-loop guardrails across Growth workflows.",
    icon: Workflow,
  },
  {
    id: "copilot",
    title: "AI / Copilot behavior",
    description: "Global Copilot posture, draft review rules, and passive-assist boundaries.",
    icon: Bot,
  },
  {
    id: "workspace",
    title: "Workspace operating rules",
    description: "Call workspace, inbox routing, and operator handoff conventions.",
    icon: Sparkles,
  },
] as const

export function GrowthEngineSettingsPanel() {
  return (
    <div
      className={GROWTH_SETTINGS_SECTION_GAP}
      data-qa-marker={GROWTH_ENGINE_SETTINGS_QA_MARKER}
    >
      <p className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground dark:border-[#25324C]">
        Global Growth Engine settings live here. Channel, calendar, voice, and Copilot connection settings are under{" "}
        <span className="font-medium text-foreground">Communications</span> in Settings.
      </p>

      <GrowthBrowserExtensionInstallCard compact />

      {COMING_SOON_SECTIONS.map((section) => (
        <GrowthSettingsCard
          key={section.id}
          id={`growth-settings-${section.id}`}
          title={section.title}
          icon={<section.icon size={16} />}
          headerAside={<GrowthSettingsBadge label="Coming soon" tone="neutral" />}
        >
          <div className={GROWTH_SETTINGS_INNER_GAP}>
            <p className="text-sm text-muted-foreground">{section.description}</p>
            <p className="text-xs text-muted-foreground">
              Read-only preview — configuration is not wired yet. No settings are changed automatically.
            </p>
          </div>
        </GrowthSettingsCard>
      ))}
    </div>
  )
}
