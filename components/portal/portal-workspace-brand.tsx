"use client"

import Image from "next/image"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { ProvidedByEquipify } from "@/components/portal/provided-by-equipify"

type Props = {
  organizationName: string
  /** Preferred workspace logo URL (document logo or app logo); null shows name only */
  logoUrl: string | null
  /** Visual scale for header vs login hero */
  size?: "compact" | "hero"
  /** When true, renders the small “Provided by Equipify” row (omit in main nav headers; use page/footer instead). */
  showProvidedBy?: boolean
  /** Provided-by row treatment (only when showProvidedBy) */
  equipifyVariant?: "onDark" | "onLight"
  /** When true, text fallback uses light foreground (dark login header strip) */
  heroOnDark?: boolean
  /** Extra element below workspace identity (e.g. secure-access badge) */
  footerSlot?: React.ReactNode
  className?: string
}

/**
 * Primary portal identity: workspace logo when configured, otherwise intentional company-name typography.
 * Never broken `<img>` when URL fails. Equipify attribution is optional — prefer footers for tertiary “Powered by”.
 */
export function PortalWorkspaceBrand({
  organizationName,
  logoUrl,
  size = "compact",
  showProvidedBy = false,
  equipifyVariant = "onLight",
  heroOnDark = false,
  footerSlot,
  className,
}: Props) {
  const [imgBroken, setImgBroken] = useState(false)
  const trimmedUrl = logoUrl?.trim() ?? ""
  const showImage = trimmedUrl.length > 0 && !imgBroken
  const displayName = organizationName.trim() || "Customer Portal"

  const nameClass =
    size === "hero"
      ? "text-center text-3xl sm:text-4xl font-semibold tracking-tight text-balance leading-snug px-2 max-w-[min(22rem,92vw)]"
      : "text-left text-sm sm:text-base font-semibold tracking-tight leading-snug truncate max-w-[200px] sm:max-w-[260px]"

  return (
    <div className={cn("flex flex-col gap-2 min-w-0", className)}>
      <div
        className={cn(
          "flex items-center justify-start min-h-0",
          size === "hero" ? "justify-center py-1" : "",
        )}
      >
        {showImage ? (
          <Image
            src={trimmedUrl}
            alt=""
            width={280}
            height={80}
            className={cn(
              "w-auto object-contain object-center",
              size === "hero"
                ? "max-h-[7rem] sm:max-h-[8.25rem] max-w-[min(320px,92vw)]"
                : "max-h-7 sm:max-h-8 max-w-[min(240px,55vw)] object-left",
            )}
            onError={() => setImgBroken(true)}
            unoptimized={
              trimmedUrl.startsWith("http://") ||
              trimmedUrl.startsWith("https://") ||
              trimmedUrl.includes("/storage/v1/object/")
            }
          />
        ) : (
          <p
            className={nameClass}
            style={{
              color:
                size === "hero" && heroOnDark
                  ? "rgba(255,255,255,0.96)"
                  : "var(--portal-foreground)",
            }}
          >
            {displayName}
          </p>
        )}
      </div>
      {showProvidedBy ? <ProvidedByEquipify variant={equipifyVariant} /> : null}
      {footerSlot}
    </div>
  )
}
