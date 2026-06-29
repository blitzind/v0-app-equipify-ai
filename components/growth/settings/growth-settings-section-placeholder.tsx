import type { ElementType } from "react"
import Link from "next/link"
import { Construction, ExternalLink } from "lucide-react"
import type { GrowthSettingsNavItem } from "@/lib/growth/navigation/growth-workspace-settings-navigation"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { Button } from "@/components/ui/button"

type GrowthSettingsSectionPlaceholderProps = {
  section: GrowthSettingsNavItem
  icon?: ElementType
  iconClassName?: string
}

export function GrowthSettingsSectionPlaceholder({
  section,
  icon: Icon,
  iconClassName = "bg-slate-100 text-slate-600",
}: GrowthSettingsSectionPlaceholderProps) {
  return (
    <div className="flex flex-col gap-6">
      <GrowthWorkspacePageHeader
        title={section.label}
        description={section.description}
        icon={Icon ?? section.icon}
        iconClassName={iconClassName}
        actions={
          section.adminFallbackHref ? (
            <Button asChild size="sm" variant="outline">
              <Link href={section.adminFallbackHref}>
                {section.adminFallbackLabel ?? "Open admin settings"}
                <ExternalLink className="ml-2 size-3.5" />
              </Link>
            </Button>
          ) : undefined
        }
      />

      <section className="rounded-xl border border-dashed border-border bg-card p-6 text-center shadow-sm">
        <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Construction className="size-5" />
        </span>
        <h2 className="mt-3 text-base font-semibold">Settings unavailable</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {section.label} is not available in Growth settings yet.
        </p>
        {section.adminFallbackHref ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Use{" "}
            <Link href={section.adminFallbackHref} className="font-medium text-primary underline-offset-4 hover:underline">
              {section.adminFallbackLabel ?? "Platform Admin settings"}
            </Link>{" "}
            for this configuration.
          </p>
        ) : null}
      </section>
    </div>
  )
}
