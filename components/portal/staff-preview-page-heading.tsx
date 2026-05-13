import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

export function StaffPreviewPageHeading({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div className="space-y-1">
      <h1 className={PAGE_STANDARD_PAGE_TITLE} style={{ color: "var(--portal-foreground)" }}>
        {title}
      </h1>
      {description ?
        <p className="text-sm" style={{ color: "var(--portal-nav-text)" }}>
          {description}
        </p>
      : null}
    </div>
  )
}
