import Image from "next/image"
import { cn } from "@/lib/utils"

/** Canonical logo asset (1024×280, ~3.7:1). Designed for dark backgrounds; use `BrandLogoOnLight` on light UI. */
export const BRAND_LOGO = {
  src: "/brand/equipify-logo.png",
  width: 1024,
  height: 280,
} as const

/** Square brand mark for collapsed nav / favicon-style slots (661×660). */
export const BRAND_MARK = {
  src: "/brand/equipify-mark.png",
  width: 661,
  height: 660,
} as const

type BrandMarkProps = {
  className?: string
  priority?: boolean
  sizes?: string
}

export function BrandMark({ className, priority, sizes }: BrandMarkProps) {
  return (
    <Image
      {...BRAND_MARK}
      alt="Equipify"
      priority={priority}
      className={cn("object-contain object-center", className)}
      sizes={sizes ?? "44px"}
      draggable={false}
    />
  )
}

type BrandLogoProps = {
  className?: string
  /** LCP / above-the-fold */
  priority?: boolean
  /** Responsive `sizes` hint for next/image (layout slot width). Defaults tuned for header usage. */
  sizes?: string
}

export function BrandLogo({ className, priority, sizes }: BrandLogoProps) {
  return (
    <Image
      {...BRAND_LOGO}
      alt="Equipify.ai"
      priority={priority}
      className={cn("h-auto w-auto max-w-full object-contain object-left", className)}
      sizes={sizes ?? "(max-width: 768px) 160px, 220px"}
      draggable={false}
    />
  )
}

/** Dark capsule behind logo so the dark-optimized wordmark stays readable on light/off-white surfaces. */
export function BrandLogoOnLight({ className, logoClassName }: { className?: string; logoClassName?: string }) {
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-lg bg-slate-950 px-2.5 py-1.5 ring-1 ring-black/10",
        className
      )}
    >
      <BrandLogo className={cn("h-6 w-auto sm:h-7", logoClassName)} />
    </div>
  )
}
