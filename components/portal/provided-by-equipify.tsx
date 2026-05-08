"use client"

import { cn } from "@/lib/utils"
import { BrandLogo } from "@/components/brand-logo"

/**
 * Subtle secondary attribution — workspace/service provider remains primary.
 */
export function ProvidedByEquipify({
  className,
  variant = "onDark",
}: {
  className?: string
  /** Dark header (login top strip) vs light portal shell header */
  variant?: "onDark" | "onLight"
}) {
  const labelClass =
    variant === "onDark" ? "text-white/55" : "text-[var(--portal-nav-text)]"

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-1.5 flex-wrap",
        variant === "onLight" ? "pt-0.5" : "pt-1",
        className,
      )}
      aria-hidden={false}
    >
      <span className={cn("text-[10px] font-medium uppercase tracking-[0.14em]", labelClass)}>
        Provided by
      </span>
      <BrandLogo
        className="h-3 w-auto max-w-[72px] sm:max-w-[84px] object-contain object-left opacity-90"
        sizes="84px"
      />
      <span className="sr-only">Equipify</span>
    </div>
  )
}
