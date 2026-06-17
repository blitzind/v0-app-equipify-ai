import type { ElementType } from "react"
import { Construction } from "lucide-react"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"

type GrowthPlaceholderPageProps = {
  title: string
  description: string
  icon?: ElementType
  iconClassName?: string
}

export function GrowthPlaceholderPage({
  title,
  description,
  icon,
  iconClassName,
}: GrowthPlaceholderPageProps) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <GrowthWorkspacePageHeader
        title={title}
        description={description}
        icon={icon}
        iconClassName={iconClassName}
      />
      <section className="rounded-xl border border-dashed border-border bg-card p-6 text-center shadow-sm">
        <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Construction className="size-5" />
        </span>
        <h2 className="mt-3 text-base font-semibold">Coming soon</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This workspace section is part of the Growth Engine navigation plan. Existing admin functionality remains
          available under `/admin/growth/*` until this route is fully migrated.
        </p>
      </section>
    </div>
  )
}
