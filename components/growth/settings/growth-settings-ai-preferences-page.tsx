"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { Bot, ExternalLink } from "lucide-react"
import { GrowthAiCopilotSettingsPanel } from "@/components/growth/growth-ai-copilot-settings"
import { GrowthAiSettingsReadinessSummary } from "@/components/growth/settings/growth-ai-settings-readiness-summary"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import {
  GROWTH_SETTINGS_AI_REFINEMENT_2F_QA_MARKER,
  GROWTH_SETTINGS_SECTION_GAP,
} from "@/components/growth/growth-settings-ui"
import { Button } from "@/components/ui/button"

export const GROWTH_SETTINGS_AI_PREFERENCES_PAGE_QA_MARKER = "growth-settings-ai-preferences-wiring-1a-v1" as const

const PLATFORM_ADMIN_HREF = "/admin/growth/settings/communications"

function AiPreferencesSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  const sectionId = `ai-preferences-section-${title.replace(/\s+/g, "-").toLowerCase()}`
  return (
    <section className="space-y-3" aria-labelledby={sectionId}>
      <div>
        <h2 id={sectionId} className="text-sm font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

export function GrowthSettingsAiPreferencesPage() {
  return (
    <div
      className={GROWTH_SETTINGS_SECTION_GAP}
      data-qa-marker={GROWTH_SETTINGS_AI_PREFERENCES_PAGE_QA_MARKER}
      data-growth-settings-ai-refinement={GROWTH_SETTINGS_AI_REFINEMENT_2F_QA_MARKER}
    >
      <GrowthWorkspacePageHeader
        title="AI Preferences"
        description="Response style, draft preferences, memory, and learning for your AI teammate."
        icon={Bot}
        actions={
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href={PLATFORM_ADMIN_HREF}>
              Platform admin
              <ExternalLink className="ml-1.5 size-3.5" aria-hidden />
            </Link>
          </Button>
        }
      />

      <GrowthAiSettingsReadinessSummary scope="preferences" />

      <AiPreferencesSection
        title="Assist preferences"
        description="How your AI teammate drafts, remembers, and learns from your playbook."
      >
        <GrowthAiCopilotSettingsPanel variant="operator" />
      </AiPreferencesSection>
    </div>
  )
}
