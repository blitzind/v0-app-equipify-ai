import type { ElementType, ReactNode } from "react"
import { cn } from "@/lib/utils"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"
import { GROWTH_SETTINGS_PAGE_HEADER_ICON } from "@/components/growth/growth-settings-ui"

type GrowthWorkspacePageHeaderProps = {
  title: string
  description?: string
  icon?: ElementType
  iconClassName?: string
  actions?: ReactNode
  className?: string
}

export function GrowthWorkspacePageHeader({
  title,
  description,
  icon: Icon,
  iconClassName = GROWTH_SETTINGS_PAGE_HEADER_ICON,
  actions,
  className,
}: GrowthWorkspacePageHeaderProps) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card p-5 shadow-sm", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {Icon ? (
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full",
                iconClassName,
              )}
            >
              <Icon size={17} />
            </span>
          ) : null}
          <div>
            <h1 className={PAGE_STANDARD_PAGE_TITLE}>{title}</h1>
            {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </section>
  )
}
