"use client"

import type { ReactNode } from "react"
import { AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GROWTH_SETTINGS_SECTION_GAP } from "@/components/growth/growth-settings-ui"

export function GrowthSettingsSectionLoadingState({ label = "Loading settings…" }: { label?: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
      <Loader2 className="mr-2 size-4 animate-spin" />
      {label}
    </div>
  )
}

export function GrowthSettingsSectionErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p>{message}</p>
          {onRetry ? (
            <Button type="button" size="sm" variant="outline" className="mt-3" onClick={onRetry}>
              Retry
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function GrowthSettingsSectionForm({
  children,
  footer,
}: {
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className={GROWTH_SETTINGS_SECTION_GAP}>
      {children}
      {footer}
    </div>
  )
}

export function GrowthSettingsSaveStatus({ saving }: { saving: boolean }) {
  if (!saving) return null
  return (
    <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status" aria-live="polite">
      <Loader2 className="size-3.5 animate-spin" aria-hidden />
      Saving…
    </p>
  )
}

export function GrowthSettingsField({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      {children}
    </label>
  )
}
