"use client"

import { cn } from "@/lib/utils"
import { BrandLogo } from "@/components/brand-logo"

/**
 * Tertiary attribution — workspace/service provider remains primary.
 *
 * Two sizes:
 *  - `sm` (legacy compact): 12px wordmark for tight inline slots.
 *  - `lg` (~3× sm): used on the portal sign-in card and the dark portal footer
 *    band so the Equipify mark is readable. Default is `lg`.
 */
export function ProvidedByEquipify({
  className,
  variant = "onDark",
  size = "lg",
  logoHref,
}: {
  className?: string
  /** Dark header (login strip / portal footer) vs light light-surface contexts */
  variant?: "onDark" | "onLight"
  size?: "sm" | "lg"
  logoHref?: string
}) {
  const labelClass =
    variant === "onDark" ? "text-white/65" : "text-[var(--portal-nav-text)]"

  const labelSizeClass =
    size === "lg"
      ? "text-[11px] sm:text-[12px] font-medium uppercase tracking-[0.16em]"
      : "text-[10px] font-medium uppercase tracking-[0.14em]"

  const logoSizeClass =
    size === "lg"
      ? "h-9 sm:h-10 w-auto max-w-[200px] sm:max-w-[240px]"
      : "h-3 w-auto max-w-[72px] sm:max-w-[84px]"

  const logoSizes = size === "lg" ? "240px" : "84px"
  const logo = (
    <BrandLogo
      className={cn(logoSizeClass, "object-contain object-left opacity-95")}
      sizes={logoSizes}
    />
  )

  return (
    <div
      className={cn(
        "flex items-center justify-center flex-wrap",
        size === "lg" ? "gap-2 sm:gap-2.5" : "gap-1.5",
        variant === "onLight" ? "pt-0.5" : "pt-1",
        className,
      )}
      aria-hidden={false}
    >
      <span className={cn(labelSizeClass, labelClass)}>Provided by</span>
      {logoHref ? (
        <a
          href={logoHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F172A]"
        >
          {logo}
        </a>
      ) : (
        logo
      )}
      <span className="sr-only">Equipify</span>
    </div>
  )
}
