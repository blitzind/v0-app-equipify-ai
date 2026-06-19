"use client"

import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function GrowthVideoPageStepCard({
  step,
  title,
  icon: Icon,
  children,
  required,
  className,
  id,
}: {
  step: number
  title: string
  icon?: LucideIcon
  children: ReactNode
  required?: boolean
  className?: string
  id?: string
}) {
  const titleId = id ?? `growth-video-page-step-${step}-title`

  return (
    <section
      aria-labelledby={titleId}
      className={cn("rounded-xl border border-border bg-card p-6 shadow-sm", className)}
    >
      <div className="mb-5 flex items-start gap-3">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
          aria-hidden
        >
          {step}
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={titleId} className="flex flex-wrap items-center gap-2 text-base font-semibold text-foreground">
            {Icon ? <Icon className="size-4 text-muted-foreground" aria-hidden /> : null}
            <span>
              {title}
              {required ? (
                <span className="ml-1 text-destructive" aria-label="required">
                  *
                </span>
              ) : null}
            </span>
          </h3>
        </div>
      </div>
      {children}
    </section>
  )
}
