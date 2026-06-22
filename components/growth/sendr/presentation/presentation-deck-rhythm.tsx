"use client"

import type { ReactNode } from "react"
import { usePresentationTheme } from "@/components/growth/sendr/presentation/presentation-section"
import { cn } from "@/lib/utils"

export function PresentationDeckGap({ className }: { className?: string }) {
  return <div className={cn("h-2 sm:h-4", className)} aria-hidden />
}

export function PresentationDeckDivider({ label, className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-4 py-2", className)}>
      <div
        className="h-px flex-1"
        style={{
          background: `linear-gradient(to right, transparent, color-mix(in srgb, var(--sendr-page-text) 20%, transparent), transparent)`,
        }}
      />
      {label ? (
        <span
          className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: "color-mix(in srgb, var(--sendr-page-text) 45%, transparent)" }}
        >
          {label}
        </span>
      ) : null}
      <div
        className="h-px flex-1"
        style={{
          background: `linear-gradient(to right, transparent, color-mix(in srgb, var(--sendr-page-text) 20%, transparent), transparent)`,
        }}
      />
    </div>
  )
}

export function PresentationFinaleCta({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  const theme = usePresentationTheme()
  const accent = theme.accentColor ?? "#2563eb"

  return (
    <section
      className={cn("rounded-[1.75rem] border p-6 sm:p-8", className)}
      style={{
        borderColor: `${accent}26`,
        background: `linear-gradient(to bottom right, color-mix(in srgb, ${accent} 8%, var(--sendr-surface)), var(--sendr-surface), color-mix(in srgb, var(--sendr-page-bg) 40%, var(--sendr-surface)))`,
        color: "var(--sendr-page-text)",
      }}
    >
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
      {description ? (
        <p
          className="mt-2 max-w-xl text-sm leading-relaxed sm:text-base"
          style={{ color: "color-mix(in srgb, var(--sendr-page-text) 70%, transparent)" }}
        >
          {description}
        </p>
      ) : null}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">{children}</div>
    </section>
  )
}
