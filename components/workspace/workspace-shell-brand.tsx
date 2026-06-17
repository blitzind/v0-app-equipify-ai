"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { BrandLogo, BrandMark } from "@/components/brand-logo"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-registry"

type WorkspaceShellBrandProps = {
  collapsed?: boolean
  /** When true, always show the full wordmark (mobile drawer). */
  forceExpanded?: boolean
  /** Core home vs Growth workspace root. */
  homeHref?: "/" | typeof GROWTH_WORKSPACE_BASE_PATH
  className?: string
}

export function WorkspaceShellBrand({
  collapsed = false,
  forceExpanded = false,
  homeHref = "/",
  className,
}: WorkspaceShellBrandProps) {
  const showCollapsedMark = collapsed && !forceExpanded
  const ariaLabel = homeHref === "/" ? "Equipify — Home" : "Equipify — Growth Engine"

  return (
    <div
      className={cn(
        "relative grid min-h-[52px] w-full shrink-0 place-items-center border-b border-sidebar-border [grid-template-areas:'stack']",
        showCollapsedMark ? "px-0 py-2" : "px-3 py-3.5",
        className,
      )}
    >
      <Link
        href={homeHref}
        className="relative grid min-h-[2.5rem] w-full place-items-center [grid-template-areas:'stack'] rounded-md outline-none ring-sidebar-ring focus-visible:ring-2"
        aria-label={ariaLabel}
      >
        <span
          className={cn(
            "[grid-area:stack] flex w-full max-w-full items-center justify-center px-0.5 transition-opacity duration-200 ease-out motion-reduce:transition-none",
            showCollapsedMark ? "pointer-events-none opacity-0" : "opacity-100",
          )}
          aria-hidden={showCollapsedMark}
        >
          <BrandLogo
            priority
            sizes="(min-width: 768px) 198px, 182px"
            className="min-h-0 min-w-0 max-h-[calc(2.75rem-10px*280/1024)] w-full max-w-[calc(100%-10px)] select-none object-contain object-center sm:max-h-[calc(3rem-10px*280/1024)]"
          />
        </span>
        <span
          className={cn(
            "[grid-area:stack] flex items-center justify-center transition-opacity duration-200 ease-out motion-reduce:transition-none",
            showCollapsedMark ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          aria-hidden={!showCollapsedMark}
        >
          <BrandMark priority sizes="40px" className="h-10 w-10 max-h-10 max-w-10 select-none" />
        </span>
      </Link>
    </div>
  )
}
