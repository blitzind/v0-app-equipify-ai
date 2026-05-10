export function StaffPreviewPageHeading({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div className="space-y-1">
      <h1 className="text-xl font-semibold" style={{ color: "var(--portal-foreground)" }}>
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
