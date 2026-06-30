import type { ElementType } from "react"
import { Construction } from "lucide-react"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

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
    <GrowthWorkspacePageContent className="max-w-3xl">
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
        <h2 className="mt-3 text-base font-semibold">Currently unavailable</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This workspace section is not enabled for your organization yet. Contact your administrator or use Platform
          admin for full configuration.
        </p>
      </section>
    </GrowthWorkspacePageContent>
  )
}
