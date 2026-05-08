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
  /** Provided-by row treatment */
  equipifyVariant?: "onDark" | "onLight"
  /** When true, text fallback uses light foreground (dark login header strip) */
  heroOnDark?: boolean
  /** Extra element below workspace identity (e.g. staff badge) */
  footerSlot?: React.ReactNode
  className?: string
}

/**
 * Primary portal identity: workspace logo when configured, otherwise intentional company-name typography.
 * Always includes subtle Equipify attribution — never broken `<img>` when URL fails.
 */
export function PortalWorkspaceBrand({
  organizationName,
  logoUrl,
  size = "compact",
  equipifyVariant = "onLight",
  heroOnDark = false,
  footerSlot,
  className,
}: Props) {
  const [imgBroken, setImgBroken] = useState(false)
  const trimmedUrl = logoUrl?.trim() ?? ""
  const showImage = trimmedUrl.length > 0 && !imgBroken

  const nameClass =
    size === "hero"
      ? "text-center text-xl sm:text-2xl font-semibold tracking-tight text-balance leading-snug px-1"
      : "text-left text-sm sm:text-base font-semibold tracking-tight leading-snug truncate max-w-[200px] sm:max-w-[260px]"

  return (
    <div className={cn("flex flex-col gap-1 min-w-0", className)}>
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
              "w-auto object-contain object-left",
              size === "hero" ? "max-h-11 sm:max-h-12 max-w-[min(280px,90vw)]" : "max-h-7 sm:max-h-8 max-w-[min(240px,55vw)]",
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
            {organizationName}
          </p>
        )}
      </div>
      <ProvidedByEquipify variant={equipifyVariant} />
      {footerSlot}
    </div>
  )
}
