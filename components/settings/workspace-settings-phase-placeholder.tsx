"use client"

import type { ElementType } from "react"
import Link from "next/link"
import { Construction, ExternalLink, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { WorkspaceSettingsNavItem } from "@/lib/settings/workspace-settings-navigation"

export const WORKSPACE_SETTINGS_PHASE_PLACEHOLDER_QA_MARKER = "workspace-settings-phase-placeholder-ge-set-2-v1" as const

type WorkspaceSettingsPhasePlaceholderProps = {
  section: WorkspaceSettingsNavItem
  icon?: ElementType
  iconClassName?: string
  variant?: "phase" | "admin"
  phaseLabel?: string
  phaseDescription?: string
  adminTitle?: string
  adminDescription?: string
}

export function WorkspaceSettingsPhasePlaceholder({
  section,
  icon: Icon,
  iconClassName = "bg-slate-100 text-slate-600",
  variant = "phase",
  phaseLabel = "Phase 2",
  phaseDescription = "Phase GE-SET-2 establishes navigation and shell architecture — configuration surfaces migrate in later phases.",
  adminTitle = "Administrative Tools",
  adminDescription = "This admin-only area provides diagnostics, support workflows, governance tools, and operational oversight for the platform.",
}: WorkspaceSettingsPhasePlaceholderProps) {
  const IconComponent = Icon ?? section.icon

  return (
    <div
      className="flex flex-col gap-6"
      data-qa-marker={WORKSPACE_SETTINGS_PHASE_PLACEHOLDER_QA_MARKER}
      data-placeholder-variant={variant}
    >
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              className={`flex size-9 shrink-0 items-center justify-center rounded-full ${iconClassName}`}
            >
              <IconComponent size={17} />
            </span>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{section.label}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
            </div>
          </div>
          {section.existingConfigHref ? (
            <Button asChild size="sm" variant="outline">
              <Link href={section.existingConfigHref}>
                {section.existingConfigLabel ?? "Open existing configuration"}
                <ExternalLink className="ml-2 size-3.5" />
              </Link>
            </Button>
          ) : null}
        </div>
      </section>

      {variant === "admin" ? (
        <section className="rounded-xl border border-dashed border-border bg-card p-6 text-center shadow-sm">
          <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Shield className="size-5" />
          </span>
          <h2 className="mt-3 text-base font-semibold">{adminTitle}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{adminDescription}</p>
          {section.existingConfigHref ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Operational tools are available in{" "}
              <Link
                href={section.existingConfigHref}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {section.existingConfigLabel ?? "the existing configuration"}
              </Link>
              .
            </p>
          ) : null}
        </section>
      ) : (
        <section className="rounded-xl border border-dashed border-border bg-card p-6 text-center shadow-sm">
          <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Construction className="size-5" />
          </span>
          <h2 className="mt-3 text-base font-semibold">Coming in {phaseLabel}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {section.label} will be managed here in Workspace Settings. {phaseDescription}
          </p>
          {section.existingConfigHref ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Until migration completes, use{" "}
              <Link
                href={section.existingConfigHref}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {section.existingConfigLabel ?? "the existing configuration"}
              </Link>
              .
            </p>
          ) : null}
        </section>
      )}
    </div>
  )
}
