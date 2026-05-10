import type { ReactNode } from "react"
import { StaffPreviewFrame } from "@/components/portal/staff-preview-frame"
import type { StaffPreviewServerContext } from "@/lib/portal/staff-preview-load"

/** Wraps staff-only preview sub-routes with the shared chrome (nav, banner, footer). */
export function StaffPreviewSubpageShell({
  ctx,
  children,
}: {
  ctx: StaffPreviewServerContext
  children: ReactNode
}) {
  return (
    <StaffPreviewFrame
      organizationId={ctx.organizationId}
      customerId={ctx.customerId}
      organizationName={ctx.organizationName}
      logoUrl={ctx.logoUrl}
      portalAccentCssVariables={ctx.portalAccentCssVariables}
      snapshot={ctx.snapshot}
    >
      {children}
    </StaffPreviewFrame>
  )
}
