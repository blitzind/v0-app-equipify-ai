"use client"

import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { PresentationCard } from "@/components/growth/sendr/presentation/presentation-card"
import { cn } from "@/lib/utils"

type Props = {
  title?: string
  description?: string
  icon?: LucideIcon
  children: ReactNode
  className?: string
  variant?: "default" | "muted" | "elevated"
  unstyled?: boolean
}

export function PresentationSection({
  title,
  description,
  icon: Icon,
  children,
  className,
  variant = "default",
  unstyled = false,
}: Props) {
  const body = (
    <>
      {title || description || Icon ? (
        <header className={cn("mb-5 space-y-1.5", Icon && "flex items-start gap-3")}>
          {Icon ? (
            <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Icon className="size-4" />
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            {title ? (
              <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-[1.35rem]">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400 sm:text-[0.9375rem]">
                {description}
              </p>
            ) : null}
          </div>
        </header>
      ) : null}
      {children}
    </>
  )

  if (unstyled) {
    return <section className={className}>{body}</section>
  }

  return (
    <PresentationCard variant={variant} className={className}>
      {body}
    </PresentationCard>
  )
}
